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
  "slug-conflict": "اسم القسم الإنجليزي مستخدم بالفعل. غيّر الاسم ثم أعد المحاولة.",
  "category-name-conflict": "اسم القسم مستخدم بالفعل داخل القسم الأب الحالي. غيّر الاسم أو اختر قسمًا أبًا مختلفًا.",
  "category-image-depth-invalid": "صورة القسم مسموحة فقط للأقسام الرئيسية وأقسام المستوى الأول.",
  "has-products": "لا يمكن حذف القسم لأنه يحتوي على منتجات مرتبطة.",
  "has-active-children": "لا يمكن حذف القسم لأنه يحتوي على أقسام فرعية نشطة.",
  "cannot-activate-incomplete-product": "لا يمكن تفعيل المنتج قبل استكمال كل البيانات المطلوبة.",
  "linked-to-offers": "لا يمكن حذف المنتج أو حذف أحد مقاساته لأنه مستخدم داخل عرض. عدّل العرض أولًا ثم أعد المحاولة."
};

export function getErrorMessage(error: unknown, fallback = "حدث خطأ غير متوقع. حاول مرة أخرى."): string {
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
    return "انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى.";
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
