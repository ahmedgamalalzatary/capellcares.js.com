"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { dir, getDict, type Dict, type Language } from "@minikoshk/shared";

type LocaleContextValue = { lang: Language; dict: Dict };

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Provides the active language and its dictionary to the whole storefront tree. */
export function LocaleProvider({ lang, children }: { lang: Language; children: ReactNode }) {
  const value = useMemo<LocaleContextValue>(() => ({ lang, dict: getDict(lang) }), [lang]);

  // The <html> element is owned by the root layout, which Next.js does not
  // re-render on client-side navigation. Keep its lang/dir in sync here so the
  // layout flips (LTR ↔ RTL) the moment the language switches.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir(lang);
  }, [lang]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}
