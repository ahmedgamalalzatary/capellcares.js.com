"use client";

import { useEffect, useState } from "react";
import { formatPrice, type Dict, type Language, type PromoAppliedDto, type PromoRejectionDto } from "@capella/shared";

// The promo code the customer typed, kept in this browser so it survives moving from cart to checkout and logging in.
const STORAGE_KEY = "faltatoy:promo-code";
// The sale replacements the customer confirmed for that code (spec section 7, case 26): any other set asks again.
const ACCEPTED_KEY = "faltatoy:promo-accepted";
const CHANGE_EVENT = "faltatoy:promo-code-change";
// Used when the browser blocks storage (private mode): the code then lasts only for this page.
let memoryCode: string | null = null;
let memoryAccepted = "";
// Keys whose last save failed (storage full or blocked): their value lives in memory until a save succeeds.
const unsaved = new Set<string>();

function read(key: string, fallback: string): string {
  if (unsaved.has(key)) return fallback;
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
    unsaved.delete(key);
  } catch {
    unsaved.add(key);
  }
}

const changed = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
};

export function loadPromoCode(): string {
  return read(STORAGE_KEY, memoryCode ?? "");
}

export function loadAcceptedPromoSales(): string {
  return read(ACCEPTED_KEY, memoryAccepted);
}

/** Saves the code, with the sale replacements the customer accepted for it (none unless given). */
export function savePromoCode(code: string | null, acceptedSales = "") {
  const value = code?.trim() || null;
  memoryCode = value;
  memoryAccepted = value ? acceptedSales : "";
  write(STORAGE_KEY, value ?? "");
  write(ACCEPTED_KEY, memoryAccepted);
  changed();
}

/** The customer confirmed the code's current sale replacements. */
export function acceptPromoSales(signature: string) {
  memoryAccepted = signature;
  write(ACCEPTED_KEY, signature);
  changed();
}

/** Identifies a set of sale replacements by line and price, so a confirmation covers exactly what was shown. */
export function salesSignature(sales: PromoAppliedDto["replacedSales"]): string {
  if (sales.length === 0) return "";
  return JSON.stringify(sales.map((sale) => [sale.index, sale.item ?? "", sale.previousLineTotal, sale.lineTotal])
    .sort((a, b) => Number(a[0]) - Number(b[0])));
}

/** The saved promo code and its accepted sale replacements, shared by every component on the page. */
export function usePromoCode() {
  const [state, setState] = useState({ code: "", accepted: "" });
  useEffect(() => {
    const sync = () => setState({ code: loadPromoCode(), accepted: loadAcceptedPromoSales() });
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { code: state.code, accepted: state.accepted, save: savePromoCode, accept: acceptPromoSales };
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
