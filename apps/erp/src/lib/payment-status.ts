import type { OrderSummary, PaymentStatus } from "@capella/shared";

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "قيد المراجعة",
  accepted: "مقبول",
  denied: "مرفوض"
};

export const paymentStatusChip: Record<PaymentStatus, string> = {
  pending: "status status--draft",
  accepted: "status status--active",
  denied: "status status--deleted"
};

export const paymentStatusFilterOptions = [
  { value: "all", label: "كل حالات الدفع" },
  ...(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((status) => ({
    value: status,
    label: paymentStatusLabel[status]
  }))
];

/**
 * Paymob orders display the provider's state (see orderPaymentDisplay) while COD orders
 * display the operational status, so the list filter has to read the same source as the
 * label it sits next to instead of comparing raw enums across both payment methods.
 */
export function orderMatchesPaymentStatusFilter(
  order: Pick<OrderSummary, "paymentMethod" | "paymentStatus" | "providerPaymentStatus">,
  filter: PaymentStatus
) {
  if (order.paymentMethod !== "paymob") {
    return order.paymentStatus === filter;
  }
  const providerStatus = order.providerPaymentStatus;
  if (filter === "accepted") {
    return providerStatus === "succeeded";
  }
  if (filter === "denied") {
    return providerStatus === "partially_refunded" || providerStatus === "refunded";
  }
  return providerStatus !== "succeeded" && providerStatus !== "partially_refunded" && providerStatus !== "refunded";
}

export function orderPaymentDisplay(order: Pick<OrderSummary, "paymentMethod" | "paymentStatus" | "providerPaymentStatus">) {
  if (order.paymentMethod === "cod") {
    return { label: paymentStatusLabel[order.paymentStatus], chip: paymentStatusChip[order.paymentStatus] };
  }
  const status = order.providerPaymentStatus;
  if (status === "succeeded") return { label: "مدفوع عبر باي موب", chip: "status status--active" };
  if (status === "partially_refunded") return { label: "مسترد جزئيًا عبر باي موب", chip: "status status--draft" };
  if (status === "refunded") return { label: "مسترد عبر باي موب", chip: "status status--deleted" };
  return { label: "قيد تأكيد باي موب", chip: "status status--draft" };
}
