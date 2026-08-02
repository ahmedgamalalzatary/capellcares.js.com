import type { PaymentStatus } from "@capella/shared";

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
