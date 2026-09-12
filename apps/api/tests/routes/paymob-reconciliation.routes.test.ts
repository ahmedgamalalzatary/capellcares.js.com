import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, paymentAttempts } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(resetApiTestDatabase);

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
