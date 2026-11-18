"use client";

import { useEffect, useState } from "react";
import { formatPrice, type Dict, type Language, type PromoRejectionDto } from "@capella/shared";

// The promo code the customer typed, kept in this browser so it survives moving from cart to checkout and logging in.
const STORAGE_KEY = "capella:promo-code";
const CHANGE_EVENT = "capella:promo-code-change";
// Used when the browser blocks storage (private mode): the code then lasts only for this page.
let memoryCode: string | null = null;

export function loadPromoCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return memoryCode ?? "";
  }
}

export function savePromoCode(code: string | null) {
  const value = code?.trim() || null;
  memoryCode = value;
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Kept in memoryCode instead.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The saved promo code, shared by every component on the page. */
export function usePromoCode(): [string, (code: string | null) => void] {
  const [code, setCode] = useState("");
  useEffect(() => {
    const sync = () => setCode(loadPromoCode());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [code, savePromoCode];
}

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export function promoRejectionMessage(rejection: PromoRejectionDto, dict: Dict, lang: Language): string {
  return fillTemplate(dict.promo.reasons[rejection.reason], {
    amount: formatPrice(rejection.missingAmount ?? rejection.maxAmount ?? 0, lang),
    count: rejection.missingPieces ?? 0
  });
}
