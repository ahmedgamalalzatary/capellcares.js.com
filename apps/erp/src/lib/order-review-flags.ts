import type { AdminOrderReviewFlagDto } from "@capella/shared";

export const flagTitles: Record<AdminOrderReviewFlagDto["flagType"], string> = {
  address_review: "مشكلة في عنوان الطلب",
  expiry_review: "مهلة الطلب انتهت وتحتاج مراجعة",
  refund_review: "استرداد يحتاج مراجعة",
  amount_mismatch: "المبلغ المحصل لا يطابق الطلب",
  custody_review: "حيازة الشحنة غير مؤكدة",
  cancellation_pending: "تأكيد الإلغاء معلق",
  untouched_paid: "طلب مدفوع تجاوز 96 ساعة دون تجهيز"
};
