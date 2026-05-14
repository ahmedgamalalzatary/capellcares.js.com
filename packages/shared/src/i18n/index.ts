import { ar } from "./ar";
import { en } from "./en";
import type { Language } from "../constants/languages";

export type Dict = typeof ar | typeof en;
export const dictionaries: Record<Language, Dict> = { ar, en };

export function getDict(lang: Language): Dict {
  return dictionaries[lang];
}

export function isRtl(lang: Language) {
  return lang === "ar";
}

export function dir(lang: Language): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}
