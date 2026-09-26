import assert from "node:assert/strict";
import { BOSTA_RATE_CONTEXT as CONTEXT } from "../helpers/bosta.js";
import test from "node:test";
import {
  buildRateIdentity,
  estimateShipmentSize,
  ShippingQuoteUnavailableError,
  ShippingUnsupportedDestinationError,
  resolveShippingQuote
} from "../../src/modules/shipping/bosta/bosta-quote.service.js";
import { BostaProviderError } from "../../src/modules/shipping/bosta/bosta-client.js";
import { BostaClient } from "../../src/modules/shipping/bosta/bosta-client.js";
import { BostaPricingService } from "../../src/modules/shipping/bosta/bosta-pricing.service.js";

// --- Size estimation boundaries (D06): products total after discounts, excl. shipping ---
test("size estimation: up to EGP 7,000 is Small", () => {
  assert.equal(estimateShipmentSize(700_000), "small"); // exactly 7,000.00
  assert.equal(estimateShipmentSize(0), "small");
});

test("size estimation: over EGP 7,000 up to EGP 20,000 is Medium", () => {
  assert.equal(estimateShipmentSize(700_001), "medium"); // 7,000.01
  assert.equal(estimateShipmentSize(2_000_000), "medium"); // exactly 20,000.00
});

test("size estimation: over EGP 20,000 is Large", () => {
  assert.equal(estimateShipmentSize(2_000_001), "large"); // 20,000.01
  assert.equal(estimateShipmentSize(999_999_999), "large");
});

// --- Quote resolution ---
const SUPPORTED = new Set(["district-1", "district-2"]);

function makeDeps(overrides: Partial<Parameters<typeof resolveShippingQuote>[1]> = {}) {
  return {
    isDestinationSupported: async (id: string) => SUPPORTED.has(id),
    fetchLiveRate: async () => null,
    loadSavedRate: async () => null,
    saveRate: async () => {},
    ...overrides
  };
}

const REQUEST = { districtId: "district-1", productsTotalCents: 500_000, rateContext: CONTEXT };

test("an unsupported destination is rejected before any pricing", async () => {
  await assert.rejects(
    resolveShippingQuote({ ...REQUEST, districtId: "nowhere" }, makeDeps()),
    (error: unknown) => {
      assert.ok(error instanceof ShippingUnsupportedDestinationError);
      return true;
    }
  );
});

test("a live rate produces a quote with a rate identity and saves it as the fallback", async () => {
  let saved: unknown = null;
  const quote = await resolveShippingQuote(REQUEST, makeDeps({
    fetchLiveRate: async () => ({ amountCents: 9_700, rateIdentity: buildRateIdentity(CONTEXT) }),
    saveRate: async (rate) => { saved = rate; }
  }));
  assert.equal(quote.shippingAmountCents, 9_700);
  assert.equal(quote.size, "small");
  assert.equal(quote.source, "live");
  assert.equal(quote.rateIdentity, buildRateIdentity(CONTEXT));
  assert.ok(quote.quoteId.length > 0);
  assert.deepEqual(saved, { ...CONTEXT, amountCents: 9_700 });
});

test("a saved rate is used when live pricing is unavailable, with no age expiry", async () => {
  const quote = await resolveShippingQuote(REQUEST, makeDeps({
    fetchLiveRate: async () => null,
    loadSavedRate: async () => ({ amountCents: 9_700, rateIdentity: buildRateIdentity(CONTEXT) })
  }));
  assert.equal(quote.shippingAmountCents, 9_700);
  assert.equal(quote.source, "saved");
});

test("no live and no saved rate blocks order placement", async () => {
  await assert.rejects(
    resolveShippingQuote(REQUEST, makeDeps()),
    (error: unknown) => {
      assert.ok(error instanceof ShippingQuoteUnavailableError);
      return true;
    }
  );
});

test("a saved rate for a different size is not reused for this quote", async () => {
  await assert.rejects(
    resolveShippingQuote({ ...REQUEST, productsTotalCents: 2_500_000 }, makeDeps({
      loadSavedRate: async () => ({ amountCents: 9_700, rateIdentity: "bosta:delivery:district-1:small:vat-incl" })
    })),
    (error: unknown) => {
      assert.ok(error instanceof ShippingQuoteUnavailableError);
      return true;
    }
  );
});

test("a saved rate for a different destination is not reused for this quote", async () => {
  await assert.rejects(
    resolveShippingQuote({ ...REQUEST, districtId: "district-2" }, makeDeps({
      loadSavedRate: async () => ({ amountCents: 9_700, rateIdentity: "bosta:delivery:district-1:small:vat-incl" })
    })),
    (error: unknown) => {
      assert.ok(error instanceof ShippingQuoteUnavailableError);
      return true;
    }
  );
});

// --- R01: thrown pricing failures must fall back to a valid saved rate (D16) ---

test("R01: a thrown live outage falls back to a valid saved rate", async () => {
  const quote = await resolveShippingQuote(REQUEST, makeDeps({
    fetchLiveRate: async () => { throw new BostaProviderError("pricing timeout", "ambiguous", null); },
    loadSavedRate: async () => ({ amountCents: 9_700, rateIdentity: buildRateIdentity(CONTEXT) })
  }));
  assert.equal(quote.shippingAmountCents, 9_700);
  assert.equal(quote.source, "saved");
});

test("R01: a thrown live outage with no saved rate blocks order placement", async () => {
  await assert.rejects(
    resolveShippingQuote(REQUEST, makeDeps({
      fetchLiveRate: async () => { throw new BostaProviderError("pricing timeout", "ambiguous", null); }
    })),
    (error: unknown) => {
      assert.ok(error instanceof ShippingQuoteUnavailableError);
      return true;
    }
  );
});

test("R01: a definitive live rejection does not fall back to a saved rate", async () => {
  await assert.rejects(
    resolveShippingQuote(REQUEST, makeDeps({
      fetchLiveRate: async () => { throw new BostaProviderError("unpriced destination", "definitive", 422); },
      loadSavedRate: async () => ({ amountCents: 9_700, rateIdentity: buildRateIdentity(CONTEXT) })
    })),
    (error: unknown) => {
      assert.ok(error instanceof ShippingQuoteUnavailableError);
      return true;
    }
  );
});

// --- R02: live identity and money must be validated ---

test("R02: a live rate for a different destination/size is rejected and never saved", async () => {
  let saved = false;
  await assert.rejects(
    resolveShippingQuote(REQUEST, makeDeps({
      fetchLiveRate: async () => ({ amountCents: 9_700, rateIdentity: buildRateIdentity({ ...CONTEXT, destinationId: "other-district", size: "large" }) }),
      saveRate: async () => { saved = true; }
    })),
    (error: unknown) => {
      assert.ok(error instanceof ShippingQuoteUnavailableError);
      return true;
    }
  );
  assert.equal(saved, false, "a mismatched live rate must never be persisted");
});

test("R02: negative, fractional and non-finite live amounts are rejected and never saved", async () => {
  for (const bad of [-100, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    let saved = false;
    await assert.rejects(
      resolveShippingQuote(REQUEST, makeDeps({
        fetchLiveRate: async () => ({ amountCents: bad, rateIdentity: buildRateIdentity(CONTEXT) }),
        saveRate: async () => { saved = true; }
      })),
      (error: unknown) => {
        assert.ok(error instanceof ShippingQuoteUnavailableError);
        return true;
      }
    );
    assert.equal(saved, false, `amount ${bad} must never be persisted`);
  }
});

test("R02: an invalid saved amount is not used as a price", async () => {
  await assert.rejects(
    resolveShippingQuote(REQUEST, makeDeps({
      fetchLiveRate: async () => null,
      loadSavedRate: async () => ({ amountCents: -50, rateIdentity: buildRateIdentity(CONTEXT) })
    })),
    (error: unknown) => {
      assert.ok(error instanceof ShippingQuoteUnavailableError);
      return true;
    }
  );
});

// ---  fallback limited to classified outages; inputs validated first ---
test(" a malformed-data or programming error does not silently succeed via fallback", async () => {
  await assert.rejects(
    resolveShippingQuote(REQUEST, makeDeps({
      fetchLiveRate: async () => { throw new Error("invalid provider price"); },
      loadSavedRate: async () => ({ amountCents: 9_700, rateIdentity: buildRateIdentity(CONTEXT) })
    })),
    (error: unknown) => {
      assert.ok(!(error instanceof ShippingQuoteUnavailableError) || /invalid/i.test(String(error)));
      return true;
    }
  );
});

test(" invalid products totals are rejected before any pricing work", async () => {
  for (const bad of [-1, Number.NaN, 12.5]) {
    await assert.rejects(
      resolveShippingQuote({ ...REQUEST, productsTotalCents: bad }, makeDeps({
        fetchLiveRate: async () => ({ amountCents: 9_700, rateIdentity: buildRateIdentity(CONTEXT) })
      }))
    );
  }
});

test(" malformed HTTP-200 JSON cannot return a saved success through client/pricing/quote", async () => {
  const client = new BostaClient({ enabled: true, canCallProvider: true, apiKey: "fixture-key",
    baseUrl: "https://stg-app.bosta.co/api/v2", webhookSecret: "fixture-secret", timeoutMs: 50 },
    async () => new Response("not json", { status: 200 }));
  const pricing = new BostaPricingService(query => client.get(`/pricing/shipment/calculator?${query}`), { small: "Normal" },
    { verified: true, evidence: "controlled test fixture", currency: "EGP", unit: "major", amountPath: ["data", "price"], vatIncluded: true, feesIncluded: true });
  await assert.rejects(resolveShippingQuote(REQUEST, makeDeps({
    fetchLiveRate: async () => ({ ...(await pricing.fetchRate({ dropOffCity: "Cairo", pickupCity: "Cairo", cod: 0, size: "small" })),
      rateIdentity: buildRateIdentity(CONTEXT) }),
    loadSavedRate: async () => ({ amountCents: 9700, rateIdentity: buildRateIdentity(CONTEXT) })
  })), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "BostaResponseValidationError");
    return true;
  });
});
