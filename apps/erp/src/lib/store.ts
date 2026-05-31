"use client";

// API-backed ERP store: initial state hydrated from /api/erp, mutations go
// through the API and trigger a refetch so storefront sees the same data.

import { useSyncExternalStore } from "react";
import { ErpStore } from "./store/core";

let _instance: ErpStore | null = null;
export function getStore(): ErpStore {
  if (!_instance) _instance = new ErpStore();
  return _instance;
}

export function useStore<T>(selector: (s: ErpStore) => T): T {
  const store = getStore();
  if (typeof window !== "undefined") store.ensureLoaded();
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => selector(store),
    () => selector(store)
  );
}
