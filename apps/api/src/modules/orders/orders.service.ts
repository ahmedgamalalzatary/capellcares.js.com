import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { offerItems, offers, productVariants, products } from "@capella/database/drizzle/schema";
import { createOrderWithItems } from "../../repositories/order.repository.js";
import type { CheckoutPayload, Order, PaymentStatus } from "../../types/domain.js";

export async function createOrderFromCheckout(payload: CheckoutPayload): Promise<Pick<Order, "id">> {
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
        .where(eq(productVariants.id, variantId))
        .limit(1);
      if (!variant) throw new Error(`Variant not found: ${item.variantId}`);
      const unitPrice = Number(variant.sellingPrice);
      pricedItems.push({
        itemType: "product_variant",
        variantId,
        offerId: null,
        qty: item.qty,
        unitPrice,
        lineTotal: unitPrice * item.qty,
        snapshotNameAr: variant.arName,
        snapshotNameEn: variant.enName,
        snapshotSizeLabel: variant.sizeLabel
      });
      continue;
    }
    const offerId = Number(item.offerId);
    const [offer] = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
    if (!offer) throw new Error(`Offer not found: ${offerId}`);
    pricedItems.push({
      itemType: "offer",
      variantId: null,
      offerId,
      qty: item.qty,
      unitPrice: Number(offer.fixedPrice),
      lineTotal: Number(offer.fixedPrice) * item.qty,
      snapshotNameAr: offer.arName,
      snapshotNameEn: offer.enName,
      snapshotSizeLabel: null
    });
  }

  const totalAmount = pricedItems.reduce((sum, row) => sum + row.lineTotal, 0);
  const paymentStatus: PaymentStatus = "pending";
  const orderId = await createOrderWithItems({
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
  return { id: orderId };
}
