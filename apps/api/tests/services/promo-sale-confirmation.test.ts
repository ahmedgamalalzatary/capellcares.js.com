import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { promoCodes, variantDiscounts } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { PromoConfirmationRequiredError } from "../../src/modules/promos/promo-checkout.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

// A code that replaces a sale is ordered only with the customer's confirmation of those exact items and prices (spec sections 3.4, 7).
beforeEach(resetApiTestDatabase);

const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
  apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
const urls = { notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook", redirectionUrl: "https://capellacares.com/checkout/payment-result" };

async function code(overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "ROUND2", codeNormalized: "ROUND2", arName: "خصم", enName: "Round", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "10.00", eligibilityScope: "all", ...overrides }).$returningId();
  return row!.id;
}

async function buyer(paymentMethod: "cod" | "paymob" = "paymob", qty = 1) {
  const ids = await getBaselineIds();
  return { ids, payload: { fullName: "Round Two", phone: "01012345678", email: "round2@capella.test", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", paymentMethod, customerId: ids.customerId, promoCode: "round2",
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty }] } };
}

let providerOrder = 9300;
async function initiate(payload: Awaited<ReturnType<typeof buyer>>["payload"], idempotencyKey: string = crypto.randomUUID()) {
  const orderId = ++providerOrder;
  const result = await initiatePaymobCheckout({ payload, idempotencyKey, config, ...urls,
    createIntention: async () => ({ intentionId: `pi_${orderId}`, orderId, clientSecret: `secret_${orderId}`, checkoutUrl: "https://checkout" }) });
  return { providerOrderId: orderId, result };
}

test("checkout refuses a code whose sale replacement the customer did not confirm, and accepts the confirmed one", async () => {
  const { ids, payload } = await buyer("cod");
  await db.insert(variantDiscounts).values({ variantId: ids.firstVariantId, type: "percentage", value: "30.00",
    startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000), status: "active" });
  await code();
  const priced = await priceCheckout(payload);
  const replaced = priced.promo!.dto.status === "applied" ? priced.promo!.dto.replacedSales : [];
  assert.equal(replaced.length, 1);

  await assert.rejects(createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() }),
    (error: unknown) => error instanceof PromoConfirmationRequiredError);
  const stale = replaced.map((sale) => ({ item: sale.item!, previousLineTotal: sale.previousLineTotal, lineTotal: sale.lineTotal + 1 }));
  await assert.rejects(createOrderFromCheckout({ ...payload, promoAcceptedSales: stale }, { idempotencyKey: crypto.randomUUID() }),
    (error: unknown) => error instanceof PromoConfirmationRequiredError);
  const accepted = replaced.map((sale) => ({ item: sale.item!, previousLineTotal: sale.previousLineTotal, lineTotal: sale.lineTotal }));
  const order = await createOrderFromCheckout({ ...payload, promoAcceptedSales: accepted }, { idempotencyKey: crypto.randomUUID() });
  assert.ok(order.id > 0);

  // Online checkout is held to the same confirmation.
  await assert.rejects(initiate({ ...payload, paymentMethod: "paymob", email: "round2-online@capella.test" }),
    (error: unknown) => error instanceof PromoConfirmationRequiredError);
});

test("the checkout API answers an unconfirmed sale replacement with 409 PROMO_CONFIRMATION_REQUIRED and the current replacements", async () => {
  const { ids, payload } = await buyer("cod");
  await db.insert(variantDiscounts).values({ variantId: ids.firstVariantId, type: "percentage", value: "30.00",
    startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000), status: "active" });
  await code();
  const jwt = (await import("jsonwebtoken")).default;
  const token = jwt.sign({ sub: ids.customerId, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" });
  const { customerId: _customerId, ...body } = payload;
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", { method: "POST", body: JSON.stringify(body),
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() } });
    assert.equal(response.status, 409, JSON.stringify(response.json));
    assert.equal(response.json.code, "PROMO_CONFIRMATION_REQUIRED");
    assert.equal(response.json.promo.replacedSales.length, 1);
  });
});
