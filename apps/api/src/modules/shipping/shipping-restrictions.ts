/**
 * Provider restrictions that must hold BEFORE any checkout or edit write.
 *
 * Bosta documents a maximum collection of EGP 30,000 per shipment and requires a
 * drop-off address line longer than five characters. Both were previously only
 * enforced inside `buildRequest`, i.e. after an order existed, stock was held and
 * (for Paymob) an intention had been created. These rules are shared by initial
 * checkout, explicit shipment edits and dispatch, so the value we validate is the
 * exact value the carrier later receives.
 *
 * EGP 30,000 exactly is allowed; EGP 30,000.01 is rejected.
 */
import { CheckoutShippingError } from "./checkout-shipping.service.js";

/** Bosta's documented maximum collection: EGP 30,000. */
export const MAX_COD_CENTS = 3_000_000;

/** Bosta requires the combined drop-off address line to be longer than this. */
export const MIN_ADDRESS_LINE_LENGTH = 6;

export const SHIPPING_ADDRESS_INVALID = "SHIPPING_ADDRESS_INVALID";
export const SHIPPING_COD_LIMIT = "SHIPPING_COD_LIMIT";

/**
 * The single construction of the carrier's `firstLine`. Checkout, explicit edits
 * and dispatch all use this, so a validated length can never diverge from what is
 * actually sent.
 */
export function buildDropOffFirstLine(addressLine: string, buildingApartment: string): string {
  return `${addressLine}, ${buildingApartment}`;
}

export type ShippingRestrictionInput = {
  /** `null` means the caller has no address yet, so only money rules apply. */
  firstLine: string | null;
  paymentMethod: string;
  codAmountCents: number;
};

/**
 * Throws `CheckoutShippingError` with a specific, client-safe code so the storefront
 * can show a precise bilingual message instead of an eventual generic dispatch failure.
 *
 * Prepaid collection stays zero by construction, so an above-ceiling *paid* total is
 * never rejected — only actual cash collection is bounded.
 */
export function assertShippingRestrictionsAllowed(input: ShippingRestrictionInput): void {
  if (input.firstLine !== null && input.firstLine.trim().length < MIN_ADDRESS_LINE_LENGTH) {
    throw new CheckoutShippingError(SHIPPING_ADDRESS_INVALID);
  }
  if (input.paymentMethod === "cod" && input.codAmountCents > MAX_COD_CENTS) {
    throw new CheckoutShippingError(SHIPPING_COD_LIMIT);
  }
}

/** Convenience wrapper for callers holding the two address parts. */
export function assertAddressAllowed(addressLine: string, buildingApartment: string): void {
  const firstLine = buildDropOffFirstLine(addressLine, buildingApartment);
  // Address validity does not depend on payment method, so use a neutral value.
  assertShippingRestrictionsAllowed({ firstLine, paymentMethod: "cod", codAmountCents: 0 });
}