import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, orderItems, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { fixtureShippingService, selectedDestination, shippingBuyer } from "./checkout-shipping.js";
import { getBaselineIds } from "./database.js";
import { deliveryEnvironment, deliveryRateIdentity } from "./bosta-delivery.js";
import { bostaDeliveryProviderFromEnvironment } from "../../src/modules/shipping/bosta/bosta-delivery.service.js";
import { runShippingDispatchOnce } from "../../src/modules/shipping/shipping-dispatch-worker.js";
import { resolveBostaSyncRuntime } from "../../src/modules/shipping/bosta/bosta-sync.service.js";
import { syncEnvironment, webhookFixture } from "./bosta-sync.js";

export async function shippingSyncFixture(link = true) {
  const ids = await getBaselineIds();
  const shippingService = fixtureShippingService(9729, deliveryRateIdentity);
  const payload = { ...shippingBuyer, shippingAddress: selectedDestination,
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const quote = await shippingService.quoteCheckout(payload, await priceCheckout(payload));
  const created = await createOrderFromCheckout({ ...payload, shippingQuoteId: quote.quoteId },
    { shippingService, idempotencyKey: crypto.randomUUID() });
  const provider = bostaDeliveryProviderFromEnvironment(deliveryEnvironment, async () => Response.json({ success: true,
    data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } }))!;
  await db.update(shippingWorkItems).set({ nextAttemptAt: new Date(Date.now() - 2000) });
  if (link) await runShippingDispatchOnce({ provider });
  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, created.id));
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, created.id));
  const [shipment] = await db.select().from(shipments).where(eq(shipments.orderId, created.id));
  const runtime = resolveBostaSyncRuntime(syncEnvironment)!;
  const body = (changes: Record<string, unknown> = {}) => webhookFixture({ businessReference: job.idempotencyKey, ...changes });
  return { ids, created, order, items, job, shipment, provider, runtime, body };
}
