import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, paymentAttempts, paymobCallbackInbox } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(resetApiTestDatabase);

/** A durably accepted callback parked in review_required, optionally bound to a session. */
async function parkedCallback(options: { status?: "review_required" | "processing" | "processed" | "failed";
  reason?: string | null; sessionId?: number | null; orderId?: string | null; receivedAt?: Date } = {}) {
  const [row] = await db.insert(paymobCallbackInbox).values({
    eventFingerprint: crypto.randomUUID().replaceAll("-", "").repeat(2),
    fingerprintVersion: 3,
    normalizedPayload: { order: { id: options.orderId ?? null }, card: "secret-card-token" },
    signedOrderId: options.orderId ?? null,
    boundSessionId: options.sessionId ?? null,
    callbackType: "transaction",
    processingStatus: options.status ?? "review_required",
    lastError: options.reason ?? "REFUND_VERIFICATION_UNRESOLVED",
    claimedBy: "stale-worker",
    claimedAt: new Date(),
    receivedAt: options.receivedAt ?? new Date()
  }).$returningId();
  return row.id;
}

async function checkoutSession(publicId: string, email: string) {
  const [session] = await db.insert(checkoutSessions).values({ publicId,
    idempotencyKey: crypto.randomUUID(), customerType: "guest", fullName: "Parked Customer",
    phone: "+201012345678", email, governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", cartSnapshot: "[]", amountCents: 3500,
    shippingAmountCents: 0, currency: "EGP", state: "payment_pending", attemptCount: 1,
    reservationExpiresAt: new Date(Date.now() + 600000) }).$returningId();
  return session.id;
}

test("ERP lists paid checkouts needing manual reconciliation without exposing payment secrets", async () => {
  const publicId = `checkout_${crypto.randomUUID()}`;
  const [session] = await db.insert(checkoutSessions).values({ publicId,
    idempotencyKey: crypto.randomUUID(), customerType: "guest", fullName: "Late Customer",
    phone: "+201012345678", email: "late@example.com", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", cartSnapshot: "[]", amountCents: 3500,
    shippingAmountCents: 0, currency: "EGP", state: "expired", attemptCount: 1,
    reservationExpiresAt: new Date(Date.now() - 300000) }).$returningId();
  await db.insert(paymentAttempts).values({ checkoutSessionId: session.id, attemptNumber: 1,
    merchantReference: `capella_${crypto.randomUUID()}`, amountCents: 3500, currency: "EGP",
    environment: "test", status: "reconciliation_required", paymobOrderId: "9025",
    paymobTransactionId: "7025", clientSecret: "never-expose-this",
    failureCode: "PAID_AFTER_RESERVATION_RELEASE" });
  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/orders/reconciliation", { headers: await getAdminAuthHeaders(request) });
    assert.equal(response.status, 200);
    assert.deepEqual(response.json.items[0], {
      checkoutId: publicId, customerName: "Late Customer", customerEmail: "late@example.com",
      amountCents: 3500, currency: "EGP", environment: "test", paymobOrderId: "9025",
      paymobTransactionId: "7025", reason: "PAID_AFTER_RESERVATION_RELEASE"
    });
    assert.equal(JSON.stringify(response.json).includes("never-expose-this"), false);
  });
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.paymobOrderId, "9025"));
  assert.equal(attempt.status, "reconciliation_required");
});

test("ERP reconciliation surfaces a succeeded attempt flagged for a second capture", async () => {
  const publicId = `checkout_${crypto.randomUUID()}`;
  const [session] = await db.insert(checkoutSessions).values({ publicId,
    idempotencyKey: crypto.randomUUID(), customerType: "guest", fullName: "Double Capture",
    phone: "+201012345678", email: "double@example.com", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", cartSnapshot: "[]", amountCents: 3500,
    shippingAmountCents: 0, currency: "EGP", state: "completed", attemptCount: 1,
    reservationExpiresAt: new Date(Date.now() + 600000) }).$returningId();
  await db.insert(paymentAttempts).values({ checkoutSessionId: session.id, attemptNumber: 1,
    merchantReference: `capella_${crypto.randomUUID()}`, amountCents: 3500, currency: "EGP",
    environment: "test", status: "succeeded", paymobOrderId: "9026",
    paymobTransactionId: "7026", failureCode: "SECOND_CAPTURE_AFTER_SUCCESS" });
  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/orders/reconciliation", { headers: await getAdminAuthHeaders(request) });
    assert.equal(response.status, 200);
    const flagged = response.json.items.find((item: { paymobOrderId: string }) => item.paymobOrderId === "9026");
    assert.ok(flagged, "second-capture flag must be visible in ERP reconciliation");
    assert.equal(flagged.reason, "SECOND_CAPTURE_AFTER_SUCCESS");
  });
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.paymobOrderId, "9026"));
  assert.equal(attempt.status, "succeeded");
});

test("ERP reconciliation surfaces a parked callback inbox row without exposing its payload", async () => {
  const publicId = `checkout_${crypto.randomUUID()}`;
  const sessionId = await checkoutSession(publicId, "parked@example.com");
  await db.insert(paymentAttempts).values({ checkoutSessionId: sessionId, attemptNumber: 1,
    merchantReference: `capella_${crypto.randomUUID()}`, amountCents: 3500, currency: "EGP",
    environment: "test", status: "pending", paymobOrderId: "9030", paymobTransactionId: "7030",
    clientSecret: "never-expose-this" });
  const callbackId = await parkedCallback({ sessionId, orderId: "9030",
    reason: "REFUND_VERIFICATION_UNRESOLVED", receivedAt: new Date(Date.now() - 3600_000) });

  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/orders/reconciliation", { headers: await getAdminAuthHeaders(request) });
    assert.equal(response.status, 200);
    const problem = response.json.callbackProblems.find((row: { callbackId: number }) => row.callbackId === callbackId);
    assert.ok(problem, "a parked callback must be visible in ERP reconciliation even without a flagged attempt");
    assert.equal(problem.checkoutId, publicId);
    assert.equal(problem.customerEmail, "parked@example.com");
    assert.equal(problem.paymobOrderId, "9030");
    assert.equal(problem.paymobTransactionId, "7030");
    assert.equal(problem.reason, "REFUND_VERIFICATION_UNRESOLVED");
    assert.equal(problem.environment, "test");
    assert.ok(problem.ageMs >= 3600_000 - 5000, "age is derived from the trusted receipt time");
    assert.equal(response.text.includes("secret-card-token"), false, "provider payloads must never reach ERP");
    assert.equal(response.text.includes("never-expose-this"), false, "payment secrets must never reach ERP");
  });
});

test("ERP can requeue a parked callback for an idempotent retry", async () => {
  const callbackId = await parkedCallback({ reason: "PAYMENT_BINDING_UNRESOLVED" });

  await withTestServer(app, async (request) => {
    const response = await request(`/api/erp/orders/reconciliation/callbacks/${callbackId}/requeue`,
      { method: "POST", headers: await getAdminAuthHeaders(request) });
    assert.equal(response.status, 200);
  });

  const [row] = await db.select().from(paymobCallbackInbox).where(eq(paymobCallbackInbox.id, callbackId));
  assert.equal(row.processingStatus, "received", "a requeued callback is offered to the processor again");
  assert.equal(row.lastError, null);
  assert.equal(row.claimedBy, null, "the stale claim is cleared so a fresh worker can take it");
});

test("ERP cannot requeue a callback that already reached a terminal outcome", async () => {
  const callbackId = await parkedCallback({ status: "processed", reason: null });

  await withTestServer(app, async (request) => {
    const response = await request(`/api/erp/orders/reconciliation/callbacks/${callbackId}/requeue`,
      { method: "POST", headers: await getAdminAuthHeaders(request) });
    assert.equal(response.status, 409);
  });

  const [row] = await db.select().from(paymobCallbackInbox).where(eq(paymobCallbackInbox.id, callbackId));
  assert.equal(row.processingStatus, "processed");
});

test("requeuing a parked callback requires the payment-status permission", async () => {
  const callbackId = await parkedCallback();

  await withTestServer(app, async (request) => {
    const headers = await getStaffAuthHeaders(request, { permissionKeys: ["orders.read"] });
    const response = await request(`/api/erp/orders/reconciliation/callbacks/${callbackId}/requeue`,
      { method: "POST", headers });
    assert.equal(response.status, 403);
  });
});
