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
