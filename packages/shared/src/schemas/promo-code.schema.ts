import { z } from "zod";

// Promo code creation rules shared by the API and the ERP (docs/promo-codes-spec.md sections 3 and 8).
// Error messages are stable keys ("promo.*") that the ERP maps to Arabic text.

/** Characters for generated codes: no 0/O and no 1/I/L, which customers confuse when typing. */
export const PROMO_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PROMO_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

/** The form codes are stored and matched in: trimmed and upper-case, so "summer20" and " SUMMER20 " are the same code. */
export function normalizePromoCode(value: string): string {
  return value.trim().toUpperCase();
}

export function generatePromoCode(length = 8): string {
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => PROMO_CODE_ALPHABET[value % PROMO_CODE_ALPHABET.length]).join("");
}

export const PROMO_TARGET_TYPES = ["category", "product", "variant", "offer", "collection"] as const;
export const PROMO_GIFT_ITEM_TYPES = ["product_variant", "offer", "collection"] as const;
export const PROMO_CODE_STATUSES = ["active", "paused", "stopped"] as const;
export type PromoCodeStatus = (typeof PROMO_CODE_STATUSES)[number];

const promoTargetSchema = z.object({ type: z.enum(PROMO_TARGET_TYPES), id: z.number().int().positive() }).strict();
// Amounts are stored as DECIMAL(10,3) (Kuwaiti dinars with fils) and counts as signed INT: anything finer or larger would
// round to another value or fail to save.
const MAX_AMOUNT = 9_999_999.999;
const MAX_COUNT = 2_147_483_647;
const isStorableAmount = (value: number) => value === 0 ||
  (Math.abs(value) >= 0.001 && Math.abs(value) <= MAX_AMOUNT && Math.abs(Math.round(value * 1000) - value * 1000) < 1e-6);
const money = (message?: string) => z.number().finite().refine(isStorableAmount, message ? { message } : undefined);
const count = z.number().int().min(1).max(MAX_COUNT).nullable();
const isoDate = z.string().datetime({ offset: true }).nullable();

export const promoCodeCreateSchema = z.object({
  code: z.string().transform(normalizePromoCode),
  arName: z.string().trim().min(1).max(255),
  enName: z.string().trim().min(1).max(255),
  startsAt: isoDate,
  endsAt: isoDate,
  discountType: z.enum(["percentage", "fixed"]).nullable(),
  discountValue: money("promo.discount_value_invalid").nullable(),
  maxDiscountAmount: money("promo.cap_invalid").nullable(),
  freeShipping: z.boolean(),
  gift: z.object({ itemType: z.enum(PROMO_GIFT_ITEM_TYPES), itemId: z.number().int().positive(), qty: z.number().int().min(1).max(MAX_COUNT) }).strict().nullable(),
  eligibility: z.object({
    scope: z.enum(["all", "selected"]),
    include: z.array(promoTargetSchema).max(500),
    exclude: z.array(promoTargetSchema).max(500)
  }).strict(),
  minOrderAmount: money().pipe(z.number().min(0)).nullable(),
  maxOrderAmount: money().pipe(z.number().min(0)).nullable(),
  minEligiblePieces: count,
  maxDiscountedPieces: count,
  totalUsageLimit: count,
  perCustomerLimit: count,
  firstOrderOnly: z.boolean(),
  isPrivate: z.boolean(),
  customerIds: z.array(z.number().int().positive()).max(5000)
}).strict().superRefine((value, ctx) => {
  const fail = (message: string, path: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

  if (!PROMO_CODE_PATTERN.test(value.code)) fail("promo.code_invalid", "code");
  if (!value.discountType && !value.freeShipping && !value.gift) fail("promo.benefit_required", "discountType");

  if (value.discountType === "percentage") {
    if (value.discountValue === null || value.discountValue <= 0 || value.discountValue > 100) fail("promo.discount_value_invalid", "discountValue");
  } else if (value.discountType === "fixed") {
    if (value.discountValue === null || value.discountValue <= 0) fail("promo.discount_value_invalid", "discountValue");
  } else if (value.discountValue !== null) {
    fail("promo.discount_value_invalid", "discountValue");
  }
  if (value.maxDiscountAmount !== null) {
    if (value.discountType !== "percentage") fail("promo.cap_percentage_only", "maxDiscountAmount");
    else if (value.maxDiscountAmount <= 0) fail("promo.cap_invalid", "maxDiscountAmount");
  }

  if (value.eligibility.scope === "selected" && value.eligibility.include.length === 0) fail("promo.targets_required", "eligibility");
  if (value.minOrderAmount !== null && value.maxOrderAmount !== null && value.maxOrderAmount < value.minOrderAmount) {
    fail("promo.amount_range_invalid", "maxOrderAmount");
  }
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) fail("promo.schedule_invalid", "endsAt");

  if (value.isPrivate && value.customerIds.length === 0) fail("promo.customers_required", "customerIds");
  if (!value.isPrivate && value.customerIds.length > 0) fail("promo.customers_private_only", "customerIds");
});

export type PromoCodeCreateInput = z.infer<typeof promoCodeCreateSchema>;
export type PromoTargetInput = z.infer<typeof promoTargetSchema>;

export const promoCodeStatusChangeSchema = z.object({ action: z.enum(["pause", "resume", "stop"]) }).strict();
export type PromoCodeStatusAction = z.infer<typeof promoCodeStatusChangeSchema>["action"];
