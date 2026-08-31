import { createContext, useContext, useMemo, type ReactNode } from "react";
import { dir, getDict, type Dict } from "@capella/shared/i18n";
import type { Language } from "@capella/shared";

type LangContextValue = {
  lang: Language;
  dict: Dict;
  dir: "rtl" | "ltr";
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const lang: Language = "ar";
    return { lang, dict: getDict(lang), dir: dir(lang) };
  }, []);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const value = useContext(LangContext);
  if (!value) {
    throw new Error("useLang must be used within LangProvider");
  }
  return value;
}
