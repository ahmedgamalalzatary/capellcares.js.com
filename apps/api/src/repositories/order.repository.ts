import { db } from "@capella/database/src/db";
import { offerItems, orderItems, orders, productVariants } from "@capella/database/drizzle/schema";
import { eq, sql } from "drizzle-orm";

function generateOrderCode(orderId: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let seed = orderId * 7919 + 104729;
  let letters = "";
  for (let index = 0; index < 4; index += 1) {
    letters += alphabet[seed % alphabet.length];
    seed = Math.floor(seed / alphabet.length);
  }
  return `${letters}-${String(orderId).padStart(3, "0")}`;
}

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
        const underlyingItems = await tx
          .select({
            variantId: offerItems.variantId,
            bundleQty: offerItems.qty,
            stockQty: productVariants.stockQty
          })
          .from(offerItems)
          .innerJoin(productVariants, eq(productVariants.id, offerItems.variantId))
          .where(eq(offerItems.offerId, (item as any).offerId));

        for (const underlyingItem of underlyingItems) {
          const requiredQty = underlyingItem.bundleQty * item.qty;
          if (underlyingItem.stockQty < requiredQty) {
            throw new Error("Insufficient stock");
          }
          await tx
            .update(productVariants)
            .set({ stockQty: sql`${productVariants.stockQty} - ${requiredQty}` })
            .where(eq(productVariants.id, underlyingItem.variantId));
        }
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
      orderCode: "",
      totalAmount: sql`${input.order.totalAmount}`
    }).$returningId();

    const orderCode = generateOrderCode(order.id);

    await tx
      .update(orders)
      .set({ orderCode })
      .where(eq(orders.id, order.id));

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
    return { id: order.id, orderCode };
  });
}
