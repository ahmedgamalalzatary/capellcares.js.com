import { reloadAppAsync } from "expo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { I18nManager, Platform } from "react-native";
import { dir, getDict, isRtl, type Dict } from "@capella/shared/i18n";
import type { Language } from "@capella/shared";
import { languageStorage, readPersistentValue, writePersistentValue } from "@/lib/persistent-storage";

const MOBILE_DEFAULT_LANGUAGE: Language = "ar";

type LangContextValue = {
  dict: Dict;
  direction: "rtl" | "ltr";
  error: Error | null;
  holdLanguageChanges: () => () => void;
  isRtl: boolean;
  lang: Language;
  pending: boolean;
  ready: boolean;
  retry: () => void;
  setLang: (language: Language) => Promise<void>;
};

const LangContext = createContext<LangContextValue | null>(null);

function normalizeLanguage(value: string | null): Language {
  return value === "ar" || value === "en" ? value : MOBILE_DEFAULT_LANGUAGE;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function setNativeDirection(language: Language) {
  const shouldUseRtl = isRtl(language);
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
      document.documentElement.dir = dir(language);
    }
    return shouldUseRtl;
  }
  I18nManager.allowRTL(shouldUseRtl);
  I18nManager.forceRTL(shouldUseRtl);
  return shouldUseRtl;
}

async function applyNativeDirection(language: Language) {
  const shouldUseRtl = setNativeDirection(language);
  if (Platform.OS === "web") return;
  const needsReload = I18nManager.isRTL !== shouldUseRtl;
  if (needsReload) await reloadAppAsync();
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLanguage] = useState<Language>(MOBILE_DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hydrateNonce, setHydrateNonce] = useState(0);

  const activeRef = useRef(true);
  const langRef = useRef<Language>(MOBILE_DEFAULT_LANGUAGE);
  const desiredRef = useRef<Language>(MOBILE_DEFAULT_LANGUAGE);
  const busyRef = useRef(false);
  const criticalOperationsRef = useRef(0);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      let storedLanguage: string | null = null;
      try {
        storedLanguage = await readPersistentValue(languageStorage);
      } catch {
        // Storage can be unavailable on a damaged install; Arabic remains safe.
      }

      const language = normalizeLanguage(storedLanguage);
      if (storedLanguage !== language) {
        try {
          await writePersistentValue(languageStorage, language);
        } catch {
          // Keep the app usable even if persistence is temporarily unavailable.
        }
      }

      if (!active) return;
      langRef.current = language;
      desiredRef.current = language;
      setLanguage(language);

      try {
        await applyNativeDirection(language);
        if (active) setReady(true);
      } catch (nativeError) {
        // Never publish ready while the native layout still disagrees with the
        // selected language; surface a recoverable error for retry instead.
        if (active) setError(toError(nativeError));
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, [hydrateNonce]);

  const runSwitches = useCallback(async function runQueuedSwitches(): Promise<void> {
    if (busyRef.current || criticalOperationsRef.current > 0 || !activeRef.current) return;
    busyRef.current = true;

    let persisted: Language | null = null;
    try {
      while (desiredRef.current !== langRef.current && activeRef.current) {
        // Let any synchronously-queued selection coalesce so the latest wins.
        await Promise.resolve();
        if (criticalOperationsRef.current > 0 || !activeRef.current) break;
        const target = desiredRef.current;
        if (target === langRef.current) break;

        await writePersistentValue(languageStorage, target);
        persisted = target;
        if (criticalOperationsRef.current > 0 || !activeRef.current) break;
        if (desiredRef.current !== target) continue;

        await applyNativeDirection(target);
        if (!activeRef.current) break;
        if (desiredRef.current !== target) continue;

        langRef.current = target;
        desiredRef.current = target;
        setLanguage(target);
        persisted = null;
      }
    } catch (switchError) {
      desiredRef.current = langRef.current;
      try {
        await writePersistentValue(languageStorage, langRef.current);
      } catch {
        // The active in-memory language remains authoritative for this run.
      }
      persisted = null;
      setNativeDirection(langRef.current);
      if (activeRef.current) setError(toError(switchError));
    } finally {
      if (persisted !== null && persisted !== langRef.current) {
        try {
          await writePersistentValue(languageStorage, langRef.current);
        } catch {
          // Best-effort reconciliation of a superseded write.
        }
      }
      busyRef.current = false;
      if (activeRef.current) setPending(desiredRef.current !== langRef.current);
      if (
        activeRef.current && criticalOperationsRef.current === 0 &&
        desiredRef.current !== langRef.current
      ) {
        void runQueuedSwitches();
      }
    }
  }, []);

  const setLang = useCallback(
    (language: Language) => {
      desiredRef.current = language;
      if (language === langRef.current && !busyRef.current) {
        if (activeRef.current) setPending(false);
        return Promise.resolve();
      }
      if (activeRef.current) setPending(true);
      return runSwitches();
    },
    [runSwitches]
  );

  const holdLanguageChanges = useCallback(() => {
    criticalOperationsRef.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      criticalOperationsRef.current -= 1;
      if (criticalOperationsRef.current === 0 && activeRef.current) void runSwitches();
    };
  }, [runSwitches]);

  const retry = useCallback(() => {
    setError(null);
    setReady(false);
    setHydrateNonce((nonce) => nonce + 1);
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      dict: getDict(lang),
      direction: dir(lang),
      error,
      holdLanguageChanges,
      isRtl: isRtl(lang),
      lang,
      pending,
      ready,
      retry,
      setLang
    }),
    [lang, ready, pending, error, retry, setLang, holdLanguageChanges]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang must be used within a LangProvider");
  return context;
}
