"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A boolean that turns itself off after `durationMs` — used for the "Added"
 * confirmation on add-to-cart buttons so they return to their normal label.
 */
export function useTransientFlag(durationMs = 2000): [boolean, () => void] {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const trigger = useCallback(() => {
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), durationMs);
  }, [durationMs]);

  return [active, trigger];
}
