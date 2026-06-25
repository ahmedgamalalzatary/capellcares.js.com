import { and, eq, isNull } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { collections, offers, productVariants, products } from "@capella/database/drizzle/schema";
import { createOrderWithItems } from "../../repositories/order.repository.js";
import type { CheckoutPayload, Order, PaymentStatus } from "../../types/domain.js";
import { addMoney, multiplyMoney } from "./money.js";

export async function createOrderFromCheckout(
  payload: CheckoutPayload
): Promise<Pick<Order, "id" | "orderCode" | "paymentStatus">> {
  const pricedItems: Array<any> = [];
  for (const item of payload.items) {
    if (item.qty <= 0) throw new Error("Quantity must be positive");
    if (item.type === "product") {
      const variantId = Number(item.variantId);
      const [variant] = await db
        .select({
          id: productVariants.id,
          sellingPrice: productVariants.sellingPrice,
          sizeLabel: productVariants.sizeLabel,
          arName: products.arName,
          enName: products.enName
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
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
      const unitPrice = Number(variant.sellingPrice);
      pricedItems.push({
        itemType: "product_variant",
        variantId,
        offerId: null,
        qty: item.qty,
        unitPrice,
        lineTotal: multiplyMoney(unitPrice, item.qty),
        snapshotNameAr: variant.arName,
        snapshotNameEn: variant.enName,
        snapshotSizeLabel: variant.sizeLabel
      });
      continue;
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
      pricedItems.push({
        itemType: "collection",
        variantId: null,
        offerId: null,
        collectionId,
        qty: item.qty,
        unitPrice: Number(collection.fixedPrice),
        lineTotal: multiplyMoney(Number(collection.fixedPrice), item.qty),
        snapshotNameAr: collection.arName,
        snapshotNameEn: collection.enName,
        snapshotSizeLabel: null
      });
      continue;
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
    pricedItems.push({
      itemType: "offer",
      variantId: null,
      offerId,
      qty: item.qty,
      unitPrice: Number(offer.fixedPrice),
      lineTotal: multiplyMoney(Number(offer.fixedPrice), item.qty),
      snapshotNameAr: offer.arName,
      snapshotNameEn: offer.enName,
      snapshotSizeLabel: null
    });
  }

  const totalAmount = pricedItems.reduce((sum, row) => addMoney(sum, row.lineTotal), 0);
  const paymentStatus: PaymentStatus = "pending";
  const createdOrder = await createOrderWithItems({
    order: {
      customerType: payload.customerId ? "registered" : "guest",
      customerId: payload.customerId ?? null,
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      governorate: payload.governorate,
      cityArea: payload.cityArea,
      addressLine: payload.addressLine,
      buildingApartment: payload.buildingApartment,
      notes: payload.notes ?? "",
      paymentMethod: payload.paymentMethod,
      paymentStatus,
      totalAmount
    },
    items: pricedItems
  });
  return { id: createdOrder.id, orderCode: createdOrder.orderCode, paymentStatus };
}
