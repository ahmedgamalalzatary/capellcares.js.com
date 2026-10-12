import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { appConfigSchema, type AppConfig, type NativePlatform } from "@capella/shared";
import { fetchAppConfig } from "@/lib/api/client";
import { readPersistentValue, writePersistentValue, type PersistentValue } from "@/lib/persistent-storage";
import { APP_POLICY_DISMISSAL_STORAGE_KEY, APP_POLICY_STORAGE_KEY } from "@/constants/storage";

type PolicyCache = { fetchedAt: number; config: AppConfig };

// The cached response is stored with its fetch time so freshness (cache.maxAgeSeconds
// from the policy itself) can be judged without a second key. A malformed or
// stale-format entry decodes to null and is simply refetched.
export const appPolicyStorage: PersistentValue<PolicyCache> = {
  key: APP_POLICY_STORAGE_KEY,
  decode: (raw) => {
    try {
      const parsed = JSON.parse(raw) as { fetchedAt?: unknown; config?: unknown };
      const config = appConfigSchema.safeParse(parsed?.config);
      if (!config.success || typeof parsed?.fetchedAt !== "number" || !Number.isFinite(parsed.fetchedAt)) return null;
      return { fetchedAt: parsed.fetchedAt, config: config.data };
    } catch {
      return null;
    }
  },
  encode: (value) => JSON.stringify({ fetchedAt: value.fetchedAt, config: value.config })
};

// The dismissal key is the policy revision plus the recommended release id, so a
// later policy/release never stays suppressed by an older dismissal.
const appPolicyDismissalStorage: PersistentValue<string> = {
  key: APP_POLICY_DISMISSAL_STORAGE_KEY,
  decode: (raw) => (raw.length > 0 ? raw : null),
  encode: (value) => value
};

type PolicyContextValue = {
  config: AppConfig | null;
  ready: boolean;
  refreshing: boolean;
  features: AppConfig["features"];
  recommendedUpdate: AppConfig["recommendedUpdate"];
  dismissed: boolean;
  refresh: () => Promise<void>;
  dismissRecommendedUpdate: () => Promise<void>;
};

const PolicyContext = createContext<PolicyContextValue | null>(null);

function resolvePlatform(): NativePlatform | null {
  return Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : null;
}

function isStale(cache: PolicyCache | null, now: number): boolean {
  return cache === null || now - cache.fetchedAt >= cache.config.cache.maxAgeSeconds * 1000;
}

export function PolicyProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissal, setDismissal] = useState<string | null>(null);

  const activeRef = useRef(true);
  const cacheRef = useRef<PolicyCache | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;
    const platform = resolvePlatform();
    if (!platform) {
      setReady(true);
      return Promise.resolve();
    }

    setRefreshing(true);
    const task = (async () => {
      try {
        const fresh = await fetchAppConfig(platform);
        if (!activeRef.current) return;
        const cache: PolicyCache = { fetchedAt: Date.now(), config: fresh };
        cacheRef.current = cache;
        setConfig(fresh);
        try {
          await writePersistentValue(appPolicyStorage, cache);
        } catch {
          // Persistence is best-effort; the in-memory policy is still valid.
        }
      } catch {
        // Offline, invalid or unavailable policy: keep whatever cache we have and stay settled.
      } finally {
        inFlightRef.current = null;
        if (activeRef.current) {
          setRefreshing(false);
          setReady(true);
        }
      }
    })();
    inFlightRef.current = task;
    return task;
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void (async () => {
      let cache: PolicyCache | null = null;
      let storedDismissal: string | null = null;
      try {
        cache = await readPersistentValue(appPolicyStorage);
      } catch {
        cache = null;
      }
      try {
        storedDismissal = await readPersistentValue(appPolicyDismissalStorage);
      } catch {
        storedDismissal = null;
      }
      if (!activeRef.current) return;

      // Settle startup from cache immediately; a background refresh never blocks or reloads startup.
      if (cache) {
        cacheRef.current = cache;
        setConfig(cache.config);
      }
      setDismissal(storedDismissal);
      setReady(true);

      if (isStale(cache, Date.now())) void refresh();
    })();
    return () => {
      activeRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (isStale(cacheRef.current, Date.now())) void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const dismissRecommendedUpdate = useCallback(async () => {
    const current = cacheRef.current?.config;
    const recommended = current?.recommendedUpdate;
    if (!current || !recommended) return;
    const token = `${current.policyRevision}:${recommended.releaseId}`;
    setDismissal(token);
    try {
      await writePersistentValue(appPolicyDismissalStorage, token);
    } catch {
      // Suppression stays in memory even if persistence fails.
    }
  }, []);

  const recommendedUpdate = useMemo(() => {
    const recommended = config?.recommendedUpdate;
    if (!recommended || !config) return null;
    return dismissal === `${config.policyRevision}:${recommended.releaseId}` ? null : recommended;
  }, [config, dismissal]);

  const dismissed = Boolean(config?.recommendedUpdate) && recommendedUpdate === null;

  const value = useMemo<PolicyContextValue>(() => ({
    config,
    ready,
    refreshing,
    features: config?.features ?? [],
    recommendedUpdate,
    dismissed,
    refresh,
    dismissRecommendedUpdate
  }), [config, ready, refreshing, recommendedUpdate, dismissed, refresh, dismissRecommendedUpdate]);

  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}

export function usePolicy() {
  const context = useContext(PolicyContext);
  if (!context) throw new Error("usePolicy must be used within a PolicyProvider");
  return context;
}
