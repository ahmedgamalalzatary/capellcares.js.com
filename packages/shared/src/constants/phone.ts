// One stored format for Egyptian mobile numbers: "+20" followed by the 10-digit number (e.g. +201012345678).
// Every write of a customer phone (COD orders, Paymob sessions, shipment edits) goes through normalizeEgyptianPhone,
// so lookups by phone (first-order and per-customer promo checks, staff search, where a typed 010… is a substring of +2010…) match no matter how it was typed.

const SEPARATORS = /[\s\-()]/g;
const EGYPTIAN_MOBILE = /^(?:\+20|0020|0)?(1[0125]\d{8})$/;

/** "+20" plus the 10-digit mobile number for any accepted Egyptian format; anything else is returned trimmed and otherwise unchanged. */
export function normalizeEgyptianPhone(value: string): string {
  const compact = value.trim().replace(SEPARATORS, "");
  const match = EGYPTIAN_MOBILE.exec(compact);
  return match ? `+20${match[1]}` : value.trim();
}

