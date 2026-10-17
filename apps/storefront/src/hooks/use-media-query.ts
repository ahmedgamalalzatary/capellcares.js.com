"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Whether `query` matches right now, following changes. False on the server and during hydration. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener?.("change", onChange);
    return () => mediaQuery.removeEventListener?.("change", onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
