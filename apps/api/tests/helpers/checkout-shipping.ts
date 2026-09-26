import { createCheckoutShippingService } from "../../src/modules/shipping/checkout-shipping.service.js";
import { BOSTA_RESPONSE_CONTRACT } from "./bosta.js";
export const destination = { cityId: "city-cairo", zoneId: "zone-nasr", districtId: "district-nasr",
  cityName: { en: "Cairo", ar: "القاهرة" }, zoneName: { en: "Nasr City", ar: "مدينة نصر" },
  districtName: { en: "District 1", ar: "الحي الأول" } };
export const selectedDestination = { cityId: destination.cityId, zoneId: destination.zoneId, districtId: destination.districtId };
export const shippingBuyer = { fullName: "Shipping Buyer", phone: "01012345678", email: "shipping-buyer@example.com",
  governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod" as const };
export function fixtureShippingService(price = 9729, rateIdentity?: (cod: number) => string) {
  return createCheckoutShippingService({ codPricingPolicy: "collection_total", listDestinations: async () => [destination],
    quote: async input => ({ shippingAmountCents: price, size: "small", rateIdentity: rateIdentity?.(input.codAmountCents) ?? `fixture:${input.paymentMethod}:${input.codAmountCents}`,
      source: "live", quotedAt: new Date().toISOString(), quoteId: "provider-fixture" }) });
}
export async function withShippingEnvironment(run: () => Promise<void>, configured = true, price = "97.29") {
  const env = { BOSTA_ENABLED: "true", BOSTA_API_KEY: "fixture-key", BOSTA_WEBHOOK_SECRET: "fixture-secret",
    BOSTA_BASE_URL: "https://stg-app.bosta.co/api/v2", BOSTA_QUOTE_SETTINGS_JSON: configured ? JSON.stringify({
      accountVerified: true, accountEvidence: "synthetic fixture", accountId: "fixture", pickupCity: "Cairo", codUnit: "major",
      codPricingPolicy: "collection_total", sizeMapping: { small: "Normal", medium: "FixtureMedium", large: "FixtureLarge" }, responseContract: BOSTA_RESPONSE_CONTRACT
    }) : "{}" };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const realFetch = globalThis.fetch;
  Object.assign(process.env, env);
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (!url.hostname.includes("bosta.co")) return realFetch(input, init);
    if (url.pathname.endsWith("/cities/getAllDistricts")) return Response.json({ success: true, data: [{
      cityId: destination.cityId, cityName: destination.cityName.en, cityOtherName: destination.cityName.ar,
      districts: [{ zoneId: destination.zoneId, zoneName: destination.zoneName.en, zoneOtherName: destination.zoneName.ar,
        districtId: destination.districtId, districtName: destination.districtName.en, districtOtherName: destination.districtName.ar, dropOffAvailability: true }]
    }] });
    if (url.pathname.endsWith("/pricing/shipment/calculator")) return Response.json({ data: { price } });
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  try { await run(); } finally {
    globalThis.fetch = realFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
