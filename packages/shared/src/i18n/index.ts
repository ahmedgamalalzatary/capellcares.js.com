import { ar } from "./ar";
import { en } from "./en";
import type { Language } from "../constants/languages";

export const dictionaries = { ar, en } as const;
export type Dict = typeof en;

export function getDict(lang: Language): Dict {
  return dictionaries[lang];
}

export function isRtl(lang: Language) {
  return lang === "ar";
}

export function dir(lang: Language): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}
