"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_DARK_QUERY as DARK_QUERY, THEME_STORAGE_KEY as STORAGE_KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

function apply(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Per-viewer theme choice (a browser convenience, not shared state). */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>("light");

  useEffect(() => {
    setPreferenceState(readPreference());
  }, []);

  useEffect(() => {
    apply(preference);
    if (preference !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      // Persist every choice including "system" so the light default only applies before the viewer ever chooses.
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice still applies for this visit.
    }
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
