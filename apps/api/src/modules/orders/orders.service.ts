import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { normalizeEgyptianPhone } from "@capella/shared";
import { collectionItems, collections, offerItems, offers, orders, productVariants, products, variantDiscounts } from "@capella/database/drizzle/schema";
import { createOrderWithItems } from "./order.repository.js";
import { loadBundleDiscountsRepo } from "../catalog/offers/bundle-discount.repository.js";
import { UNTOUCHED_EXPIRY_MS } from "./order/shared.js";
import type { CheckoutPayload, Order, PaymentStatus } from "../../types/domain.js";
import { addMoney, multiplyMoney } from "./money.js";
import { checkoutShippingEnabled, resolveShippingForCheckout } from "../shipping/checkout-shipping-runtime.js";
import type { CheckoutShippingService } from "../shipping/checkout-shipping.service.js";
import { notifyStaffOfNewOrder } from "./order-alert.js";
import { evaluateCheckoutPromo, PromoRejectedError, type PromoApplication, type PromoPricedItem } from "../promos/promo-checkout.js";
import type { PromoAppliedDto, PromoRejectionDto } from "@capella/shared";

export class CheckoutAmountChangedError extends Error {
  constructor() {
    super("Checkout total changed; refresh and review the cart before paying");
  }
}

function resolveEffectiveDiscountedPrice(input: {
  basePrice: number;
  discount: null | {
    id: number;
    type: "percentage" | "fixed";
    value: number;
    startsAt: Date | string;
    endsAt: Date | string;
    status: "active" | "inactive";
  };
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const discount = input.discount;
  const startsAt = discount ? new Date(discount.startsAt) : null;
  const endsAt = discount ? new Date(discount.endsAt) : null;
  if (
    !discount ||
    discount.status !== "active" ||
    !startsAt || !endsAt ||
    now < startsAt ||
    now > endsAt
  ) {
    return {
      unitPrice: input.basePrice,
      snapshotBaseUnitPrice: null,
      snapshotDiscountId: null,
      snapshotDiscountType: null,
      snapshotDiscountValue: null,
      snapshotDiscountStartsAt: null,
      snapshotDiscountEndsAt: null
    };
  }

  const discountedPrice = discount.type === "percentage"
    ? input.basePrice * (1 - discount.value / 100)
    : input.basePrice - discount.value;

  if (!Number.isFinite(discountedPrice) || discountedPrice < 0 ||
    (discount.type === "fixed" && discountedPrice === 0) || discountedPrice >= input.basePrice) {
    throw new Error("Invalid discounted price");
  }

  return {
    unitPrice: Number(discountedPrice.toFixed(2)),
    snapshotBaseUnitPrice: input.basePrice,
    snapshotDiscountId: discount.id,
    snapshotDiscountType: discount.type,
    snapshotDiscountValue: discount.value,
    snapshotDiscountStartsAt: startsAt.toISOString(),
    snapshotDiscountEndsAt: endsAt.toISOString()
  };
}

export type PricedCheckoutPromo = { dto: PromoAppliedDto | PromoRejectionDto; application: PromoApplication | null };

type CheckoutLineInput = CheckoutPayload["items"][number];

/** A gift is priced at its normal price, never through the sale logic (spec section 4.4): that price is kept as the line's
 * base price for reports, and the line itself costs 0. */
function giftPricing(basePrice: number) {
  return { unitPrice: basePrice, snapshotBaseUnitPrice: basePrice, snapshotDiscountId: null, snapshotDiscountType: null,
    snapshotDiscountValue: null, snapshotDiscountStartsAt: null, snapshotDiscountEndsAt: null };
}

/** One cart line priced from the database (sale discounts included), or the code's gift at its normal price. */
async function priceLine(item: CheckoutLineInput, gift = false): Promise<any> {
  if (item.qty <= 0) throw new Error("Quantity must be positive");
  if (item.type === "product") {
    const variantId = Number(item.variantId);
    const [variant] = await db
      .select({
        id: productVariants.id,
        productId: products.id,
        categoryId: products.categoryId,
        sellingPrice: productVariants.sellingPrice,
        sizeLabel: productVariants.sizeLabel,
        arName: products.arName,
        enName: products.enName,
        discountId: variantDiscounts.id,
        discountType: variantDiscounts.type,
        discountValue: variantDiscounts.value,
        discountStartsAt: variantDiscounts.startsAt,
        discountEndsAt: variantDiscounts.endsAt,
        discountStatus: variantDiscounts.status
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(variantDiscounts, eq(variantDiscounts.variantId, productVariants.id))
      .where(
        and(
          eq(productVariants.id, variantId),
          isNull(productVariants.deletedAt),
          eq(products.status, "active"),
          isNull(products.deletedAt)
        )
      )
      .limit(1);
    if (!variant) throw new Error(`Variant not found: ${item.variantId}`);
    const basePrice = Number(variant.sellingPrice);
    const pricing = gift ? giftPricing(basePrice) : resolveEffectiveDiscountedPrice({
      basePrice,
      discount: variant.discountId
        ? {
          id: variant.discountId,
          type: variant.discountType!,
          value: Number(variant.discountValue),
          startsAt: variant.discountStartsAt!,
          endsAt: variant.discountEndsAt!,
          status: variant.discountStatus!
        }
        : null
    });
    const unitPrice = pricing.unitPrice;
    return {
      itemType: "product_variant",
      variantId,
      productId: variant.productId,
      categoryId: variant.categoryId,
      offerId: null,
      qty: item.qty,
      unitPrice,
      lineTotal: multiplyMoney(unitPrice, item.qty),
      snapshotNameAr: variant.arName,
      snapshotNameEn: variant.enName,
      snapshotSizeLabel: variant.sizeLabel,
      snapshotBaseUnitPrice: pricing.snapshotBaseUnitPrice,
      snapshotDiscountId: pricing.snapshotDiscountId,
      snapshotDiscountType: pricing.snapshotDiscountType,
      snapshotDiscountValue: pricing.snapshotDiscountValue,
      snapshotDiscountStartsAt: pricing.snapshotDiscountStartsAt,
      snapshotDiscountEndsAt: pricing.snapshotDiscountEndsAt
    };
  }
  if (item.type === "collection") {
    const collectionId = Number(item.collectionId);
    const [collection] = await db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.id, collectionId),
          eq(collections.status, "active"),
          eq(collections.visibility, "visible"),
          isNull(collections.deletedAt)
        )
      )
      .limit(1);
    if (!collection) throw new Error(`Collection not found: ${collectionId}`);
    const discount = gift ? null : (await loadBundleDiscountsRepo("collection", [collectionId])).get(collectionId) ?? null;
    const pricing = gift ? giftPricing(Number(collection.fixedPrice)) : resolveEffectiveDiscountedPrice({
      basePrice: Number(collection.fixedPrice),
      discount: discount ? { ...discount, id: discount.id! } : null
    });
    return {
      itemType: "collection",
      variantId: null,
      offerId: null,
      collectionId,
      qty: item.qty,
      unitPrice: pricing.unitPrice,
      lineTotal: multiplyMoney(pricing.unitPrice, item.qty),
      snapshotNameAr: collection.arName,
      snapshotNameEn: collection.enName,
      snapshotSizeLabel: null,
      snapshotBaseUnitPrice: pricing.snapshotBaseUnitPrice,
      snapshotDiscountId: pricing.snapshotDiscountId,
      snapshotDiscountType: pricing.snapshotDiscountType,
      snapshotDiscountValue: pricing.snapshotDiscountValue,
      snapshotDiscountStartsAt: pricing.snapshotDiscountStartsAt,
      snapshotDiscountEndsAt: pricing.snapshotDiscountEndsAt
    };
  }
  const offerId = Number(item.offerId);
  const [offer] = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.id, offerId),
        eq(offers.status, "active"),
        eq(offers.visibility, "visible"),
        isNull(offers.deletedAt)
      )
    )
    .limit(1);
  if (!offer) throw new Error(`Offer not found: ${offerId}`);
  const discount = gift ? null : (await loadBundleDiscountsRepo("offer", [offerId])).get(offerId) ?? null;
  const pricing = gift ? giftPricing(Number(offer.fixedPrice)) : resolveEffectiveDiscountedPrice({
    basePrice: Number(offer.fixedPrice),
    discount: discount ? { ...discount, id: discount.id! } : null
  });
  return {
    itemType: "offer",
    variantId: null,
    offerId,
    qty: item.qty,
    unitPrice: pricing.unitPrice,
    lineTotal: multiplyMoney(pricing.unitPrice, item.qty),
    snapshotNameAr: offer.arName,
    snapshotNameEn: offer.enName,
    snapshotSizeLabel: null,
    snapshotBaseUnitPrice: pricing.snapshotBaseUnitPrice,
    snapshotDiscountId: pricing.snapshotDiscountId,
    snapshotDiscountType: pricing.snapshotDiscountType,
    snapshotDiscountValue: pricing.snapshotDiscountValue,
    snapshotDiscountStartsAt: pricing.snapshotDiscountStartsAt,
    snapshotDiscountEndsAt: pricing.snapshotDiscountEndsAt
  };
}

/** The stock a priced line takes, per variant; bundles also get their component snapshot here. */
async function addStockNeeds(item: any, needs: Map<number, number>) {
  if (item.itemType === "product_variant") {
    needs.set(item.variantId, (needs.get(item.variantId) ?? 0) + item.qty);
    return;
  }
  const components = item.itemType === "offer"
    ? await db.select({ variantId: offerItems.variantId, qty: offerItems.qty, unitPrice: productVariants.sellingPrice, sizeLabel: productVariants.sizeLabel })
      .from(offerItems).innerJoin(productVariants, eq(productVariants.id, offerItems.variantId))
      .where(eq(offerItems.offerId, item.offerId))
      .orderBy(asc(offerItems.id))
    : await db.select({ variantId: collectionItems.variantId, qty: collectionItems.qty, unitPrice: productVariants.sellingPrice, sizeLabel: productVariants.sizeLabel })
      .from(collectionItems).innerJoin(productVariants, eq(productVariants.id, collectionItems.variantId))
      .where(eq(collectionItems.collectionId, item.collectionId))
      .orderBy(asc(collectionItems.id));
  if (components.length === 0) throw new Error(`No components found for ${item.itemType}`);
  item.snapshotComponents = components.map((component) => ({
    variantId: component.variantId, qty: component.qty, unitPrice: Number(component.unitPrice), sizeLabel: component.sizeLabel
  }));
  item.snapshotSizeLabel = [...new Set(components.map((component) => component.sizeLabel).filter(Boolean))].join(", ") || null;
  for (const component of components) {
    needs.set(component.variantId, (needs.get(component.variantId) ?? 0) + component.qty * item.qty);
  }
}

/** Prices the cart from the database (sale discounts included), then applies the promo code when one is given (spec section 4). */
export async function priceCheckout(
  payload: Pick<CheckoutPayload, "items"> & Partial<Pick<CheckoutPayload, "promoCode" | "customerId" | "phone">>,
  options: { now?: Date; idempotencyKey?: string; shippingAvailable?: boolean } = {}
) {
  const pricedItems: Array<any> = [];
  for (const item of payload.items) {
    if (item.qty <= 0) throw new Error("Quantity must be positive");
    pricedItems.push(await priceLine(item));
  }
  const needs = new Map<number, number>();
  for (const item of pricedItems) await addStockNeeds(item, needs);
  // The cart as shown before the code; the parcel size is estimated from this plus any gift (spec section 5.2).
  const shownCents = pricedItems.reduce((sum, row) => sum + Math.round(row.lineTotal * 100), 0);

  // The code's gift, when it is sold and in stock beyond what the cart itself takes (spec section 4.4).
  const giftOffer = async (gift: { itemType: "product_variant" | "offer" | "collection"; itemId: number; qty: number }) => {
    const input: CheckoutLineInput = gift.itemType === "product_variant" ? { type: "product", variantId: gift.itemId, qty: gift.qty }
      : gift.itemType === "offer" ? { type: "offer", offerId: gift.itemId, qty: gift.qty } : { type: "collection", collectionId: gift.itemId, qty: gift.qty };
    try {
      const line = await priceLine(input, true);
      const giftNeeds = new Map<number, number>();
      await addStockNeeds(line, giftNeeds);
      const stock = await db.select({ id: productVariants.id, stockQty: productVariants.stockQty }).from(productVariants)
        .where(and(inArray(productVariants.id, [...giftNeeds.keys()]), isNull(productVariants.deletedAt)));
      const fits = stock.length === giftNeeds.size && stock.every((row) => (needs.get(row.id) ?? 0) + giftNeeds.get(row.id)! <= row.stockQty);
      if (!fits) return null;
      return { line: { ...line, unitPrice: 0, lineTotal: 0, isPromoGift: true }, needs: giftNeeds };
    } catch {
      return null;
    }
  };

  let promo: PricedCheckoutPromo | null = null;
  if (payload.promoCode) {
    const evaluation = await evaluateCheckoutPromo({
      promoCode: payload.promoCode,
      customerId: payload.customerId ?? null,
      phone: payload.phone ?? null,
      items: pricedItems as PromoPricedItem[],
      now: options.now,
      idempotencyKey: options.idempotencyKey,
      shippingAvailable: options.shippingAvailable ?? checkoutShippingEnabled(),
      gift: giftOffer
    });
    if (evaluation.status === "applied") {
      // The discount goes into each line's total (spec section 4.5), so every total check downstream stays unchanged.
      for (const line of evaluation.result.lines) {
        const item = pricedItems[Number(line.key)];
        if (line.discountedPieces === 0) continue;
        item.unitPrice = line.unitPrice;
        item.lineTotal = line.lineTotal;
        item.promoDiscountAmount = line.promoDiscount;
        item.promoReplacedDiscountId = line.replacedSaleDiscountId;
      }
      if (evaluation.gift) {
        pricedItems.push(evaluation.gift.line);
        for (const [variantId, qty] of evaluation.gift.needs) needs.set(variantId, (needs.get(variantId) ?? 0) + qty);
      }
      promo = { dto: evaluation.dto, application: evaluation.application };
    } else {
      promo = { dto: evaluation.dto, application: null };
    }
  }

  const totalAmount = pricedItems.reduce((sum, row) => addMoney(sum, row.lineTotal), 0);
  return {
    items: pricedItems,
    totalAmount,
    reservations: [...needs.entries()].map(([variantId, qty]) => ({ variantId, qty })),
    /** What the parcel is worth for its size estimate: the cart as shown before the code, plus the gift at its normal price. */
    parcelValueCents: shownCents + (promo?.application?.giftValueCents ?? 0),
    promo
  };
}

/** The carrier fee the store absorbs because the code waives delivery (spec section 8.6); 0 otherwise. */
export function shippingWaivedCents(promo: PromoApplication | null, shipping: { shippingAmountCents: number; carrierShippingAmountCents?: number } | null) {
  if (!promo?.freeShipping || !shipping) return 0;
  return Math.max(0, (shipping.carrierShippingAmountCents ?? shipping.shippingAmountCents) - shipping.shippingAmountCents);
}

/** The applied promo code for a checkout that must use it; a code that no longer applies stops the checkout with its reason. */
export function requireAppliedPromo(priced: Awaited<ReturnType<typeof priceCheckout>>): PromoApplication | null {
  if (!priced.promo) return null;
  if (priced.promo.dto.status === "rejected" || !priced.promo.application) throw new PromoRejectedError(priced.promo.dto as PromoRejectionDto);
  return priced.promo.application;
}

export async function createOrderFromCheckout(
  payload: CheckoutPayload,
  options: { idempotencyKey: string; now?: Date; shippingService?: CheckoutShippingService; allowFreePrepaid?: boolean } = { idempotencyKey: randomUUID() }
): Promise<Pick<Order, "id" | "orderCode" | "paymentStatus"> & { replayed: boolean }> {
  if (payload.paymentMethod !== "cod" && !options.allowFreePrepaid) throw new Error("Online checkout cannot create an order before payment succeeds");
  const checkoutFingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const findExisting = () => db.select({ id: orders.id, orderCode: orders.orderCode,
    paymentStatus: orders.paymentStatus, checkoutFingerprint: orders.checkoutFingerprint })
    .from(orders).where(eq(orders.idempotencyKey, options.idempotencyKey)).limit(1).then((rows) => rows[0]);
  const existing = await findExisting();
  if (existing) {
    if (existing.checkoutFingerprint !== checkoutFingerprint) {
      throw new Error("Idempotency key belongs to a different checkout");
    }
    return { id: existing.id, orderCode: existing.orderCode, paymentStatus: existing.paymentStatus, replayed: true };
  }
  const priced = await priceCheckout(payload, { now: options.now, ...(options.shippingService ? { shippingAvailable: true } : {}) });
  const promo = requireAppliedPromo(priced);
  const shipping = await resolveShippingForCheckout(payload, priced, options.shippingService);
  const pricedItems = priced.items;
  const totalAmount = addMoney(priced.totalAmount, (shipping?.shippingAmountCents ?? 0) / 100);
  if (payload.paymentMethod === "paymob" && totalAmount !== 0) throw new Error("Online checkout cannot create an order before payment succeeds");
  if (payload.expectedAmountCents != null && Math.round(totalAmount * 100) !== payload.expectedAmountCents) {
    throw new CheckoutAmountChangedError();
  }
  const paymentStatus: PaymentStatus = totalAmount === 0 ? "accepted" : "pending";
  let createdOrder: { id: number; orderCode: string };
  try {
    createdOrder = await createOrderWithItems({
      order: {
      customerType: payload.customerId ? "registered" : "guest",
      customerId: payload.customerId ?? null,
      fullName: payload.fullName,
      phone: normalizeEgyptianPhone(payload.phone),
      email: payload.email,
      governorate: shipping?.address.cityName.en ?? payload.governorate,
      cityArea: shipping ? `${shipping.address.zoneName.en} / ${shipping.address.districtName.en}`.slice(0, 120) : payload.cityArea,
      addressLine: payload.addressLine,
      buildingApartment: payload.buildingApartment,
      notes: payload.notes ?? "",
      paymentMethod: "cod",
      paymentStatus,
      idempotencyKey: options.idempotencyKey,
      checkoutFingerprint,
      codExpiresAt: totalAmount === 0 ? null : new Date((options.now ?? new Date()).getTime() + UNTOUCHED_EXPIRY_MS),
      totalAmount,
      shippingAmountCents: shipping?.shippingAmountCents ?? 0,
      shippingQuoteId: shipping?.quoteId ?? null,
      shippingSize: shipping?.size ?? null,
      shippingSnapshot: shipping ? JSON.stringify(shipping) : null,
      promoShippingWaivedCents: shippingWaivedCents(promo, shipping)
      },
      items: pricedItems,
      promo
    });
  } catch (error) {
    if (error instanceof PromoRejectedError) {
      const twin = await findExisting();
      if (twin?.checkoutFingerprint === checkoutFingerprint) {
        return { id: twin.id, orderCode: twin.orderCode, paymentStatus: twin.paymentStatus, replayed: true };
      }
      throw error;
    }
    const candidate = error as { code?: string; cause?: { code?: string } };
    if (candidate?.code !== "ER_DUP_ENTRY" && candidate?.cause?.code !== "ER_DUP_ENTRY") throw error;
    const winner = await findExisting();
    if (!winner || winner.checkoutFingerprint !== checkoutFingerprint) {
      throw new Error("Idempotency key belongs to a different checkout");
    }
    return { id: winner.id, orderCode: winner.orderCode, paymentStatus: winner.paymentStatus, replayed: true };
  }
  // Staff hear about every new website order on WhatsApp; fire-and-forget after the order is saved, so the alert can never fail or slow checkout.
  void notifyStaffOfNewOrder(createdOrder.id);
  return { id: createdOrder.id, orderCode: createdOrder.orderCode, paymentStatus, replayed: false };
}
