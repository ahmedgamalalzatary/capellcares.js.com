import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { normalizeKuwaitiPhone, type PromoAppliedDto, type PromoRejectionDto } from "@capella/shared";
import { collectionItems, collections, offerItems, offers, orders, productColors, productVariants, products, variantDiscounts } from "@capella/database/drizzle/schema";
import { createOrderWithItems } from "./order.repository.js";
import { loadBundleDiscountsRepo } from "../catalog/offers/bundle-discount.repository.js";
import { UNTOUCHED_EXPIRY_MS } from "./order/shared.js";
import type { CheckoutPayload, Order, PaymentStatus } from "../../types/domain.js";
import { addMoney, multiplyMoney } from "./money.js";
import { computeDeliveryFee, type DeliveryLine } from "../delivery/delivery-fee.js";
import { findCheckoutAreaRepo } from "../delivery/delivery.repository.js";
import { sendNewOrderAlert } from "../../services/staff-order-alert.service.js";
import { evaluateCheckoutPromo, PromoRejectedError, requireConfirmedSales, type PromoApplication, type PromoPricedItem } from "../promos/promo-checkout.js";

export class CheckoutAmountChangedError extends Error {
  constructor() {
    super("Checkout total changed; refresh and review the cart before ordering");
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
    unitPrice: Number(discountedPrice.toFixed(3)),
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

/** One cart line priced from the database (sale discounts included) with how delivery sees it, or the code's gift at its normal price. */
async function priceLine(item: CheckoutLineInput, gift = false): Promise<{ line: any; delivery: DeliveryLine }> {
  if (item.qty <= 0) throw new Error("Quantity must be positive");
  if (item.type === "product") {
    const variantId = Number(item.variantId);
    const [variant] = await db
      .select({
        id: productVariants.id,
        sellingPrice: productVariants.sellingPrice,
        sizeLabel: productVariants.sizeLabel,
        colorAr: productColors.arName,
        colorEn: productColors.enName,
        colorHex: productColors.hex,
        arName: products.arName,
        enName: products.enName,
        productId: products.id,
        categoryId: products.categoryId,
        productDeliveryFee: products.deliveryFee,
        discountId: variantDiscounts.id,
        discountType: variantDiscounts.type,
        discountValue: variantDiscounts.value,
        discountStartsAt: variantDiscounts.startsAt,
        discountEndsAt: variantDiscounts.endsAt,
        discountStatus: variantDiscounts.status
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(productColors, eq(productColors.id, productVariants.colorId))
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
      delivery: { productId: variant.productId, ownFee: variant.productDeliveryFee == null ? null : Number(variant.productDeliveryFee) },
      line: {
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
        snapshotSizeLabel: variant.sizeLabel || null,
        // A swatch-only colour keeps its picked colour so the order still says which one was bought.
        snapshotColorAr: variant.colorAr || variant.colorEn || variant.colorHex || null,
        snapshotColorEn: variant.colorEn || variant.colorAr || variant.colorHex || null,
        snapshotBaseUnitPrice: pricing.snapshotBaseUnitPrice,
        snapshotDiscountId: pricing.snapshotDiscountId,
        snapshotDiscountType: pricing.snapshotDiscountType,
        snapshotDiscountValue: pricing.snapshotDiscountValue,
        snapshotDiscountStartsAt: pricing.snapshotDiscountStartsAt,
        snapshotDiscountEndsAt: pricing.snapshotDiscountEndsAt
      }
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
      delivery: { productId: null, ownFee: null },
      line: {
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
      }
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
    delivery: { productId: null, ownFee: null },
    line: {
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
    }
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
  options: { now?: Date } = {}
) {
  const pricedItems: Array<any> = [];
  // The gift is never one of these: it adds no delivery fee of its own.
  const deliveryLines: DeliveryLine[] = [];
  for (const item of payload.items) {
    if (item.qty <= 0) throw new Error("Quantity must be positive");
    const { line, delivery } = await priceLine(item);
    pricedItems.push(line);
    deliveryLines.push(delivery);
  }
  const needs = new Map<number, number>();
  for (const item of pricedItems) await addStockNeeds(item, needs);

  // The code's gift, when it is sold and in stock beyond what the cart itself takes (spec section 4.4).
  const giftOffer = async (gift: { itemType: "product_variant" | "offer" | "collection"; itemId: number; qty: number }) => {
    const input: CheckoutLineInput = gift.itemType === "product_variant" ? { type: "product", variantId: gift.itemId, qty: gift.qty }
      : gift.itemType === "offer" ? { type: "offer", offerId: gift.itemId, qty: gift.qty } : { type: "collection", collectionId: gift.itemId, qty: gift.qty };
    try {
      const { line } = await priceLine(input, true);
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
    deliveryLines,
    reservations: [...needs.entries()].map(([variantId, qty]) => ({ variantId, qty })),
    promo
  };
}

/** The applied promo code for a checkout that must use it; a code that no longer applies stops the checkout with its reason. */
export function requireAppliedPromo(priced: Awaited<ReturnType<typeof priceCheckout>>): PromoApplication | null {
  if (!priced.promo) return null;
  if (priced.promo.dto.status === "rejected" || !priced.promo.application) throw new PromoRejectedError(priced.promo.dto as PromoRejectionDto);
  return priced.promo.application;
}

/** The applied code for an order: it must still apply, and any sale it replaces must be the one the customer confirmed. */
export function requireConfirmedPromo(priced: Awaited<ReturnType<typeof priceCheckout>>, accepted: CheckoutPayload["promoAcceptedSales"]) {
  const application = requireAppliedPromo(priced);
  if (application && priced.promo!.dto.status === "applied") requireConfirmedSales(priced.promo!.dto, accepted);
  return application;
}

/** Items, delivery and total for one area: what checkout shows and what the order charges. Unknown or closed areas throw.
 * A free-delivery code makes the customer's delivery fee 0; the fee the store absorbs is kept in deliveryFeeWaived. */
export async function quoteCheckout(
  payload: Pick<CheckoutPayload, "items" | "areaId"> & Partial<Pick<CheckoutPayload, "promoCode" | "customerId" | "phone">>,
  options: { now?: Date } = {}
) {
  const area = await findCheckoutAreaRepo(payload.areaId);
  const priced = await priceCheckout(payload, options);
  const fullDeliveryFee = computeDeliveryFee(area.fee, priced.deliveryLines);
  const freeDelivery = priced.promo?.application?.freeShipping === true;
  const deliveryFee = freeDelivery ? 0 : fullDeliveryFee;
  return {
    area,
    priced,
    subtotal: priced.totalAmount,
    deliveryFee,
    deliveryFeeWaived: freeDelivery ? fullDeliveryFee : 0,
    total: addMoney(priced.totalAmount, deliveryFee)
  };
}

export async function createOrderFromCheckout(
  payload: CheckoutPayload,
  options: { idempotencyKey: string; now?: Date } = { idempotencyKey: randomUUID() }
): Promise<Pick<Order, "id" | "orderCode" | "paymentStatus"> & { replayed: boolean }> {
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
  const { area, priced, deliveryFee, deliveryFeeWaived, total: totalAmount } = await quoteCheckout(payload, { now: options.now });
  // A code that no longer applies is the first thing the customer hears about, before any amount check.
  const promo = requireConfirmedPromo(priced, payload.promoAcceptedSales);
  const pricedItems = priced.items;
  if (payload.expectedAmountFils != null && Math.round(totalAmount * 1000) !== payload.expectedAmountFils) {
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
      phone: normalizeKuwaitiPhone(payload.phone),
      email: payload.email,
      governorate: area.governorateArName,
      cityArea: area.arName,
      areaId: area.id,
      addressLine: payload.addressLine,
      buildingApartment: payload.buildingApartment,
      notes: payload.notes ?? "",
      paymentMethod: "cod",
      paymentStatus,
      idempotencyKey: options.idempotencyKey,
      checkoutFingerprint,
      codExpiresAt: totalAmount === 0 ? null : new Date((options.now ?? new Date()).getTime() + UNTOUCHED_EXPIRY_MS),
      deliveryFee,
      totalAmount,
      promoShippingWaivedFils: Math.round(deliveryFeeWaived * 1000)
      },
      items: pricedItems,
      promo
    });
  } catch (error) {
    if (error instanceof PromoRejectedError) {
      // The same checkout sent twice at once: the first one took the code's last use, and this one is its twin.
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
  // Staff hear about every new website order on WhatsApp; fire-and-forget, since the alert can never fail or slow the checkout.
  void sendNewOrderAlert({
    id: createdOrder.id,
    orderCode: createdOrder.orderCode,
    fullName: payload.fullName,
    phone: normalizeKuwaitiPhone(payload.phone),
    items: pricedItems.map((item) => ({
      nameAr: item.snapshotNameAr,
      sizeLabel: item.snapshotSizeLabel,
      qty: item.qty,
      lineTotal: item.lineTotal
    })),
    deliveryFee,
    totalAmount
  });
  return { id: createdOrder.id, orderCode: createdOrder.orderCode, paymentStatus, replayed: false };
}
