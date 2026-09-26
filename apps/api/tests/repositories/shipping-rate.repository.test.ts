import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { shippingRates } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { resetApiTestDatabase } from "../helpers/database.js";
import {
  loadSavedShippingRate,
  saveShippingRate
} from "../../src/repositories/shipping-rate.repository.js";
import { buildRateIdentity } from "../../src/modules/shipping/bosta/bosta-rate-context.js";
import { BOSTA_RATE_CONTEXT } from "../helpers/bosta.js";

beforeEach(async () => {
  await resetApiTestDatabase();
  await db.delete(shippingRates);
});

const DELIVERY = BOSTA_RATE_CONTEXT;

test("saves and loads a rate by its identity", async () => {
  await saveShippingRate({ ...DELIVERY, amountCents: 9_700 });
  const saved = await loadSavedShippingRate(DELIVERY);
  assert.equal(saved?.amountCents, 9_700);
  assert.equal(saved?.rateIdentity, buildRateIdentity(DELIVERY));
});

test("upserts a replacement rate for the same identity without duplicating", async () => {
  await saveShippingRate({ ...DELIVERY, amountCents: 9_700 });
  await saveShippingRate({ ...DELIVERY, amountCents: 10_200 });
  const rows = await db.select().from(shippingRates).where(eq(shippingRates.rateKey, buildRateIdentity(DELIVERY)));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amountCents, 10_200);
});

test("a saved rate for one identity is not returned for another", async () => {
  await saveShippingRate({ ...DELIVERY, amountCents: 9_700 });
  const other = await loadSavedShippingRate({ ...DELIVERY, destinationId: "district-2", size: "large" });
  assert.equal(other, null);
});

test("rejects an invalid amount instead of persisting it", async () => {
  await assert.rejects(saveShippingRate({ ...DELIVERY, amountCents: -1 }));
  await assert.rejects(saveShippingRate({ ...DELIVERY, amountCents: 12.5 }));
  const rows = await db.select().from(shippingRates);
  assert.equal(rows.length, 0);
});

test(" different services for the same destination/size coexist without overwrite", async () => {
  await saveShippingRate({ ...DELIVERY, amountCents: 9_700 });
  await saveShippingRate({ ...DELIVERY, serviceType: "exchange", amountCents: 11_200 });

  const delivery = await loadSavedShippingRate(DELIVERY);
  const exchange = await loadSavedShippingRate({ ...DELIVERY, serviceType: "exchange" });

  assert.equal(delivery?.amountCents, 9_700, "the delivery rate must survive saving an exchange rate");
  assert.equal(exchange?.amountCents, 11_200);
  assert.equal(delivery?.rateIdentity, buildRateIdentity(DELIVERY));
  assert.equal(exchange?.rateIdentity, buildRateIdentity({ ...DELIVERY, serviceType: "exchange" }));
});

test("pickup, account, environment, payment and COD rates coexist and cannot cross-load", async () => {
  const variants = [
    BOSTA_RATE_CONTEXT,
    { ...BOSTA_RATE_CONTEXT, pickupCity: "Alexandria" },
    { ...BOSTA_RATE_CONTEXT, accountId: "other-account" },
    { ...BOSTA_RATE_CONTEXT, environment: "https://app.bosta.co/api/v2" },
    { ...BOSTA_RATE_CONTEXT, paymentMethod: "cod" as const, codAmountCents: 500_000 },
    { ...BOSTA_RATE_CONTEXT, paymentMethod: "cod" as const, codAmountCents: 600_000 }
  ];
  for (const [index, context] of variants.entries()) {
    await saveShippingRate({ ...context, amountCents: 9700 + index });
  }
  for (const [index, context] of variants.entries()) {
    assert.equal((await loadSavedShippingRate(context))?.amountCents, 9700 + index);
  }
  assert.equal(await loadSavedShippingRate({ ...BOSTA_RATE_CONTEXT, pricingContractId: "other-contract" }), null);
});
