"use client";

import { useEffect, useRef, useState } from "react";

/** The brief "Added" confirmation shown after something goes into the bag.
 * Every surface needs the same three things — a flag, a timer that turns it off, and cleanup so a shopper who navigates away mid-confirmation doesn't leave a timer writing state into an unmounted page; flashing again restarts the window rather than stacking. */
export function useAddedFlash(durationMs = 1600) {
  const [added, setAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const flash = () => {
    setAdded(true);
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setAdded(false);
      timeoutRef.current = null;
    }, durationMs);
  };

  return { added, flash };
}
