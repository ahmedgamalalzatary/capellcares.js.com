import type { OrderSummary, PaymentStatus } from "@capella/shared";
import type { BadgeTone } from "@/components/ui/badge";

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "قيد المراجعة",
  accepted: "مقبول",
  denied: "مرفوض"
};

/** Badge tone for a raw payment status (sales tables). */
export const paymentStatusTone: Record<PaymentStatus, BadgeTone> = {
  pending: "warning",
  accepted: "success",
  denied: "danger"
};

export const paymentStatusFilterOptions = [
  { value: "all", label: "كل حالات الدفع" },
  ...(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((status) => ({
    value: status,
    label: paymentStatusLabel[status]
  }))
];

/** Paymob orders display the provider's state while COD orders display the operational status, so the list filter has to read the same source as the label it sits next to instead of comparing raw enums across both payment methods. */
export function orderMatchesPaymentStatusFilter(
  order: Pick<OrderSummary, "paymentMethod" | "paymentStatus" | "providerPaymentStatus">,
  filter: PaymentStatus
) {
  if (order.paymentMethod !== "paymob") {
    return order.paymentStatus === filter;
  }
  const providerStatus = order.providerPaymentStatus;
  const reversedOrFailed = providerStatus === "partially_refunded" || providerStatus === "refunded" ||
    providerStatus === "failed" || providerStatus === "voided";
  if (filter === "accepted") {
    return providerStatus === "succeeded";
  }
  if (filter === "denied") {
    return reversedOrFailed;
  }
  return providerStatus !== "succeeded" && !reversedOrFailed;
}

/** Badge label and tone for an order's payment state, shared by the order list, details and sales tables. */
export function orderPaymentBadge(order: Pick<OrderSummary, "paymentMethod" | "paymentStatus" | "providerPaymentStatus">): {
  label: string;
  tone: BadgeTone;
} {
  if (order.paymentMethod === "cod") {
    return { label: paymentStatusLabel[order.paymentStatus], tone: paymentStatusTone[order.paymentStatus] };
  }
  const status = order.providerPaymentStatus;
  if (status === "succeeded") return { label: "مدفوع عبر باي موب", tone: "success" };
  if (status === "partially_refunded") return { label: "مسترد جزئيًا عبر باي موب", tone: "warning" };
  if (status === "refunded") return { label: "مسترد عبر باي موب", tone: "danger" };
  if (status === "failed") return { label: "فشل الدفع عبر باي موب", tone: "danger" };
  if (status === "voided") return { label: "أُلغي الدفع عبر باي موب", tone: "danger" };
  return { label: "قيد تأكيد باي موب", tone: "warning" };
}
