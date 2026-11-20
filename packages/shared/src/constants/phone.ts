// One stored format for Kuwaiti mobile numbers: "+965" followed by the 8-digit number (e.g. +96555123456).
// Every write of a customer phone on an order goes through normalizeKuwaitiPhone, so lookups by phone
// (first-order and per-customer promo checks, staff search, where a typed 5512… is a substring of +9655512…) match no matter how it was typed.

const SEPARATORS = /[\s\-()]/g;
const KUWAITI_MOBILE = /^(?:\+965|00965)?([569]\d{7})$/;

/** "+965" plus the 8-digit mobile number for any accepted Kuwaiti format; anything else is returned trimmed and otherwise unchanged. */
export function normalizeKuwaitiPhone(value: string): string {
  const compact = value.trim().replace(SEPARATORS, "");
  const match = KUWAITI_MOBILE.exec(compact);
  return match ? `+965${match[1]}` : value.trim();
}
