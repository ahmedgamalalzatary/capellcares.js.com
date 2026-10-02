import type { BostaObservation } from "./bosta/bosta-sync.service.js";

/** Follow-up read delay before a fully resolved terminal parcel is parked (W07 B05). */
export const TERMINAL_FOLLOW_UP_MS = 24 * 60 * 60_000;

/**
 * Provider states from which a parcel never moves again without a new event.
 *
 * Codes come from the Bosta state table already used by the sync normalizer. `104
 * Archived` is included because it is the provider's own terminal resting state.
 */
const TERMINAL_STATE_CODES = new Set([45, 46, 48, 49, 60, 100, 101, 104]);

/** Exception/investigation states require staff, not more polling. */
const STAFF_REQUIRED_STATE_CODES = new Set([47, 102, 103, 105]);

export function isTerminalShippingState(stateCode: number): boolean {
  return TERMINAL_STATE_CODES.has(stateCode);
}

/**
 * Whether a terminal observation is FULLY resolved, meaning it is safe to stop reading.
 *
 * The plan is explicit that a raw terminal code is never sufficient: a missing COD
 * confirmation, an open exception, an unconfirmed delivery or an unresolved pending edit
 * all still need resolution. Parking on the code alone would silently drop exactly the
 * money and custody questions the sync worker exists to answer.
 */
export function isFullyResolvedTerminal(
  observation: BostaObservation,
  pendingOperations: number,
  openSafetyFlags = 0
): boolean {
  if (!isTerminalShippingState(observation.stateCode)) return false;
  if (STAFF_REQUIRED_STATE_CODES.has(observation.stateCode)) return false;
  // An exception code attached to a terminal state is still an open question.
  if (observation.exceptionCode != null) return false;
  // A pending edit/cancel/terminate that has not been confirmed is unresolved work.
  if (pendingOperations > 0) return false;
  // An OPEN safety flag is an unresolved money or custody question by definition - it was
  // raised precisely because something about this parcel does not add up. Parking here
  // would drop the job from every sweep and with it the only automatic way the question
  // would ever be revisited, filing a known discrepancy as finished business.
  if (openSafetyFlags > 0) return false;
  // COD must be positively settled. `confirmedDelivery` is the carrier's own statement
  // that collection is verified; null means the provider told us nothing, which is not
  // the same as "nothing outstanding". Amount 0 is legitimate for prepaid orders, so the
  // amount alone can never establish resolution - the confirmation has to be present.
  if (observation.confirmedDelivery !== true) return false;
  if (observation.collectedAmountCents == null) return false;
  return true;
}