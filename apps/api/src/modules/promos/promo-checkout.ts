// Promo codes at checkout (docs/promo-codes-spec.md sections 4-6). evaluateCheckoutPromo prices a code against the cart
// (advisory: cart price, checkout quote, checkout submit); lockAndRecheckPromo + recordPromoUse are the binding check
// that runs inside the transaction creating the order, under a row lock on the code, so a limited code can never be
// used more times than allowed however many customers submit at once. This store takes cash on delivery only, so a use
// is counted when the order is placed and given back when the order is denied, cancelled or expires.
import { and, asc, eq, or, sql } from "drizzle-orm";
import { categories, customers, orders, promoCodeCustomers, promoCodes, promoCodeTargets, promoRedemptions } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { normalizeKuwaitiPhone, normalizePromoCode, type PromoAppliedDto, type PromoRejectionDto } from "@capella/shared";
import {
  applyPromoPricing,
  fromFils,
  toFils,
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

/** The code now replaces sales the customer has not confirmed at these exact prices: checkout waits for a fresh confirmation. */
export class PromoConfirmationRequiredError extends Error {
  constructor(public readonly promo: PromoAppliedDto) {
    super("Confirm the code's new prices before ordering");
  }
}

/** Every sale the code replaces must be one the customer confirmed, for the same item and the same before and after prices. */
export function requireConfirmedSales(promo: PromoAppliedDto, accepted: Array<{ item: string; previousLineTotal: number; lineTotal: number }> = []) {
  const confirmed = (sale: PromoAppliedDto["replacedSales"][number]) => accepted.some((entry) => entry.item === sale.item &&
    toFils(entry.previousLineTotal) === toFils(sale.previousLineTotal) && toFils(entry.lineTotal) === toFils(sale.lineTotal));
  if (!promo.replacedSales.every(confirmed)) throw new PromoConfirmationRequiredError(promo);
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

/** What the order stores about the code it used. */
export type PromoApplication = {
  codeId: number;
  codeText: string;
  discountFils: number;
  saleGivenUpFils: number;
  freeShipping: boolean;
  /** First-order codes are checked one at a time across all of them (see lockAndRecheckPromo). */
  firstOrderOnly: boolean;
  /** The gift's normal price for the quantity given, for reports; 0 without a gift. */
  giftValueFils: number;
  snapshot: string;
  customerId: number;
  phone: string | null;
};

/** The code's gift as a priced line (0) with the stock it takes, or null when it cannot be given now. */
export type PromoGiftOffer = (gift: { itemType: "product_variant" | "offer" | "collection"; itemId: number; qty: number }) =>
  Promise<{ line: PromoPricedItem & { snapshotBaseUnitPrice: number | null }; needs: Map<number, number> } | null>;

export type PromoEvaluation =
  | { status: "applied"; code: PromoCodeRow; result: Extract<PromoPricingResult, { ok: true }>; dto: PromoAppliedDto; application: PromoApplication;
    gift: Awaited<ReturnType<PromoGiftOffer>> }
  | { status: "rejected"; dto: PromoRejectionDto };

const rejection = (code: string, failure: PromoAccessFailure | Exclude<PromoPricingResult, { ok: true }>): PromoRejectionDto => {
  if (typeof failure === "string") return { status: "rejected", code, reason: failure };
  const { ok: _ok, ...rest } = failure;
  return { status: "rejected", code, ...rest };
};

async function loadCode(codeText: string, executor: Executor = db) {
  const [row] = await executor.select().from(promoCodes).where(eq(promoCodes.codeNormalized, normalizePromoCode(codeText))).limit(1);
  return row ?? null;
}

/** This account's uses, or this phone's (so a re-created account still counts). */
const ownUses = (customerId: number, phone: string | null) =>
  phone ? or(eq(promoRedemptions.customerId, customerId), eq(promoRedemptions.phoneNormalized, phone)) : eq(promoRedemptions.customerId, customerId);

/** Used redemptions: everyone's, and this customer's by account or by phone. */
async function usageCounts(executor: Executor, codeId: number, customerId: number, phone: string | null) {
  const live = and(eq(promoRedemptions.promoCodeId, codeId), eq(promoRedemptions.state, "used"));
  const count = { live: sql<number>`count(*)` };
  const [[total], [own]] = await Promise.all([
    executor.select(count).from(promoRedemptions).where(live),
    executor.select(count).from(promoRedemptions).where(and(live, ownUses(customerId, phone)))
  ]);
  return { usedTotal: Number(total?.live ?? 0), usedByCustomer: Number(own?.live ?? 0) };
}

/** Live uses of any first-order code by this account or phone: a first-order discount is one per customer, whichever code gave it. */
async function firstOrderUses(executor: Executor, customerId: number, phone: string | null) {
  const [row] = await executor.select({ live: sql<number>`count(*)` })
    .from(promoRedemptions).innerJoin(promoCodes, eq(promoCodes.id, promoRedemptions.promoCodeId))
    .where(and(eq(promoCodes.firstOrderOnly, true), eq(promoRedemptions.state, "used"), ownUses(customerId, phone)));
  return Number(row?.live ?? 0);
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
  const [counts, previous, listed, firstOrder] = await Promise.all([
    usageCounts(executor, code.id, customerId, phone),
    code.firstOrderOnly ? hasPreviousOrder(executor, customerId, phone) : Promise.resolve(false),
    code.isPrivate ? isOnPrivateList(executor, code.id, customerId) : Promise.resolve(false),
    code.firstOrderOnly ? firstOrderUses(executor, customerId, phone) : Promise.resolve(0)
  ]);
  const failure = validatePromoAccess(code, { customerId, now, onPrivateList: listed, hasPreviousOrder: previous,
    usedTotal: counts.usedTotal, usedByCustomer: counts.usedByCustomer });
  // A first-order discount is one per customer, across every first-order code.
  if (!failure && code.firstOrderOnly && firstOrder > 0) return "first_order";
  return failure;
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
  /** Prices the code's gift and checks its stock; without it a gift is never given. */
  gift?: PromoGiftOffer;
}): Promise<PromoEvaluation> {
  const now = input.now ?? new Date();
  const codeText = normalizePromoCode(input.promoCode);
  const phone = input.phone ? normalizeKuwaitiPhone(input.phone) : null;
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
  // The gift is priced and stock-checked first; it is never one of the lines the rules look at (spec section 3.2).
  const offered = code.giftItemType && code.giftItemId && code.giftQty && input.gift
    ? await input.gift({ itemType: code.giftItemType, itemId: code.giftItemId, qty: code.giftQty })
    : null;
  const result = applyPromoPricing(rules, lines, { giftAvailable: offered !== null });
  if (!result.ok) return { status: "rejected", dto: rejection(codeText, result) };
  const gift = result.gift ? offered : null;
  const giftValueFils = gift ? toFils(gift.line.snapshotBaseUnitPrice ?? 0) * gift.line.qty : 0;

  const dto: PromoAppliedDto = {
    status: "applied",
    code: code.code,
    arName: code.arName,
    enName: code.enName,
    discount: fromFils(result.discountFils),
    saleGivenUp: fromFils(result.saleGivenUpFils),
    freeShipping: result.freeShipping,
    gift: gift ? { nameAr: gift.line.snapshotNameAr, nameEn: gift.line.snapshotNameEn, qty: gift.line.qty, value: fromFils(giftValueFils) } : null,
    giftUnavailable: rules.hasGift && !gift,
    replacedSales: result.replacedSales.map((sale) => {
      const item = input.items[Number(sale.key)]!;
      const itemId = item.itemType === "product_variant" ? item.variantId : item.itemType === "offer" ? item.offerId : item.collectionId;
      return { index: Number(sale.key), item: `${item.itemType}:${itemId}`, nameAr: item.snapshotNameAr, nameEn: item.snapshotNameEn,
        previousLineTotal: sale.previousLineTotal, lineTotal: sale.lineTotal };
    })
  };
  const snapshot = JSON.stringify({
    id: code.id, code: code.code, rules, startsAt: code.startsAt, endsAt: code.endsAt,
    firstOrderOnly: code.firstOrderOnly, isPrivate: code.isPrivate,
    discountFils: result.discountFils, saleGivenUpFils: result.saleGivenUpFils, replacedSales: dto.replacedSales,
    gift: dto.gift ?? null
  });
  return {
    status: "applied",
    code,
    result,
    dto,
    gift,
    application: {
      codeId: code.id,
      codeText: code.code,
      discountFils: result.discountFils,
      saleGivenUpFils: result.saleGivenUpFils,
      freeShipping: result.freeShipping,
      firstOrderOnly: code.firstOrderOnly,
      giftValueFils,
      snapshot,
      customerId: input.customerId!,
      phone
    }
  };
}

/** The binding check, inside the order transaction: locks the code row, then re-checks status, schedule, lists and limits with fresh counts. */
export async function lockAndRecheckPromo(tx: Executor, application: PromoApplication, now = new Date()) {
  // First-order is a rule about the person, who may hold several accounts with one phone: every first-order check takes all
  // first-order code rows, in id order, so two of them never run side by side. (This code's own row is among them.)
  if (application.firstOrderOnly) {
    await tx.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.firstOrderOnly, true)).orderBy(asc(promoCodes.id)).for("update");
  }
  const [code] = await tx.select().from(promoCodes).where(eq(promoCodes.id, application.codeId)).limit(1).for("update");
  // First-order is a rule about the customer, not the code: two different first-order codes must wait for each other.
  if (code?.firstOrderOnly) await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, application.customerId)).for("update");
  const failure = await accessFailure(tx, code ?? null, application.customerId, application.phone, now);
  if (failure) throw new PromoRejectedError({ status: "rejected", code: application.codeText, reason: failure });
}

export async function recordPromoUse(tx: Executor, application: PromoApplication, orderId: number, shippingWaivedFils = 0) {
  await tx.insert(promoRedemptions).values({
    promoCodeId: application.codeId,
    customerId: application.customerId,
    phoneNormalized: application.phone,
    orderId,
    state: "used",
    discountFils: application.discountFils,
    shippingWaivedFils,
    giftValueFils: application.giftValueFils
  });
}

/** Gives a used code back when its order is denied, cancelled by the customer or expires (spec section 6.1). Partial returns never call this. */
export async function releasePromoUse(tx: Executor, orderId: number, reason: "cancelled" | "denied" | "expired") {
  await tx.update(promoRedemptions).set({ state: "released", releaseReason: reason })
    .where(and(eq(promoRedemptions.orderId, orderId), eq(promoRedemptions.state, "used")));
}
