export const carrierStateLabels: Record<string, string> = {
  created: "تم الإنشاء", picked_up: "تم الاستلام", in_transit: "في الطريق",
  delivered: "تم التسليم", returned: "تم الإرجاع", cancelled: "تم الإلغاء", exception: "تحتاج متابعة"
};

export const manualStateLabels: Record<string, string> = {
  preparing: "جارٍ التجهيز", ready_for_pickup: "جاهز للاستلام", printed: "تمت الطباعة",
  delivered: "تم التسليم", returned: "تم الإرجاع"
};

export const custodyLabels: Record<string, string> = {
  unknown: "الحيازة غير مؤكدة", carrier: "مع شركة الشحن",
  recipient: "تم التسليم للمستلم", warehouse_uninspected: "راجع للمخزن؛ بانتظار الفحص"
};

export const kindLabels: Record<string, string> = { outgoing: "صادرة", return: "مرتجع", exchange: "استبدال" };

export const sizeLabels: Record<string, string> = { small: "صغير", medium: "وسط", large: "كبير" };

export const flagLabels: Record<string, string> = {
  address_review: "مراجعة عنوان", expiry_review: "مراجعة المهلة", refund_review: "مراجعة استرداد",
  amount_mismatch: "اختلاف المبلغ", custody_review: "مراجعة الحيازة",
  cancellation_pending: "إلغاء قيد التأكيد", untouched_paid: "طلب مدفوع دون تجهيز"
};

export const workItemStatusLabels: Record<string, string> = {
  pending: "قيد الانتظار", processing: "قيد التنفيذ", succeeded: "تم", failed: "فشل", review_required: "يحتاج مراجعة"
};
