import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { db } from "@capella/database/src/db";
import * as schema from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { resetApiTestDatabase, getBaselineIds } from "../helpers/database.js";
import { priceCheckout, createOrderFromCheckout } from "../../src/modules/orders/orders.service.js";

export const address = { cityId: "city-cairo", zoneId: "zone-nasr", districtId: "district-nasr",
  cityName: { en: "Cairo", ar: "القاهرة" }, zoneName: { en: "Nasr City", ar: "مدينة نصر" },
  districtName: { en: "District 1", ar: "الحي الأول" } };
const selected = { cityId: address.cityId, zoneId: address.zoneId, districtId: address.districtId };
export const buyer = { fullName: "Shipping Buyer", phone: "01012345678", email: "shipping-buyer@example.com",
  governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod" as const };

beforeEach(async () => {
  await resetApiTestDatabase();
  if ((schema as any).shippingCheckoutQuotes) await db.delete((schema as any).shippingCheckoutQuotes);
});

async function setup(price: (cod: number) => number = () => 9729) {
  const module = await import("../../src/modules/shipping/checkout-shipping.service.js").catch(() => null);
  assert.ok(module?.createCheckoutShippingService, "durable checkout quote service is required");
  const ids = await getBaselineIds();
  const payload = { ...buyer, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }], shippingAddress: selected };
  const priced = await priceCheckout(payload);
  const service = module.createCheckoutShippingService({
    codPricingPolicy: "collection_total",
    listDestinations: async () => [address],
    quote: async (input: any) => ({ shippingAmountCents: price(input.codAmountCents), size: "small",
      rateIdentity: `fixture:${input.paymentMethod}:${input.codAmountCents}`, source: "live", quotedAt: new Date().toISOString(), quoteId: "provider-quote" })
  });
  return { service, payload, priced, ids };
}

test("COD quote persists the server products total and quotes the shipping-inclusive collection amount", async () => {
  const { service, payload, priced } = await setup(cod => cod < 10_000 ? 9700 : 9800);
  const quote = await service.quoteCheckout(payload, priced);
  assert.equal(quote.productsTotalCents, 3500);
  assert.equal(quote.shippingAmountCents, 9800);
  assert.equal(quote.amountCents, 13300);
  assert.equal(quote.codAmountCents, 13300);
  assert.equal(quote.rateIdentity, "fixture:cod:13300");
  const [stored] = await db.select().from((schema as any).shippingCheckoutQuotes).where(eq((schema as any).shippingCheckoutQuotes.quoteId, quote.quoteId));
  assert.equal(JSON.parse(stored.snapshot).amountCents, 13300);
  assert.deepEqual(quote.address, address);
});

test("refreshing an unchanged quote reuses its durable identity so checkout retries keep the same request key", async () => {
  const { service, payload, priced } = await setup();
  const first = await service.quoteCheckout(payload, priced);
  const second = await service.quoteCheckout(payload, priced);
  assert.deepEqual(second, first);
});

test("quote revalidation accepts its matching cart and rejects cart, owner, destination or payment changes", async () => {
  const { service, payload, priced } = await setup();
  const quote = await service.quoteCheckout(payload, priced);
  assert.equal((await service.resolve({ ...payload, shippingQuoteId: quote.quoteId }, priced)).shippingAmountCents, 9729);
  for (const changed of [
    { ...payload, customerId: 1 }, { ...payload, paymentMethod: "paymob" },
    { ...payload, shippingAddress: { ...selected, zoneId: "another-zone" } },
    { ...payload, items: [{ ...payload.items[0], qty: 2 }] }
  ]) await assert.rejects(service.resolve({ ...changed, shippingQuoteId: quote.quoteId }, priced), /quote|changed/i);
  await assert.rejects(service.resolve({ ...payload, shippingQuoteId: "missing" }, priced), /quote/i);
  await assert.rejects(service.resolve(payload, priced), /quote/i);
});

test("a price change on revalidation cannot silently replace the agreed shipping charge", async () => {
  let charge = 9729;
  const { service, payload, priced } = await setup(() => charge);
  const quote = await service.quoteCheckout(payload, priced);
  charge = 10000;
  await assert.rejects(service.resolve({ ...payload, shippingQuoteId: quote.quoteId }, priced), /changed/i);
});

test("prepaid quote collects zero and nonconverging COD fees block checkout", async () => {
  const { service, payload, priced } = await setup(cod => cod + 100);
  const prepaid = await service.quoteCheckout({ ...payload, paymentMethod: "paymob" }, priced);
  assert.equal(prepaid.codAmountCents, 0);
  assert.equal(prepaid.shippingAmountCents, 100);
  await assert.rejects(service.quoteCheckout(payload, priced), /unavailable|converg/i);
});

test("COD saves immutable quote/address snapshots and stays pending when only products are free", async () => {
  const { service, payload, ids } = await setup();
  await db.insert(schema.variantDiscounts).values({ variantId: ids.firstVariantId, type: "percentage", value: "100.00",
    startsAt: new Date(Date.now() - 60000), endsAt: new Date(Date.now() + 60000), status: "active" });
  const priced = await priceCheckout(payload);
  const quote = await service.quoteCheckout(payload, priced);
  const request = { ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: 9729 };
  const options = { idempotencyKey: crypto.randomUUID(), shippingService: service };
  const created = await createOrderFromCheckout(request, options);
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, created.id));
  assert.equal(created.paymentStatus, "pending");
  assert.equal(Number(order.totalAmount), 97.29);
  assert.equal(order.shippingAmountCents, 9729);
  assert.equal(order.shippingQuoteId, quote.quoteId);
  assert.equal(order.shippingSize, "small");
  assert.deepEqual(JSON.parse((order as any).shippingSnapshot), quote);
  assert.ok(order.codExpiresAt);
  assert.equal((await createOrderFromCheckout(request, options)).replayed, true);
  const [stock] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, ids.firstVariantId));
  assert.equal(stock.stockQty, 9);
});

test("a products-only expected amount cannot authorize a shipping-inclusive COD order", async () => {
  const { service, payload, priced, ids } = await setup();
  const quote = await service.quoteCheckout(payload, priced);
  await assert.rejects(createOrderFromCheckout({ ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: 3500 },
    { idempotencyKey: crypto.randomUUID(), shippingService: service }), /changed/i);
  assert.equal((await db.select().from(schema.orders)).length, 0);
  const [stock] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, ids.firstVariantId));
  assert.equal(stock.stockQty, 10);
});
