import { useCallback, useState } from "react";

function readStored<T>(key: string, isValid: (value: unknown) => value is T): Set<T> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(isValid));
  } catch {
    return new Set();
  }
}

function persist<T>(key: string, values: Set<T>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...values]));
  } catch {
    /* storage unavailable (private mode / quota) — keep the in-memory state */
  }
}

/**
 * Tracks a collapsed set of ids/slots, persisting it to localStorage under
 * `storageKey` so fold/unfold state survives navigation and page reloads.
 *
 * The stored set is read synchronously in the initializer so the first render
 * already reflects it, avoiding a flash of expanded items when returning to the
 * page. SSR-safe for views that render from a client store that is empty on the
 * server (no markup to mismatch).
 */
export function useCollapsedSet<T>(storageKey: string, isValid: (value: unknown) => value is T) {
  const [collapsed, setCollapsed] = useState<Set<T>>(() => readStored(storageKey, isValid));

  const toggle = useCallback((value: T) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      persist(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return { collapsed, toggle };
}
