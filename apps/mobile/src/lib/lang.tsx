import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { I18nManager } from "react-native";
import { dir, getDict, isRtl, type Dict } from "@capella/shared/i18n";
import type { Language } from "@capella/shared";
import { LANG_STORAGE_KEY } from "@/constants/storage";

const MOBILE_DEFAULT_LANGUAGE: Language = "ar";

type LangContextValue = {
  dict: Dict;
  direction: "rtl" | "ltr";
  isRtl: boolean;
  lang: Language;
  ready: boolean;
  setLang: (language: Language) => Promise<void>;
};

const LangContext = createContext<LangContextValue | null>(null);

function normalizeLanguage(value: string | null): Language {
  return value === "ar" || value === "en" ? value : MOBILE_DEFAULT_LANGUAGE;
}

function setNativeDirection(language: Language) {
  const shouldUseRtl = isRtl(language);
  I18nManager.allowRTL(shouldUseRtl);
  I18nManager.forceRTL(shouldUseRtl);
  return shouldUseRtl;
}

async function applyNativeDirection(language: Language) {
  const shouldUseRtl = setNativeDirection(language);
  const needsReload = I18nManager.isRTL !== shouldUseRtl;
  if (needsReload) await reloadAppAsync();
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLanguage] = useState<Language>(MOBILE_DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      let storedLanguage: string | null = null;
      try {
        storedLanguage = await AsyncStorage.getItem(LANG_STORAGE_KEY);
      } catch {
        // Storage can be unavailable on a damaged install; Arabic remains safe.
      }

      const language = normalizeLanguage(storedLanguage);
      if (storedLanguage !== language) {
        try {
          await AsyncStorage.setItem(LANG_STORAGE_KEY, language);
        } catch {
          // Keep the app usable even if persistence is temporarily unavailable.
        }
      }

      if (active) setLanguage(language);
      try {
        await applyNativeDirection(language);
      } catch {
        // A development client provides reloadAppAsync; if native reload still
        // fails, finish startup without leaking an unhandled rejection.
      } finally {
        if (active) setReady(true);
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback(
    async (language: Language) => {
      if (language === lang) return;
      try {
        await AsyncStorage.setItem(LANG_STORAGE_KEY, language);
      } catch {
        return;
      }

      try {
        await applyNativeDirection(language);
        setLanguage(language);
      } catch {
        try {
          await AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
        } catch {
          // The active in-memory language remains authoritative for this run.
        }
        setNativeDirection(lang);
      }
    },
    [lang]
  );

  const value = useMemo<LangContextValue>(
    () => ({
      dict: getDict(lang),
      direction: dir(lang),
      isRtl: isRtl(lang),
      lang,
      ready,
      setLang
    }),
    [lang, ready, setLang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang must be used within a LangProvider");
  return context;
}
