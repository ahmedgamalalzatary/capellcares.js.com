import type { PaymentStatus, ProviderPaymentStatus } from "../types/index.js";

/** Paymob outcomes the order list shows as "مرفوض" (money reversed or never captured). */
export const PAYMOB_REVERSED_STATUSES = ["partially_refunded", "refunded", "failed", "voided"] as const satisfies readonly ProviderPaymentStatus[];

export interface PaymentFilterFields {
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  providerPaymentStatus: ProviderPaymentStatus | null;
}

/**
 * Paymob orders display the provider's state while COD orders display the operational status, so the list filter has
 * to read the same source as the label it sits next to instead of comparing raw enums across both payment methods.
 * The API's SQL filter mirrors this rule (and is tested against it).
 */
export function orderMatchesPaymentStatusFilter(order: PaymentFilterFields, filter: PaymentStatus) {
  if (order.paymentMethod !== "paymob") return order.paymentStatus === filter;
  const providerStatus = order.providerPaymentStatus;
  const reversed = providerStatus != null && (PAYMOB_REVERSED_STATUSES as readonly string[]).includes(providerStatus);
  if (filter === "accepted") return providerStatus === "succeeded";
  if (filter === "denied") return reversed;
  return providerStatus !== "succeeded" && !reversed;
}
