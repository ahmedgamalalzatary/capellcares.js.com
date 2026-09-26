import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { db } from "@capella/database/src/db";
import { shippingRates } from "@capella/database/drizzle/schema";
import { createBostaQuoteService } from "../../src/modules/shipping/bosta/bosta-quote-composition.js";
import { loadBostaConfig } from "../../src/modules/shipping/bosta/bosta-config.js";
import { BostaResponseValidationError } from "../../src/modules/shipping/bosta/bosta-client.js";
import { BOSTA_RESPONSE_CONTRACT } from "../helpers/bosta.js";
import { shippingQuoteResponseSchema } from "@capella/shared";
import { createCheckoutShippingService } from "../../src/modules/shipping/checkout-shipping.service.js";

beforeEach(async () => { await db.delete(shippingRates); });
const CONFIG = loadBostaConfig({ BOSTA_ENABLED: "true", BOSTA_API_KEY: "fixture-key",
  BOSTA_WEBHOOK_SECRET: "fixture-secret", BOSTA_BASE_URL: "https://stg-app.bosta.co/api/v2" });
const SETTINGS = { accountVerified: true, accountEvidence: "controlled account fixture",
  accountId: "fixture-account", pickupCity: "Cairo", codUnit: "major" as const, sizeMapping: { small: "Normal" },
  responseContract: BOSTA_RESPONSE_CONTRACT };
const REQUEST = { cityId: "city-cairo", districtId: "district-1", productsTotalCents: 500_000,
  paymentMethod: "prepaid" as const, codAmountCents: 0 };
const DISTRICTS = { success: true, data: [{ cityId: "city-cairo", cityName: "Cairo",
  districts: [{ districtId: "district-1", dropOffAvailability: true }] }] };

function provider(price: () => Response, seen: URL[] = []): typeof fetch {
  return async input => {
    const url = new URL(String(input));
    seen.push(url);
    if (url.pathname.endsWith("/cities/getAllDistricts")) {
      return Response.json(DISTRICTS);
    }
    assert.ok(url.pathname.endsWith("/pricing/shipment/calculator"));
    return price();
  };
}

test("real adapters save a live rate and a fresh service loads it during pricing outage", async () => {
  const seen: URL[] = [];
  const live = createBostaQuoteService(CONFIG, SETTINGS, provider(() => Response.json({ data: { price: "97.29" } }), seen));
  const quote = await live.quote(REQUEST);
  assert.equal(quote.shippingAmountCents, 9729);
  assert.equal(quote.source, "live");
  assert.equal(shippingQuoteResponseSchema.safeParse(quote).success, true);
  const calculator = seen.find(url => url.pathname.endsWith("/pricing/shipment/calculator"))!;
  assert.equal(calculator.searchParams.get("pickupCity"), "Cairo");
  assert.equal(calculator.searchParams.get("dropOffCity"), "Cairo");
  assert.equal(Number(calculator.searchParams.get("cod")), 0);
  const outage = createBostaQuoteService(CONFIG, SETTINGS, provider(() => new Response("unavailable", { status: 503 })));
  const fallback = await outage.quote(REQUEST);
  assert.equal(fallback.source, "saved");
  assert.equal(fallback.shippingAmountCents, 9729);
  assert.equal(fallback.rateIdentity, quote.rateIdentity);
  for (const different of [
    { ...SETTINGS, accountId: "other-account" }, { ...SETTINGS, pickupCity: "Alexandria" },
    { ...SETTINGS, responseContract: { ...BOSTA_RESPONSE_CONTRACT, unit: "minor" as const } }
  ]) {
    await assert.rejects(createBostaQuoteService(CONFIG, different, provider(() => new Response(null, { status: 503 }))).quote(REQUEST));
  }
  await assert.rejects(outage.quote({ ...REQUEST, paymentMethod: "cod", codAmountCents: 500_000 }));
});

test("malformed pricing and definitive rejection never become saved success through real adapters", async () => {
  await createBostaQuoteService(CONFIG, SETTINGS, provider(() => Response.json({ data: { price: 97 } }))).quote(REQUEST);
  for (const response of [() => new Response("not json"), () => Response.json({ data: { price: "" } }),
    () => Response.json({ data: { amount: 97 } })]) {
    await assert.rejects(createBostaQuoteService(CONFIG, SETTINGS, provider(response)).quote(REQUEST), BostaResponseValidationError);
  }
  await assert.rejects(createBostaQuoteService(CONFIG, SETTINGS,
    provider(() => new Response(null, { status: 422 }))).quote(REQUEST));
});

test("inactive or unverified pricing/account settings do not request or load a quote", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => { calls++; return Response.json(DISTRICTS); };
  await assert.rejects(createBostaQuoteService(loadBostaConfig({}), SETTINGS, fetchImpl).quote(REQUEST), /inactive/i);
  for (const settings of [{ ...SETTINGS, accountVerified: false }, { ...SETTINGS, accountEvidence: "" },
    { ...SETTINGS, responseContract: { ...BOSTA_RESPONSE_CONTRACT, vatIncluded: false } },
    { ...SETTINGS, sizeMapping: {} }]) {
    await assert.rejects(createBostaQuoteService(CONFIG, settings, fetchImpl).quote(REQUEST));
  }
  assert.equal(calls, 0);
});

test("mismatched city, unavailable district and invalid money stop before pricing", async () => {
  const seen: URL[] = [];
  const service = createBostaQuoteService(CONFIG, SETTINGS, provider(() => Response.json({ data: { price: 97 } }), seen));
  for (const request of [{ ...REQUEST, cityId: "other-city" }, { ...REQUEST, districtId: "unknown" },
    { ...REQUEST, productsTotalCents: -1 }, { ...REQUEST, codAmountCents: 100 }]) {
    await assert.rejects(service.quote(request));
  }
  assert.ok(seen.every(url => url.pathname.endsWith("/cities/getAllDistricts")));
  assert.equal((await db.select().from(shippingRates)).length, 0);
});

test("COD calculator input preserves cents without a guessed fee or currency conversion", async () => {
  const seen: URL[] = [];
  await createBostaQuoteService(CONFIG, SETTINGS, provider(() => Response.json({ data: { price: "100.00" } }), seen))
    .quote({ ...REQUEST, paymentMethod: "cod", codAmountCents: 500_029 });
  assert.equal(seen[1].searchParams.get("cod"), "5000.29");
});

test("minor-unit COD contract sends integer cents and cannot reuse a major-unit rate", async () => {
  const seen: URL[] = [];
  const service = createBostaQuoteService(CONFIG, { ...SETTINGS, codUnit: "minor" },
    provider(() => Response.json({ data: { price: 97 } }), seen));
  await service.quote({ ...REQUEST, paymentMethod: "cod", codAmountCents: 29 });
  assert.equal(seen[1].searchParams.get("cod"), "29");
  const majorUnitOutage = createBostaQuoteService(CONFIG, SETTINGS, provider(() => new Response(null, { status: 503 })));
  await assert.rejects(majorUnitOutage.quote({ ...REQUEST, paymentMethod: "cod", codAmountCents: 29 }));
});

test("a shipping-inclusive COD checkout reuses its validated address list across calculator iterations", async () => {
  let addressDownloads = 0;
  const providerService = createBostaQuoteService(CONFIG, SETTINGS, async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/cities/getAllDistricts")) {
      addressDownloads++;
      return Response.json({ success: true, data: [{ cityId: "city-cairo", cityName: "Cairo",
        districts: [{ districtId: "district-1", zoneId: "zone-1", zoneName: "Nasr City",
          districtName: "District 1", dropOffAvailability: true }] }] });
    }
    return Response.json({ data: { price: Number(url.searchParams.get("cod")) < 100 ? "97.00" : "98.00" } });
  });
  const service = createCheckoutShippingService({ ...providerService, codPricingPolicy: "collection_total" });
  const quote = await service.quoteCheckout({ paymentMethod: "cod",
    items: [{ type: "product", variantId: 1, qty: 1 }],
    shippingAddress: { cityId: "city-cairo", zoneId: "zone-1", districtId: "district-1" }
  }, { items: [], totalAmount: 35 });
  assert.equal(quote.shippingAmountCents, 9800);
  assert.equal(quote.codAmountCents, 13300);
  assert.equal(quote.address.districtId, "district-1");
  assert.equal(addressDownloads, 1);
});
