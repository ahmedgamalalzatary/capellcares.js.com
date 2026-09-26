import assert from "node:assert/strict";
import test from "node:test";
import { destination } from "../helpers/checkout-shipping.js";
import { deliverySettings, deliveryEnvironment as env, deliveryRateIdentity } from "../helpers/bosta-delivery.js";
const order = { id: 7, orderCode: "ABCD-007", fullName: "Buyer Name", phone: "01012345678", email: "buyer@example.com",
  addressLine: "Street 1", buildingApartment: "Building 2 apartment 3", notes: "Leave at reception", paymentMethod: "cod",
  totalAmount: "132.29", shippingAmountCents: 9729, shippingSize: "small", shippingQuoteId: "quote_fixture",
  shippingSnapshot: JSON.stringify({ quoteId: "quote_fixture", shippingAmountCents: 9729, size: "small", rateIdentity: deliveryRateIdentity(13229),
    quotedAt: "2026-09-26T00:00:00.000Z", productsTotalCents: 3500, amountCents: 13229, codAmountCents: 13229,
    paymentMethod: "cod", address: destination }) };
const items = [{ qty: 1, snapshotNameEn: "Serum", snapshotSizeLabel: "100ml", snapshotComponents: null,
  buyingPrice: "secret-buying-cost", lineTotal: "35.00" }];

async function adapter(environment = env, fetchImpl: typeof fetch = async () => { throw new Error("Unexpected network call"); }) {
  const module = await import("../../src/modules/shipping/bosta/bosta-delivery.service.js").catch(() => null);
  assert.ok(module?.bostaDeliveryProviderFromEnvironment, "Bosta delivery adapter is required");
  return module.bostaDeliveryProviderFromEnvironment(environment, fetchImpl);
}

test("delivery payload uses locked shipping-inclusive COD and English contents, preserving complete address and notes", async () => {
  const provider = await adapter();
  assert.ok(provider);
  const request = provider.buildRequest(order as any, items as any, "bosta_create_7");
  assert.equal(request.payload.cod, 132.29);
  assert.equal(request.payload.type, 10);
  assert.equal(request.payload.allowToOpenPackage, false);
  assert.equal(request.payload.dropOffAddress.districtId, destination.districtId);
  assert.equal(request.payload.dropOffAddress.firstLine, "Street 1, Building 2 apartment 3");
  assert.equal(request.payload.notes, "Leave at reception");
  assert.equal(request.payload.specs.size, "SMALL");
  assert.equal(request.payload.specs.packageType, "Parcel");
  assert.deepEqual(request.payload.specs.packageDetails, { itemsCount: 1, description: "Serum (100ml) x1" });
  assert.equal(request.payload.businessReference, "bosta_create_7");
  assert.equal(request.payload.receiver.phone, "+201012345678");
  assert.equal(JSON.stringify(request).includes("secret-buying-cost"), false);
  assert.equal(Object.hasOwn(request.payload, "goodsInfo"), false);
  assert.equal(Object.hasOwn(request.payload, "pickupAddress"), false);
  assert.equal(Object.hasOwn(request.payload, "webhookCustomHeaders"), false);
});

test("sending stays off by default and unverified account/default/insurance/lookup settings block provider calls", async () => {
  assert.equal(await adapter({ ...env, BOSTA_SHIPMENT_SENDING_ENABLED: "false" }), null);
  assert.equal(await adapter({ ...env, BOSTA_ENABLED: "false" }), null);
  for (const change of [{ accountVerified: false }, { pickupDefaultsVerified: false }, { noInsuranceVerified: false },
    { lookupContract: { ...deliverySettings.lookupContract, verified: false } }, { codUnit: "minor" }]) {
    await assert.rejects(adapter({ ...env, BOSTA_DELIVERY_SETTINGS_JSON: JSON.stringify({ ...deliverySettings, ...change }) }));
  }
});

test("create stores initial tracking/state/response and a malformed success remains uncertain", async () => {
  let body: any;
  const provider = await adapter(env, async (input, init) => {
    assert.equal(String(input), `${env.BOSTA_BASE_URL}/deliveries?apiVersion=1`);
    body = JSON.parse(String(init?.body));
    return Response.json({ success: true, data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" },
      echoed: "fixture-secret-key" } });
  });
  const request = provider!.buildRequest(order as any, items as any, "bosta_create_7");
  const created = await provider!.create(request);
  assert.equal(body.cod, 132.29);
  assert.equal(created.trackingNumber, "5108002");
  assert.equal(created.rawProviderCode, 10);
  assert.equal(created.rawProviderState, "Pickup requested");
  assert.equal(JSON.stringify(created.rawResponse).includes("fixture-secret-key"), false);
  const malformed = await adapter(env, async () => Response.json({ success: true, data: {} }));
  await assert.rejects(malformed!.create(request), (error: any) => error.kind === "ambiguous");
});

test("uncertain creates correlate a unique search result to its complete delivery, never trusting reference uniqueness alone", async () => {
  let matches = 1;
  let cod = 132.29;
  const provider = await adapter(env, async (input, init) => {
    if (String(input).endsWith("/deliveries/search")) {
      assert.equal(JSON.parse(String(init?.body)).businessReference, "bosta_create_7");
      return Response.json({ success: true, data: { total: matches,
        deliveries: Array.from({ length: matches }, () => ({ businessReference: "bosta_create_7", trackingNumber: "5108002" })) } });
    }
    return Response.json({ success: true, data: { type: 10, businessReference: "bosta_create_7", trackingNumber: "5108002",
      cod, specs: { size: "SMALL" }, receiver: { phone: "+201012345678" },
      dropOffAddress: { districtId: destination.districtId, firstLine: "Street 1, Building 2 apartment 3" },
      state: { code: 10, value: "Pickup requested" } } });
  });
  const request = provider!.buildRequest(order as any, items as any, "bosta_create_7");
  assert.equal((await provider!.reconcile(request))?.trackingNumber, "5108002");
  cod = 35;
  await assert.rejects(provider!.reconcile(request), /correlation/i);
  matches = 2;
  await assert.rejects(provider!.reconcile(request), /unique/i);
  matches = 0;
  assert.equal(await provider!.reconcile(request), null);
});

test("HTTP timeout/conflict during create remain uncertain rather than permitting an unsafe new delivery", async () => {
  for (const status of [408, 409]) {
    const provider = await adapter(env, async () => Response.json({ message: "outcome unknown" }, { status }));
    await assert.rejects(provider!.create(provider!.buildRequest(order as any, items as any, "bosta_create_7")),
      (error: any) => error.kind === "ambiguous");
  }
});

test("an order quoted against another merchant account cannot be sent before its delivery request is frozen", async () => {
  const provider = await adapter({ ...env, BOSTA_DELIVERY_SETTINGS_JSON: JSON.stringify({ ...deliverySettings, accountId: "different-account" }) });
  assert.throws(() => provider!.buildRequest(order as any, items as any, "bosta_create_7"), /account|rate/i);
});

test("the verified default pickup city must match the city used for the locked quote", async () => {
  const provider = await adapter({ ...env, BOSTA_DELIVERY_SETTINGS_JSON: JSON.stringify({ ...deliverySettings, defaultPickupCity: "Alexandria" }) });
  assert.throws(() => provider!.buildRequest(order as any, items as any, "bosta_create_7"), /pickup/i);
});

test("saved provider responses redact secrets with JSON escape characters in nested strings and keys", async () => {
  const apiKey = 'fixture"secret\\key';
  const webhookSecret = 'webhook"secret\\key';
  const provider = await adapter({ ...env, BOSTA_API_KEY: apiKey, BOSTA_WEBHOOK_SECRET: webhookSecret }, async () =>
    Response.json({ success: true, data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" },
      echo: { api: apiKey, webhook: [webhookSecret], [apiKey]: webhookSecret } } }));
  const result = await provider!.create(provider!.buildRequest(order as any, items as any, "bosta_create_7"));
  assert.deepEqual((result.rawResponse as any).data.echo,
    { api: "[redacted]", webhook: ["[redacted]"], "[redacted]": "[redacted]" });
});

test("prepaid delivery collects zero and bundle counts use sold component quantities without buying costs", async () => {
  const quote = JSON.parse(order.shippingSnapshot);
  const prepaid = { ...order, paymentMethod: "paymob", shippingSnapshot: JSON.stringify({ ...quote, paymentMethod: "paymob",
    codAmountCents: 0, rateIdentity: deliveryRateIdentity(0, "prepaid") }) };
  const provider = await adapter();
  const request = provider!.buildRequest(prepaid as any, [{ ...items[0], qty: 1, snapshotNameEn: "Bundle",
    snapshotComponents: JSON.stringify([{ variantId: 1, qty: 2, unitPrice: 35, sizeLabel: "100ml" }, { variantId: 2, qty: 1 }]) }] as any, "bosta_create_7");
  assert.equal(request.payload.cod, 0);
  assert.equal(request.payload.specs.packageDetails.itemsCount, 3);
});
