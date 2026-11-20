import {
  promoCodeCreateSchema,
  type PromoCodeCreateInput,
  type PromoCodeStatus,
  type PromoTargetInput
} from "@capella/shared";
import { formatMoney, formatNumber } from "@/lib/format";

export type PromoCustomer = { id: number; name: string; email: string };
export type PromoGiftType = "product_variant" | "offer" | "collection";

export type PromoCodeSummary = {
  id: number;
  code: string;
  arName: string;
  enName: string;
  status: PromoCodeStatus;
  startsAt: string;
  endsAt: string | null;
  discountType: "percentage" | "fixed" | null;
  discountValue: number | null;
  maxDiscountAmount: number | null;
  freeShipping: boolean;
  gift: { itemType: PromoGiftType; itemId: number; qty: number } | null;
  eligibilityScope: "all" | "selected";
  minOrderAmount: number | null;
  maxOrderAmount: number | null;
  minEligiblePieces: number | null;
  maxDiscountedPieces: number | null;
  totalUsageLimit: number | null;
  perCustomerLimit: number | null;
  firstOrderOnly: boolean;
  isPrivate: boolean;
  showInAccount: boolean;
  createdAt: string;
  usage: { used: number; released: number };
};

export type PromoCodeDetail = PromoCodeSummary & {
  eligibility: { scope: "all" | "selected"; include: PromoTargetInput[]; exclude: PromoTargetInput[] };
  customers: PromoCustomer[];
  events: Array<{ action: "created" | "paused" | "resumed" | "stopped"; adminName: string | null; createdAt: string }>;
};

export type PromoFormState = {
  code: string;
  arName: string;
  enName: string;
  /** datetime-local values, in Kuwait time. */
  startsAt: string;
  endsAt: string;
  discountType: "" | "percentage" | "fixed";
  discountValue: string;
  maxDiscountAmount: string;
  freeShipping: boolean;
  giftEnabled: boolean;
  giftItemType: PromoGiftType;
  giftItemId: string;
  giftQty: string;
  scope: "all" | "selected";
  include: PromoTargetInput[];
  exclude: PromoTargetInput[];
  minOrderAmount: string;
  maxOrderAmount: string;
  minEligiblePieces: string;
  maxDiscountedPieces: string;
  totalUsageLimit: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  isPrivate: boolean;
  customers: PromoCustomer[];
};

export function createEmptyPromoForm(): PromoFormState {
  return {
    code: "", arName: "", enName: "", startsAt: "", endsAt: "",
    discountType: "", discountValue: "", maxDiscountAmount: "", freeShipping: false,
    giftEnabled: false, giftItemType: "product_variant", giftItemId: "", giftQty: "1",
    scope: "all", include: [], exclude: [],
    minOrderAmount: "", maxOrderAmount: "", minEligiblePieces: "", maxDiscountedPieces: "",
    totalUsageLimit: "", perCustomerLimit: "", firstOrderOnly: false, isPrivate: false, customers: []
  };
}

const PROMO_ERRORS: Record<string, string> = {
  "promo.code_invalid": "الكود من 3 إلى 32 حرفًا إنجليزيًا أو رقمًا، ويمكن أن يحتوي على - أو _ بدون مسافات.",
  "promo.code_taken": "هذا الكود مستخدم من قبل. اختاري كودًا آخر.",
  "promo.benefit_required": "اختاري ميزة واحدة على الأقل: خصم، أو توصيل مجاني، أو هدية.",
  "promo.discount_value_invalid": "قيمة الخصم غير صالحة: النسبة بين 1 و100، والمبلغ أكبر من صفر.",
  "promo.cap_percentage_only": "الحد الأقصى للخصم متاح لخصم النسبة فقط.",
  "promo.cap_invalid": "الحد الأقصى للخصم يجب أن يكون أكبر من صفر.",
  "promo.targets_required": "اختاري قسمًا أو منتجًا أو عرضًا أو مجموعة واحدة على الأقل.",
  "promo.amount_range_invalid": "الحد الأقصى لقيمة الطلب يجب ألا يقل عن الحد الأدنى.",
  "promo.schedule_invalid": "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.",
  "promo.schedule_ended": "تاريخ الانتهاء مرّ بالفعل.",
  "promo.customers_required": "اختاري عميلًا واحدًا على الأقل للكود الخاص.",
  "promo.customers_private_only": "العملاء المحددون متاحون للكود الخاص فقط.",
  "promo.target_missing": "أحد الأقسام أو المنتجات المختارة لم يعد موجودًا.",
  "promo.gift_missing": "الهدية المختارة لم تعد موجودة.",
  "promo.customer_missing": "أحد العملاء المختارين لم يعد موجودًا.",
  "promo.status_transition_invalid": "لا يمكن تغيير حالة الكود بهذا الشكل.",
  "promo.not_found": "الكود غير موجود."
};

export function promoErrorMessage(key: string): string {
  return PROMO_ERRORS[key] ?? "تعذر حفظ الكود. راجعي البيانات وحاولي مرة أخرى.";
}

const NUMBER_FIELDS = {
  discountValue: "قيمة الخصم",
  maxDiscountAmount: "الحد الأقصى للخصم",
  minOrderAmount: "الحد الأدنى للطلب",
  maxOrderAmount: "الحد الأقصى للطلب",
  minEligiblePieces: "أقل عدد قطع",
  maxDiscountedPieces: "أقصى عدد قطع مخفضة",
  totalUsageLimit: "حد الاستخدام الكلي",
  perCustomerLimit: "الحد لكل عميل",
  giftQty: "كمية الهدية"
} as const;

// Schedules are typed and shown in Kuwait time, never the browser's own zone. Kuwait is UTC+3 all year (no summer time).
const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;
const pad = (part: number) => String(part).padStart(2, "0");

/** The UTC instant (ISO) for a datetime-local value read as Kuwait time; null when the value is not a real date and time. */
export function instantFromKuwaitInput(value: string): string | null {
  const [date, time] = value.split("T");
  const [year, month, day] = (date ?? "").split("-").map(Number);
  const [hour, minute] = (time ?? "00:00").split(":").map(Number);
  const wall = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  if (!Number.isFinite(wall)) return null;
  const instant = new Date(wall - KUWAIT_OFFSET_MS).toISOString();
  return kuwaitInputFromInstant(instant) === `${date}T${pad(hour!)}:${pad(minute!)}` ? instant : null;
}

/** A datetime-local value showing an instant in Kuwait time. */
export function kuwaitInputFromInstant(value: string): string {
  const seen = new Date(new Date(value).getTime() + KUWAIT_OFFSET_MS);
  return `${seen.getUTCFullYear()}-${pad(seen.getUTCMonth() + 1)}-${pad(seen.getUTCDate())}T${pad(seen.getUTCHours())}:${pad(seen.getUTCMinutes())}`;
}

const FIELD_LABELS: Record<string, string> = { ...NUMBER_FIELDS, gift: "الهدية", startsAt: "تاريخ البداية", endsAt: "تاريخ الانتهاء" };

/** The API payload for the form, or the Arabic reasons it cannot be saved yet. */
export function validatePromoForm(form: PromoFormState): { payload: PromoCodeCreateInput | null; errors: string[] } {
  const errors: string[] = [];
  const num = (key: keyof typeof NUMBER_FIELDS): number | null => {
    const text = form[key].trim();
    if (!text) return null;
    const value = Number(text);
    if (!Number.isFinite(value)) {
      errors.push(`قيمة غير صالحة: ${NUMBER_FIELDS[key]}.`);
      return null;
    }
    return value;
  };
  const instant = (value: string) => {
    if (!value) return null;
    const result = instantFromKuwaitInput(value);
    if (!result) errors.push(`الوقت ${value.replace("T", " ")} غير صالح. اختاري تاريخًا ووقتًا آخر.`);
    return result;
  };

  const raw = {
    code: form.code,
    arName: form.arName,
    enName: form.enName,
    startsAt: instant(form.startsAt),
    endsAt: instant(form.endsAt),
    discountType: form.discountType || null,
    discountValue: form.discountType ? num("discountValue") : null,
    maxDiscountAmount: form.discountType === "percentage" ? num("maxDiscountAmount") : null,
    freeShipping: form.freeShipping,
    gift: form.giftEnabled ? { itemType: form.giftItemType, itemId: Number(form.giftItemId), qty: num("giftQty") ?? 0 } : null,
    eligibility: form.scope === "all" ? { scope: "all", include: [], exclude: form.exclude } : { scope: "selected", include: form.include, exclude: form.exclude },
    minOrderAmount: num("minOrderAmount"),
    maxOrderAmount: num("maxOrderAmount"),
    minEligiblePieces: num("minEligiblePieces"),
    maxDiscountedPieces: num("maxDiscountedPieces"),
    totalUsageLimit: num("totalUsageLimit"),
    perCustomerLimit: num("perCustomerLimit"),
    firstOrderOnly: form.firstOrderOnly,
    isPrivate: form.isPrivate,
    customerIds: form.isPrivate ? form.customers.map((customer) => customer.id) : []
  };
  if (errors.length > 0) return { payload: null, errors };

  const parsed = promoCodeCreateSchema.safeParse(raw);
  if (parsed.success) return { payload: parsed.data, errors: [] };
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    const message = issue.message.startsWith("promo.")
      ? promoErrorMessage(issue.message)
      : field === "arName" || field === "enName"
        ? "أدخلي الاسم بالعربية والإنجليزية."
        : `قيمة غير صالحة: ${FIELD_LABELS[field] ?? field}.`;
    if (!errors.includes(message)) errors.push(message);
  }
  return { payload: null, errors };
}

const text = (value: number | null) => (value === null ? "" : String(value));

const localInput = (value: string | null) => (value ? kuwaitInputFromInstant(value) : "");

/** Starting values for "Duplicate as new": every rule copied; the code text and schedule left for the new code. */
export function promoFormFromCode(code: PromoCodeDetail, options: { keepSchedule?: boolean } = {}): PromoFormState {
  return {
    code: "",
    arName: code.arName,
    enName: code.enName,
    startsAt: options.keepSchedule ? localInput(code.startsAt) : "",
    endsAt: options.keepSchedule ? localInput(code.endsAt) : "",
    discountType: code.discountType ?? "",
    discountValue: text(code.discountValue),
    maxDiscountAmount: text(code.maxDiscountAmount),
    freeShipping: code.freeShipping,
    giftEnabled: code.gift !== null,
    giftItemType: code.gift?.itemType ?? "product_variant",
    giftItemId: code.gift ? String(code.gift.itemId) : "",
    giftQty: code.gift ? String(code.gift.qty) : "1",
    scope: code.eligibility.scope,
    include: code.eligibility.include,
    exclude: code.eligibility.exclude,
    minOrderAmount: text(code.minOrderAmount),
    maxOrderAmount: text(code.maxOrderAmount),
    minEligiblePieces: text(code.minEligiblePieces),
    maxDiscountedPieces: text(code.maxDiscountedPieces),
    totalUsageLimit: text(code.totalUsageLimit),
    perCustomerLimit: text(code.perCustomerLimit),
    firstOrderOnly: code.firstOrderOnly,
    isPrivate: code.isPrivate,
    customers: code.customers
  };
}

export function describePromoBenefits(code: Pick<PromoCodeSummary, "discountType" | "discountValue" | "maxDiscountAmount" | "freeShipping" | "gift">): string[] {
  const benefits: string[] = [];
  if (code.discountType === "percentage" && code.discountValue !== null) {
    benefits.push(`خصم ${formatNumber(code.discountValue)}%${code.maxDiscountAmount !== null ? `، بحد أقصى ${formatMoney(code.maxDiscountAmount)}` : ""}`);
  } else if (code.discountType === "fixed" && code.discountValue !== null) {
    benefits.push(`خصم ${formatMoney(code.discountValue)}`);
  }
  if (code.freeShipping) benefits.push("توصيل مجاني");
  if (code.gift) benefits.push("هدية مجانية");
  return benefits;
}

export const PROMO_STATUS_LABELS: Record<PromoCodeStatus, string> = { active: "نشط", paused: "متوقف مؤقتًا", stopped: "منتهٍ" };
export const PROMO_STATUS_TONES: Record<PromoCodeStatus, "success" | "warning" | "neutral"> = { active: "success", paused: "warning", stopped: "neutral" };

export const PROMO_EVENT_LABELS: Record<PromoCodeDetail["events"][number]["action"], string> = {
  created: "إنشاء", paused: "إيقاف مؤقت", resumed: "استئناف", stopped: "إنهاء"
};
