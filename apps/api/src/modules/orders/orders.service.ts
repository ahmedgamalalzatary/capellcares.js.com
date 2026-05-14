import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { productVariants } from "@capella/database/drizzle/schema";
import { createOrderWithItems } from "../../repositories/order.repository.js";
import type { CheckoutPayload, Order, PaymentStatus } from "../../types/domain.js";

export async function createOrderFromCheckout(payload: CheckoutPayload): Promise<Pick<Order, "id">> {
  const pricedItems = [];
  for (const item of payload.items) {
    const variantId = Number(item.variantId);
    const [variant] = await db
      .select({ id: productVariants.id, sellingPrice: productVariants.sellingPrice })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);
    if (!variant) throw new Error(`Variant not found: ${item.variantId}`);
    if (item.qty <= 0) throw new Error("Quantity must be positive");
    const unitPrice = Number(variant.sellingPrice);
    pricedItems.push({
      variantId,
      qty: item.qty,
      unitPrice,
      lineTotal: unitPrice * item.qty
    });
  }

  const totalAmount = pricedItems.reduce((sum, row) => sum + row.lineTotal, 0);
  const paymentStatus: PaymentStatus = payload.paymentMethod === "paymob" ? "pending" : "pending";
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
      notes: payload.notes,
      paymentMethod: payload.paymentMethod,
      paymentStatus,
      totalAmount
    },
    items: pricedItems
  });
  return { id: orderId };
}
