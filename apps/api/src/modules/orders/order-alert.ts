import { asc, eq } from "drizzle-orm";
import { orderItems, orders } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { isOrderAlertConfigured, sendNewOrderAlert } from "../../services/staff-order-alert.service.js";

type NotifyOptions = Parameters<typeof sendNewOrderAlert>[1];

/**
 * Sends the staff WhatsApp alert for a saved website order, read back from the database so cash and paid-online orders share one message.
 * Call it only after the order's transaction has committed. Never throws; returns whether the alert was accepted.
 */
export async function notifyStaffOfNewOrder(orderId: number, options: NotifyOptions = {}): Promise<boolean> {
  if (!isOrderAlertConfigured(options.env)) return false;
  try {
    const [order] = await db
      .select({
        id: orders.id,
        orderCode: orders.orderCode,
        fullName: orders.fullName,
        phone: orders.phone,
        totalAmount: orders.totalAmount,
        shippingAmountCents: orders.shippingAmountCents,
        paymentMethod: orders.paymentMethod
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return false;
    const items = await db
      .select({ nameAr: orderItems.snapshotNameAr, nameEn: orderItems.snapshotNameEn, sizeLabel: orderItems.snapshotSizeLabel, qty: orderItems.qty, lineTotal: orderItems.lineTotal })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id));
    return await sendNewOrderAlert({
      id: order.id,
      orderCode: order.orderCode,
      fullName: order.fullName,
      phone: order.phone,
      items: items.map((item) => ({ nameAr: item.nameAr || item.nameEn || "—", sizeLabel: item.sizeLabel, qty: item.qty, lineTotal: Number(item.lineTotal) })),
      deliveryFee: Number(order.shippingAmountCents ?? 0) / 100,
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.paymentMethod === "paymob" ? "paymob" : "cod"
    }, options);
  } catch (error) {
    (options.logger ?? console).error("New-order WhatsApp alert could not be prepared", { orderId, error });
    return false;
  }
}
