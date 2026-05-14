import { ar } from "./ar.js";
import { en } from "./en.js";
import type { Language } from "../constants/languages.js";

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
