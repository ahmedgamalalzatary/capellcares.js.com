import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";

import { db } from "@capella/database/src/db";
import { promoCodes, variantDiscounts } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { PromoConfirmationRequiredError } from "../../src/modules/promos/promo-checkout.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

// A code that replaces a sale is ordered only with the customer's confirmation of those exact items and prices (spec sections 3.4, 7).
beforeEach(resetApiTestDatabase);

async function code(overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "ROUND2", codeNormalized: "ROUND2", arName: "خصم", enName: "Round", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "10.000", eligibilityScope: "all", ...overrides }).$returningId();
  return row!.id;
}

async function buyerOnSale() {
  const ids = await getBaselineIds();
  await db.insert(variantDiscounts).values({ variantId: ids.firstVariantId, type: "percentage", value: "30.000",
    startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000), status: "active" });
  await code();
  return { ids, payload: { fullName: "Round Two", phone: "55123456", email: "round2@capella.test", areaId: ids.areaId,
    addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod" as const, customerId: ids.customerId, promoCode: "round2",
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] } };
}

test("checkout refuses a code whose sale replacement the customer did not confirm, and accepts the confirmed one", async () => {
  const { payload } = await buyerOnSale();
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
});

test("the checkout API answers an unconfirmed sale replacement with 409 PROMO_CONFIRMATION_REQUIRED and the current replacements", async () => {
  const { ids, payload } = await buyerOnSale();
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
