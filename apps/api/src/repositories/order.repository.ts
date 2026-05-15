import { db } from "@capella/database/src/db";
import { orderItems, orders, productVariants } from "@capella/database/drizzle/schema";
import { eq, sql } from "drizzle-orm";

export async function createOrderWithItems(input: {
  order: {
    customerType: "guest" | "registered";
    customerId: number | null;
    fullName: string;
    phone: string;
    email: string;
    governorate: string;
    cityArea: string;
    addressLine: string;
    buildingApartment: string;
    notes: string;
    paymentMethod: "cod";
    paymentStatus: "pending" | "paid" | "failed";
    totalAmount: number;
  };
  items: Array<{ variantId: number; qty: number; unitPrice: number; lineTotal: number }>;
}) {
  return db.transaction(async (tx) => {
    for (const item of input.items) {
      const [variant] = await tx
        .select({ stockQty: productVariants.stockQty })
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .limit(1);
      if (!variant || variant.stockQty < item.qty) throw new Error("Insufficient stock");
      await tx
        .update(productVariants)
        .set({ stockQty: sql`${productVariants.stockQty} - ${item.qty}` })
        .where(eq(productVariants.id, item.variantId));
    }

    const [order] = await tx.insert(orders).values({
      ...input.order,
      totalAmount: sql`${input.order.totalAmount}`
    }).$returningId();

    await tx.insert(orderItems).values(
      input.items.map((i) => ({
        orderId: order.id,
        itemType: "product_variant" as const,
        variantId: i.variantId,
        offerId: null,
        qty: i.qty,
        unitPrice: sql`${i.unitPrice}`,
        lineTotal: sql`${i.lineTotal}`,
        snapshotNameAr: null,
        snapshotNameEn: null,
        snapshotSizeLabel: null
      }))
    );
    return order.id;
  });
}
