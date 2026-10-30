import type { CheckoutRequestDto } from "@capella/shared";

const REQUEST_KEY = "faltatoy:checkout-request";

/** The same cart resubmitted (double click, retry after a dropped response) reuses its key, so it can never create a second order. */
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

export function clearCheckoutRequest(): void {
  sessionStorage.removeItem(REQUEST_KEY);
}
