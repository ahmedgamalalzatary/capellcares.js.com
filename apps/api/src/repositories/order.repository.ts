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
      if ((item as any).itemType === "offer") {
        const offerRows = await tx.select().from(productVariants).limit(0);
        void offerRows;
      } else {
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
    }

    const [order] = await tx.insert(orders).values({
      ...input.order,
      totalAmount: sql`${input.order.totalAmount}`
    }).$returningId();

    await tx.insert(orderItems).values(
      input.items.map((i) => ({
        orderId: order.id,
        itemType: (i as any).itemType ?? "product_variant",
        variantId: (i as any).variantId ?? null,
        offerId: (i as any).offerId ?? null,
        qty: i.qty,
        unitPrice: sql`${i.unitPrice}`,
        lineTotal: sql`${i.lineTotal}`,
        snapshotNameAr: (i as any).snapshotNameAr ?? null,
        snapshotNameEn: (i as any).snapshotNameEn ?? null,
        snapshotSizeLabel: (i as any).snapshotSizeLabel ?? null
      }))
    );
    return order.id;
  });
}
