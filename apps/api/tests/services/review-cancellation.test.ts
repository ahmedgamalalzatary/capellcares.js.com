import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, orderItems } from "@capella/database/drizzle/schema";
import { resetApiTestDatabase } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { requestShippingCancellation } from "../../src/modules/shipping/shipping-cancellation.repository.js";
import { findOrderByIdRepo } from "../../src/repositories/order.repository.js";
import { attachReviewEligibilityToOrder, claimReviewPrompt, createVerifiedReview, ReviewEligibilityError } from "../../src/repositories/review.repository.js";

beforeEach(resetApiTestDatabase);

async function paidPurchase() {
  const f = await shippingSyncFixture(false);
  await db.update(orders).set({ customerType: "registered", customerId: f.ids.customerId,
    paymentMethod: "paymob", paymentStatus: "accepted", providerPaymentStatus: "succeeded" }).where(eq(orders.id, f.order.id));
  return f;
}

for (const entityType of ["product", "offer", "collection"] as const) {
  test(`safely cancelled paid ${entityType} purchases cannot qualify for reviews before refund`, async () => {
    const f = await paidPurchase();
    const entityId = entityType === "product" ? f.ids.productOneId : entityType === "offer" ? f.ids.offerId : f.ids.collectionId;
    if (entityType !== "product") {
      await db.update(orderItems).set({ itemType: entityType, variantId: null,
        offerId: entityType === "offer" ? entityId : null, collectionId: entityType === "collection" ? entityId : null,
        snapshotComponents: JSON.stringify([{ variantId: f.ids.firstVariantId, qty: 1 }]) }).where(eq(orderItems.orderId, f.order.id));
    }
    await requestShippingCancellation(f.order.id, { source: "customer", actorId: f.ids.customerId });
    const stored = (await db.select().from(orders).where(eq(orders.id, f.order.id)))[0];
    assert.equal(stored.paymentStatus, "accepted");
    assert.equal(stored.refundedAmountCents, 0);
    await assert.rejects(createVerifiedReview({ customerId: f.ids.customerId, entityType, entityId,
      rating: 5, comment: "Never received the cancelled purchase" }), ReviewEligibilityError);
    assert.equal(await claimReviewPrompt(f.ids.customerId), null);
    const customerOrder = await findOrderByIdRepo(f.order.id, { customerId: f.ids.customerId });
    assert.ok(customerOrder);
    const projected = await attachReviewEligibilityToOrder(customerOrder, f.ids.customerId);
    assert.equal(projected.items[0].review?.state, "unavailable");
  });
}

test("another paid purchase still qualifies when the newest purchase was safely cancelled", async () => {
  const older = await paidPurchase();
  const cancelled = await paidPurchase();
  await db.update(orderItems).set({ snapshotNameEn: "Cancelled purchase" }).where(eq(orderItems.orderId, cancelled.order.id));
  await requestShippingCancellation(cancelled.order.id, { source: "customer", actorId: cancelled.ids.customerId });
  const prompt = await claimReviewPrompt(older.ids.customerId);
  assert.equal(prompt?.entityId, older.ids.productOneId);
  assert.equal(prompt?.name.en, "Baseline Product 1");
  const review = await createVerifiedReview({ customerId: older.ids.customerId, entityType: "product",
    entityId: older.ids.productOneId, rating: 4, comment: "Received the earlier purchase" });
  assert.equal(review.orderItemId, older.items[0].id);
});

test("pending cancellation still qualifies until safe cancellation has completed", async () => {
  const f = await shippingSyncFixture();
  await db.update(orders).set({ customerType: "registered", customerId: f.ids.customerId,
    paymentMethod: "paymob", paymentStatus: "accepted" }).where(eq(orders.id, f.order.id));
  const result = await requestShippingCancellation(f.order.id, { source: "customer", actorId: f.ids.customerId });
  assert.equal(result.status, "pending");
  assert.equal((await claimReviewPrompt(f.ids.customerId))?.entityId, f.ids.productOneId);
  const review = await createVerifiedReview({ customerId: f.ids.customerId, entityType: "product",
    entityId: f.ids.productOneId, rating: 4, comment: "Still a paid purchase" });
  assert.equal(review.orderItemId, f.items[0].id);
});
