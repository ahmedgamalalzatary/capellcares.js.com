// Promo codes at checkout (docs/promo-codes-spec.md sections 4-6). evaluateCheckoutPromo prices a code against the cart
// (advisory: cart preview, shipping quote, checkout submit); lockAndRecheckPromo + recordPromoUse are the binding check
// that runs inside the transaction creating the order, under a row lock on the code, so a limited code can never be
// used more times than allowed however many customers submit at once.
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { categories, orders, promoCodeCustomers, promoCodes, promoCodeTargets, promoRedemptions } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { normalizeEgyptianPhone, normalizePromoCode, type PromoAppliedDto, type PromoRejectionDto } from "@capella/shared";
import {
  applyPromoPricing,
  validatePromoAccess,
  type PromoAccessFailure,
  type PromoLine,
  type PromoPricingResult,
  type PromoRules,
  type PromoTarget
} from "./promo-pricing.js";

type Executor = Pick<typeof db, "select" | "insert" | "update">;
type PromoCodeRow = typeof promoCodes.$inferSelect;

export class PromoRejectedError extends Error {
  constructor(public readonly rejection: PromoRejectionDto) {
    super(`Promo code rejected: ${rejection.reason}`);
  }
}

/** One priced checkout line as produced by priceCheckout, before the code. */
export type PromoPricedItem = {
  itemType: "product_variant" | "offer" | "collection";
  variantId: number | null;
  offerId: number | null;
  collectionId?: number | null;
  productId?: number | null;
  categoryId?: number | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  snapshotNameAr: string;
  snapshotNameEn: string;
  snapshotBaseUnitPrice: number | null;
  snapshotDiscountId: number | null;
};

/** What the order (or Paymob session) stores about the code it used. */
export type PromoApplication = {
  codeId: number;
  codeText: string;
  discountCents: number;
  saleGivenUpCents: number;
  freeShipping: boolean;
  snapshot: string;
  customerId: number;
  phone: string | null;
};

export type PromoEvaluation =
  | { status: "applied"; code: PromoCodeRow; result: Extract<PromoPricingResult, { ok: true }>; dto: PromoAppliedDto; application: PromoApplication }
  | { status: "rejected"; dto: PromoRejectionDto };

const rejection = (code: string, failure: PromoAccessFailure | Exclude<PromoPricingResult, { ok: true }>): PromoRejectionDto => {
  if (typeof failure === "string") return { status: "rejected", code, reason: failure };
  const { ok: _ok, ...rest } = failure;
  return { status: "rejected", code, ...rest };
};

async function loadCode(codeText: string, executor: Executor = db, lock = false) {
  const query = executor.select().from(promoCodes).where(eq(promoCodes.codeNormalized, normalizePromoCode(codeText))).limit(1);
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

/** Reserved plus used redemptions: everyone's, and this customer's by account or by phone (so a re-created account still counts). */
async function usageCounts(executor: Executor, codeId: number, customerId: number, phone: string | null) {
  const live = and(eq(promoRedemptions.promoCodeId, codeId), inArray(promoRedemptions.state, ["reserved", "used"]));
  const mine = phone ? or(eq(promoRedemptions.customerId, customerId), eq(promoRedemptions.phoneNormalized, phone)) : eq(promoRedemptions.customerId, customerId);
  const [[total], [own]] = await Promise.all([
    executor.select({ count: sql<number>`count(*)` }).from(promoRedemptions).where(live),
    executor.select({ count: sql<number>`count(*)` }).from(promoRedemptions).where(and(live, mine))
  ]);
  return { usedTotal: Number(total?.count ?? 0), usedByCustomer: Number(own?.count ?? 0) };
}

/** Any earlier order by this account or this checkout phone, whatever happened to it (cancelled, denied and expired count). */
async function hasPreviousOrder(executor: Executor, customerId: number, phone: string | null) {
  const match = phone ? or(eq(orders.customerId, customerId), eq(orders.phone, phone)) : eq(orders.customerId, customerId);
  const [row] = await executor.select({ id: orders.id }).from(orders).where(match).limit(1);
  return Boolean(row);
}

async function isOnPrivateList(executor: Executor, codeId: number, customerId: number) {
  const [row] = await executor.select({ id: promoCodeCustomers.id }).from(promoCodeCustomers)
    .where(and(eq(promoCodeCustomers.promoCodeId, codeId), eq(promoCodeCustomers.customerId, customerId))).limit(1);
  return Boolean(row);
}

async function accessFailure(executor: Executor, code: PromoCodeRow | null, customerId: number | null, phone: string | null, now: Date) {
  if (customerId === null || !code) return validatePromoAccess(code, { customerId, now, onPrivateList: false, hasPreviousOrder: false, usedTotal: 0, usedByCustomer: 0 });
  const [counts, previous, listed] = await Promise.all([
    usageCounts(executor, code.id, customerId, phone),
    code.firstOrderOnly ? hasPreviousOrder(executor, customerId, phone) : Promise.resolve(false),
    code.isPrivate ? isOnPrivateList(executor, code.id, customerId) : Promise.resolve(false)
  ]);
  return validatePromoAccess(code, { customerId, now, onPrivateList: listed, hasPreviousOrder: previous, ...counts });
}

async function loadRules(code: PromoCodeRow): Promise<PromoRules> {
  const targets = await db.select({ type: promoCodeTargets.targetType, id: promoCodeTargets.targetId, mode: promoCodeTargets.mode })
    .from(promoCodeTargets).where(eq(promoCodeTargets.promoCodeId, code.id));
  const pick = (mode: "include" | "exclude"): PromoTarget[] => targets.filter((target) => target.mode === mode).map(({ type, id }) => ({ type, id }));
  const amount = (value: string | null) => (value === null ? null : Number(value));
  return {
    discountType: code.discountType,
    discountValue: amount(code.discountValue),
    maxDiscountAmount: amount(code.maxDiscountAmount),
    freeShipping: code.freeShipping,
    hasGift: code.giftItemType !== null,
    eligibility: { scope: code.eligibilityScope, include: pick("include"), exclude: pick("exclude") },
    minOrderAmount: amount(code.minOrderAmount),
    maxOrderAmount: amount(code.maxOrderAmount),
    minEligiblePieces: code.minEligiblePieces,
    maxDiscountedPieces: code.maxDiscountedPieces
  };
}

/** Each category with all of its ancestors, so a code on a parent category covers products in its sub-categories. */
async function categoryLineages(categoryIds: number[]) {
  const lineages = new Map<number, number[]>();
  if (categoryIds.length === 0) return lineages;
  const rows = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories);
  const parent = new Map(rows.map((row) => [row.id, row.parentId]));
  for (const id of new Set(categoryIds)) {
    const lineage: number[] = [];
    let current: number | null | undefined = id;
    while (current != null && !lineage.includes(current)) {
      lineage.push(current);
      current = parent.get(current);
    }
    lineages.set(id, lineage);
  }
  return lineages;
}

export async function evaluateCheckoutPromo(input: {
  promoCode: string;
  customerId: number | null;
  phone?: string | null;
  items: PromoPricedItem[];
  now?: Date;
  /** Delivery can be charged for this checkout, so a free-shipping benefit means something. */
  shippingAvailable?: boolean;
}): Promise<PromoEvaluation> {
  const now = input.now ?? new Date();
  const codeText = normalizePromoCode(input.promoCode);
  const phone = input.phone ? normalizeEgyptianPhone(input.phone) : null;
  const code = input.customerId === null ? null : await loadCode(codeText);
  const failure = await accessFailure(db, code, input.customerId, phone, now);
  if (failure || !code) return { status: "rejected", dto: rejection(codeText, failure ?? "not_found") };

  const lineages = await categoryLineages(input.items.flatMap((item) => (item.categoryId ? [item.categoryId] : [])));
  const lines: PromoLine[] = input.items.map((item, index) => ({
    key: String(index),
    itemType: item.itemType,
    variantId: item.variantId,
    productId: item.productId ?? null,
    categoryIds: item.categoryId ? lineages.get(item.categoryId) ?? [item.categoryId] : [],
    offerId: item.offerId,
    collectionId: item.collectionId ?? null,
    qty: item.qty,
    originalUnitPrice: item.snapshotBaseUnitPrice ?? item.unitPrice,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    saleDiscountId: item.snapshotDiscountId
  }));
  const rules = await loadRules(code);
  // Free shipping (phase 5) and the gift (phase 6) are not offered yet: a code still applies its discount without them.
  const result = applyPromoPricing(rules, lines, { shippingAvailable: false, giftAvailable: false });
  if (!result.ok) return { status: "rejected", dto: rejection(codeText, result) };

  const dto: PromoAppliedDto = {
    status: "applied",
    code: code.code,
    arName: code.arName,
    enName: code.enName,
    discount: result.discountCents / 100,
    saleGivenUp: result.saleGivenUpCents / 100,
    freeShipping: result.freeShipping,
    replacedSales: result.replacedSales.map((sale) => {
      const item = input.items[Number(sale.key)]!;
      return { index: Number(sale.key), nameAr: item.snapshotNameAr, nameEn: item.snapshotNameEn, previousLineTotal: sale.previousLineTotal, lineTotal: sale.lineTotal };
    })
  };
  const snapshot = JSON.stringify({
    id: code.id, code: code.code, rules, startsAt: code.startsAt, endsAt: code.endsAt,
    firstOrderOnly: code.firstOrderOnly, isPrivate: code.isPrivate,
    discountCents: result.discountCents, saleGivenUpCents: result.saleGivenUpCents, replacedSales: dto.replacedSales
  });
  return {
    status: "applied",
    code,
    result,
    dto,
    application: {
      codeId: code.id,
      codeText: code.code,
      discountCents: result.discountCents,
      saleGivenUpCents: result.saleGivenUpCents,
      freeShipping: result.freeShipping,
      snapshot,
      customerId: input.customerId!,
      phone
    }
  };
}

/** The binding check, inside the order transaction: locks the code row, then re-checks status, schedule, lists and limits with fresh counts. */
export async function lockAndRecheckPromo(tx: Executor, application: PromoApplication, now = new Date()) {
  const [code] = await tx.select().from(promoCodes).where(eq(promoCodes.id, application.codeId)).limit(1).for("update");
  const failure = await accessFailure(tx, code ?? null, application.customerId, application.phone, now);
  if (failure) throw new PromoRejectedError({ status: "rejected", code: application.codeText, reason: failure });
}

export async function recordPromoUse(tx: Executor, application: PromoApplication, orderId: number) {
  await tx.insert(promoRedemptions).values({
    promoCodeId: application.codeId,
    customerId: application.customerId,
    phoneNormalized: application.phone,
    orderId,
    state: "used",
    discountCents: application.discountCents
  });
}

/** Gives a used code back when its order is denied, expires or completes cancellation (spec section 6.1). Partial returns never call this. */
export async function releasePromoUse(tx: Executor, orderId: number, reason: "cancelled" | "denied" | "expired") {
  await tx.update(promoRedemptions).set({ state: "released", releaseReason: reason })
    .where(and(eq(promoRedemptions.orderId, orderId), eq(promoRedemptions.state, "used")));
}
