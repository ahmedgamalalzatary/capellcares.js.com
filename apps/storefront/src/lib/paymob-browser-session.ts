import type { CheckoutRequestDto } from "@capella/shared";

const PENDING_CHECKOUT_KEY = "capella:pending-paymob-checkout";
const PENDING_LANG_KEY = "capella:paymob-checkout-lang";
const REQUEST_KEY = "capella:paymob-checkout-request";

export async function getCheckoutIdempotencyKey(payload: CheckoutRequestDto): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  try {
    const previous = JSON.parse(sessionStorage.getItem(REQUEST_KEY) ?? "null") as
      { fingerprint?: string; key?: string } | null;
    if (previous?.fingerprint === fingerprint && previous.key) return previous.key;
  } catch { /* A malformed browser value cannot be trusted. */ }
  const key = crypto.randomUUID();
  sessionStorage.setItem(REQUEST_KEY, JSON.stringify({ fingerprint, key }));
  return key;
}

export function rememberPendingCheckout(checkoutId: string, lang?: "ar" | "en"): void {
  sessionStorage.setItem(PENDING_CHECKOUT_KEY, checkoutId);
  if (lang) sessionStorage.setItem(PENDING_LANG_KEY, lang);
}

export function getPendingCheckoutLang(): "ar" | "en" | null {
  const lang = sessionStorage.getItem(PENDING_LANG_KEY);
  return lang === "ar" || lang === "en" ? lang : null;
}

export function getPendingCheckoutId(): string | null {
  return sessionStorage.getItem(PENDING_CHECKOUT_KEY);
}

export function clearPendingCheckout(): void {
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  sessionStorage.removeItem(PENDING_LANG_KEY);
  sessionStorage.removeItem(REQUEST_KEY);
}

export function redirectToPaymob(url: string): void {
  window.location.assign(url);
}
