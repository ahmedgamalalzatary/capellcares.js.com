import { createHash } from "node:crypto";
import { z } from "zod";
import { shippingMoneyCentsSchema } from "@capella/shared";
import { loadSavedShippingRate, saveShippingRate } from "../../../repositories/shipping-rate.repository.js";
import { BostaAddressService } from "./bosta-address.service.js";
import { BostaClient, BostaResponseValidationError } from "./bosta-client.js";
import type { BostaConfig } from "./bosta-config.js";
import { BostaPricingService, buildShipmentCalculatorQuery, validatePricingResponseContract,
  type PricingResponseContract, type SizeMapping } from "./bosta-pricing.service.js";
import { buildRateIdentity, shippingRateAmountSchema, validateShippingRateContext } from "./bosta-rate-context.js";
import { estimateShipmentSize, resolveShippingQuote, ShippingUnsupportedDestinationError } from "./bosta-quote.service.js";

/** Server-owned settings require account evidence; never accept these from checkout. */
export type BostaQuoteSettings = {
  accountVerified: boolean;
  accountEvidence: string;
  accountId: string;
  pickupCity: string;
  codUnit: "major" | "minor";
  sizeMapping: SizeMapping;
  responseContract: PricingResponseContract;
};

export function bostaPricingContractId(account: BostaQuoteSettings): string {
  return createHash("sha256").update(JSON.stringify([
    account.accountEvidence, account.codUnit, account.responseContract,
    Object.entries(account.sizeMapping).sort(([a], [b]) => a.localeCompare(b))
  ])).digest("hex");
}

const requestSchema = z.object({
  cityId: z.string().min(1).max(64),
  districtId: z.string().min(1).max(64),
  productsTotalCents: shippingMoneyCentsSchema,
  paymentMethod: z.enum(["cod", "prepaid"]),
  codAmountCents: shippingRateAmountSchema
}).refine(request => request.paymentMethod === "cod" || request.codAmountCents === 0,
  "Prepaid delivery must collect zero COD");
export type BostaQuoteInput = z.infer<typeof requestSchema>;

/**
 * Concrete S04 composition, deliberately not registered in checkout before S05.
 * Money inputs come from server pricing. COD charge policy remains O06; this
 * service quotes the supplied collection amount without inventing that policy.
 */
export function createBostaQuoteService(config: BostaConfig, settings: BostaQuoteSettings, fetchImpl: typeof fetch = fetch) {
  const account = structuredClone(settings);
  const client = new BostaClient(config, fetchImpl);
  const addresses = new BostaAddressService(() => client.get("/cities/getAllDistricts?countryId=60e4482c7cb7d4bc4849c4d5"));
  const pricing = new BostaPricingService(query => client.get(`/pricing/shipment/calculator?${query}`),
    account.sizeMapping, account.responseContract);

  return {
    async listDestinations() {
      if (!config.enabled || !config.canCallProvider || !account.accountVerified || !account.accountEvidence?.trim()) {
        throw new Error("Bosta checkout account is unverified");
      }
      return addresses.listDestinations();
    },
    async quote(input: BostaQuoteInput) {
      if (!config.enabled || !config.canCallProvider || !config.baseUrl) {
        throw new Error("Bosta integration is inactive; quote refused");
      }
      const request = requestSchema.parse(input);
      if (account.accountVerified !== true || !account.accountEvidence?.trim() || !["major", "minor"].includes(account.codUnit)) {
        throw new Error("Bosta account/pickup/COD-unit contract is unverified (O06)");
      }
      validatePricingResponseContract(account.responseContract);
      const size = estimateShipmentSize(request.productsTotalCents);
      // Verify the requested size before any provider or saved-rate operation.
      buildShipmentCalculatorQuery({ pickupCity: account.pickupCity, dropOffCity: "pending", cod: 0, size }, account.sizeMapping);
      const pricingContractId = bostaPricingContractId(account);
      const context = validateShippingRateContext({
        accountId: account.accountId, environment: config.baseUrl, pricingContractId,
        pickupCity: account.pickupCity, dropOffCity: "pending", destinationId: request.districtId,
        size, providerSize: account.sizeMapping[size]!, serviceType: "delivery",
        paymentMethod: request.paymentMethod, codAmountCents: request.codAmountCents
      });

      const district = await addresses.findDistrict(request.districtId);
      if (!district?.dropOffAvailable || district.cityId !== request.cityId) {
        throw new ShippingUnsupportedDestinationError(request.districtId);
      }
      if (typeof district.cityName !== "string" || !district.cityName.trim()) {
        throw new BostaResponseValidationError("Bosta districts response is missing the pricing city name");
      }
      context.dropOffCity = district.cityName;

      return resolveShippingQuote({ districtId: request.districtId,
        productsTotalCents: request.productsTotalCents, rateContext: context }, {
        isDestinationSupported: async () => true, // validated against this provider response above
        fetchLiveRate: async rateContext => {
          const cents = rateContext.codAmountCents;
          const cod = account.codUnit === "minor" ? String(cents)
            : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
          const rate = await pricing.fetchRate({ pickupCity: rateContext.pickupCity,
            dropOffCity: rateContext.dropOffCity, cod, size: rateContext.size });
          return { ...rate, rateIdentity: buildRateIdentity(rateContext) };
        },
        loadSavedRate: loadSavedShippingRate,
        saveRate: saveShippingRate
      });
    }
  };
}
