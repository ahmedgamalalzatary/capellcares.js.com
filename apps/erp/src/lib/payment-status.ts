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

/** Badge label and tone for an order's payment state, shared by the order list, details and sales tables. */
export function orderPaymentBadge(order: Pick<OrderSummary, "paymentStatus">): {
  label: string;
  tone: BadgeTone;
} {
  return { label: paymentStatusLabel[order.paymentStatus], tone: paymentStatusTone[order.paymentStatus] };
}
