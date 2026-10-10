import { toast } from "sonner";

type AppError = Error & {
  status?: number;
  toastShown?: boolean;
  body?: {
    reason?: string;
    error?: string;
    message?: string;
  } | null;
};

const apiReasonMessages: Record<string, string> = {
  "linked-to-collections": "لا يمكن حذف المنتج لأنه مستخدم داخل مجموعة. عدّلي المجموعة أولًا ثم أعيدي المحاولة.",
  "linked-to-orders": "لا يمكن الحذف النهائي لأن العنصر مرتبط بطلبات سابقة.",
  "linked-entities": "لا يمكن حذف القسم نهائيًا لأنه ما زال مرتبطًا بأقسام أو منتجات أو عروض أو مجموعات.",
  "slug-conflict": "اسم القسم الإنجليزي مستخدم بالفعل. غيّري الاسم ثم أعيدي المحاولة.",
  "category-name-conflict": "اسم القسم مستخدم بالفعل داخل القسم الأب الحالي. غيّري الاسم أو اختاري قسمًا أبًا مختلفًا.",
  "has-products": "لا يمكن حذف القسم لأنه يحتوي على منتجات مرتبطة.",
  "has-active-children": "لا يمكن حذف القسم لأنه يحتوي على أقسام فرعية نشطة.",
  "product-slug-conflict": "اسم المنتج الإنجليزي مستخدم بالفعل لمنتج آخر (قد يكون في سلة المحذوفات). غيّري الاسم أو احذفي المنتج القديم نهائيًا.",
  "product-sku-conflict": "رمز المنتج (SKU) مستخدم بالفعل لمنتج آخر (قد يكون في سلة المحذوفات). غيّري الرمز أو احذفي المنتج القديم نهائيًا.",
  "offer-slug-conflict": "اسم العرض الإنجليزي مستخدم بالفعل لعرض آخر (قد يكون في سلة المحذوفات). غيّري الاسم أو احذفي العرض القديم نهائيًا.",
  "collection-slug-conflict": "اسم المجموعة الإنجليزي مستخدم بالفعل لمجموعة أخرى (قد تكون في سلة المحذوفات). غيّري الاسم أو احذفي المجموعة القديمة نهائيًا.",
  "cannot-activate-incomplete-offer": "لا يمكن تفعيل العرض قبل استكمال كل البيانات المطلوبة: الاسمان والقسم والسعر والصورة.",
  "cannot-activate-incomplete-collection": "لا يمكن تفعيل المجموعة قبل استكمال كل البيانات المطلوبة: الاسمان والقسم والسعر والصورة.",
  "cannot-activate-incomplete-product": "لا يمكن تفعيل المنتج قبل استكمال كل البيانات المطلوبة.",
  "linked-to-offers": "لا يمكن حذف المنتج أو حذف أحد مقاساته لأنه مستخدم داخل عرض. عدّلي العرض أولًا ثم أعيدي المحاولة.",
  "discount-exceeds-price": "لا يمكن تطبيق الخصم لأن سعر أحد العناصر المختارة لا يسمح به.",
  "item-not-found": "تغيّرت العناصر المختارة. حدّثي الصفحة وراجعي الاختيار.",
  "category-not-found": "تغيّر أحد الأقسام المختارة. حدّثي الصفحة وراجعي الاختيار.",
  "empty-selection": "اختاري عنصرًا واحدًا على الأقل لتطبيق الخصم.",
  "invalid-discount-input": "راجعي قيمة الخصم وموعد بدايته ونهايته."
};

export function getErrorMessage(error: unknown, fallback = "حدث خطأ غير متوقع. حاولي مرة أخرى."): string {
  const appError = error as AppError | null | undefined;
  const reason = appError?.body?.reason;

  if (reason && apiReasonMessages[reason]) {
    return apiReasonMessages[reason];
  }

  if (typeof appError?.body?.message === "string" && appError.body.message.trim()) {
    return appError.body.message;
  }

  if (typeof appError?.body?.error === "string" && appError.body.error.trim()) {
    return appError.body.error;
  }

  if (appError?.status === 401) {
    return "انتهت صلاحية الجلسة. سجّلي الدخول مرة أخرى.";
  }

  if (appError instanceof Error && appError.message.trim()) {
    return appError.message;
  }

  return fallback;
}

export function showErrorToast(error: unknown, fallback?: string) {
  const appError = error as AppError | null | undefined;
  if (appError?.toastShown) {
    return getErrorMessage(error, fallback);
  }

  const message = getErrorMessage(error, fallback);
  if (appError) {
    appError.toastShown = true;
  }
  toast.error(message);
  return message;
}
