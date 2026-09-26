import { z } from "zod";
import { checkoutShippingQuoteSchema } from "@capella/shared";
import type { orders, orderItems } from "@capella/database/drizzle/schema";
import { BostaClient, BostaProviderError } from "./bosta-client.js";
import { loadBostaConfig } from "./bosta-config.js";
import { bostaPricingContractId, type BostaQuoteSettings } from "./bosta-quote-composition.js";
import { buildRateIdentity } from "./bosta-rate-context.js";
import { validatePricingResponseContract } from "./bosta-pricing.service.js";

const settingsSchema = z.object({
  accountVerified: z.literal(true), accountEvidence: z.string().trim().min(1), accountId: z.string().trim().min(1),
  pickupDefaultsVerified: z.literal(true), defaultPickupCity: z.string().trim().min(1),
  noInsuranceVerified: z.literal(true), codUnit: z.literal("major"),
  sizeMapping: z.object({ small: z.literal("SMALL"), medium: z.literal("MEDIUM"), large: z.literal("LARGE") }),
  lookupContract: z.object({ verified: z.literal(true), evidence: z.string().trim().min(1),
    resultsPath: z.array(z.string().min(1)).min(1), totalPath: z.array(z.string().min(1)).min(1) })
});

export type DeliveryRequest = {
  accountId: string; environment: string;
  payload: {
    type: 10; cod: number; businessReference: string; allowToOpenPackage: false; notes: string;
    specs: { size: "SMALL" | "MEDIUM" | "LARGE"; packageType: "Parcel"; packageDetails: { itemsCount: number; description: string } };
    receiver: { firstName: string; lastName: string; fullName: string; phone: string; email: string };
    dropOffAddress: { city: string; zoneId: string; districtId: string; firstLine: string };
  };
};
export type DeliveryResult = { trackingNumber: string; rawProviderState: string; rawProviderCode: number; rawResponse: unknown };
export type DeliveryProvider = {
  accountId: string; environment: string; canCreate: boolean;
  buildRequest(order: typeof orders.$inferSelect, items: Array<typeof orderItems.$inferSelect>, reference: string): DeliveryRequest;
  create(request: DeliveryRequest): Promise<DeliveryResult>;
  reconcile(request: DeliveryRequest): Promise<DeliveryResult | null>;
};

function phone(value: string) {
  return value.startsWith("+20") ? value : value.startsWith("0020") ? `+20${value.slice(4)}` : `+20${value.replace(/^0/, "")}`;
}
function atPath(value: unknown, path: string[]): unknown {
  for (const key of path) value = value != null && typeof value === "object" && Object.hasOwn(value, key)
    ? (value as Record<string, unknown>)[key] : undefined;
  return value;
}

export function bostaDeliveryProviderFromEnvironment(env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch, options: { recoveryOnly?: boolean } = {}): DeliveryProvider | null {
  const canCreate = env.BOSTA_SHIPMENT_SENDING_ENABLED?.trim().toLowerCase() === "true";
  if (!canCreate && (!options.recoveryOnly || !env.BOSTA_DELIVERY_SETTINGS_JSON)) return null;
  const config = loadBostaConfig(env);
  if (!config.enabled) return null;
  const settings = settingsSchema.parse(JSON.parse(env.BOSTA_DELIVERY_SETTINGS_JSON ?? "null"));
  const client = new BostaClient(config, fetchImpl);
  const environment = config.baseUrl!;
  const redact = (value: string) => {
    for (const secret of [config.apiKey, config.webhookSecret]) if (secret) value = value.split(secret).join("[redacted]");
    return value;
  };
  const sanitize = (value: unknown): unknown => {
    if (typeof value === "string") return redact(value);
    if (Array.isArray(value)) return value.map(sanitize);
    if (value !== null && typeof value === "object") return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [redact(key), sanitize(entry)]));
    return value;
  };
  const resultSchema = z.object({ success: z.literal(true), data: z.object({
    trackingNumber: z.string().trim().min(1).max(64), state: z.object({ code: z.number().int(), value: z.string().min(1).max(64) })
  }) });
  const parseResult = (raw: unknown): DeliveryResult => {
    const parsed = resultSchema.safeParse(raw);
    if (!parsed.success) throw new BostaProviderError("Bosta create outcome is uncertain; tracking/state response is invalid", "ambiguous", null);
    return { trackingNumber: parsed.data.data.trackingNumber, rawProviderState: parsed.data.data.state.value,
      rawProviderCode: parsed.data.data.state.code, rawResponse: sanitize(raw) };
  };
  const checkAccount = (request: DeliveryRequest) => {
    if (request.accountId !== settings.accountId || request.environment !== environment) throw new Error("Delivery account/environment changed");
  };
  return {
    accountId: settings.accountId, environment, canCreate,
    buildRequest(order, items, reference) {
      const quote = checkoutShippingQuoteSchema.parse(JSON.parse(order.shippingSnapshot ?? "null"));
      const quoteAccount = JSON.parse(env.BOSTA_QUOTE_SETTINGS_JSON ?? "null") as BostaQuoteSettings | null;
      if (!quoteAccount || quoteAccount.accountVerified !== true || !quoteAccount.accountEvidence?.trim() ||
        quoteAccount.accountId !== settings.accountId || !["major", "minor"].includes(quoteAccount.codUnit)) {
        throw new Error("Delivery quote account contract is unverified or changed");
      }
      validatePricingResponseContract(quoteAccount.responseContract);
      if (quoteAccount.pickupCity !== settings.defaultPickupCity) throw new Error("Default pickup city differs from the locked quote");
      const expectedRate = buildRateIdentity({ accountId: settings.accountId, environment,
        pricingContractId: bostaPricingContractId(quoteAccount), pickupCity: quoteAccount.pickupCity,
        dropOffCity: quote.address.cityName.en, destinationId: quote.address.districtId, size: quote.size,
        providerSize: quoteAccount.sizeMapping[quote.size]!, serviceType: "delivery",
        paymentMethod: quote.paymentMethod === "cod" ? "cod" : "prepaid", codAmountCents: quote.codAmountCents });
      if (quote.rateIdentity !== expectedRate) throw new Error("Delivery rate account/environment/contract changed");
      const totalCents = Math.round(Number(order.totalAmount) * 100);
      if (quote.amountCents !== totalCents || quote.shippingAmountCents !== order.shippingAmountCents ||
        quote.size !== order.shippingSize || quote.quoteId !== order.shippingQuoteId || items.length === 0 ||
        (quote.paymentMethod !== order.paymentMethod && totalCents !== 0) ||
        items.reduce((sum, item) => sum + Math.round(Number(item.lineTotal) * 100), 0) !== quote.productsTotalCents) {
        throw new Error("Locked delivery amount/size/items snapshot mismatch");
      }
      const codCents = order.paymentMethod === "cod" ? totalCents : 0;
      if (codCents > 3_000_000) throw new Error("Delivery COD exceeds Bosta's documented EGP 30,000 limit");
      const names = order.fullName.trim().split(/\s+/);
      const descriptions: string[] = [];
      let itemsCount = 0;
      for (const item of items) {
        if (!item.snapshotNameEn?.trim() || !Number.isSafeInteger(item.qty) || item.qty < 1) throw new Error("Delivery contents snapshot is invalid");
        descriptions.push(`${item.snapshotNameEn}${item.snapshotSizeLabel ? ` (${item.snapshotSizeLabel})` : ""} x${item.qty}`);
        const components = item.snapshotComponents ? z.array(z.object({ qty: z.number().int().positive() })).min(1)
          .parse(JSON.parse(item.snapshotComponents)) : null;
        itemsCount += item.qty * (components ? components.reduce((sum, component) => sum + component.qty, 0) : 1);
      }
      const firstLine = `${order.addressLine}, ${order.buildingApartment}`;
      if (firstLine.length <= 5 || !Number.isSafeInteger(itemsCount)) throw new Error("Delivery address/contents snapshot is invalid");
      return { accountId: settings.accountId, environment, payload: {
        type: 10, cod: codCents / 100, businessReference: reference, allowToOpenPackage: false, notes: order.notes ?? "",
        specs: { size: settings.sizeMapping[quote.size], packageType: "Parcel", packageDetails: { itemsCount, description: descriptions.join("; ") } },
        receiver: { firstName: names[0]!, lastName: names.slice(1).join(" ") || names[0]!, fullName: order.fullName,
          phone: phone(order.phone), email: order.email },
        dropOffAddress: { city: quote.address.cityName.en, zoneId: quote.address.zoneId, districtId: quote.address.districtId, firstLine }
      } };
    },
    async create(request) {
      if (!canCreate) throw new Error("New shipment sending is disabled");
      checkAccount(request);
      return parseResult(await client.post("/deliveries?apiVersion=1", request.payload));
    },
    async reconcile(request) {
      checkAccount(request);
      const search = await client.post("/deliveries/search", { businessReference: request.payload.businessReference });
      if ((search as { success?: unknown })?.success !== true) throw new Error("Delivery lookup response is invalid");
      const rows = atPath(search, settings.lookupContract.resultsPath);
      const total = atPath(search, settings.lookupContract.totalPath);
      if (!Array.isArray(rows) || !Number.isSafeInteger(total) || total !== rows.length) throw new Error("Delivery lookup must prove a complete unique result");
      if (rows.length === 0) return null;
      if (rows.length !== 1) throw new Error("Delivery lookup did not identify a unique match");
      const row = z.object({ businessReference: z.literal(request.payload.businessReference), trackingNumber: z.string().min(1).max(64) }).parse(rows[0]);
      const raw = await client.get(`/deliveries/business/${encodeURIComponent(row.trackingNumber)}`);
      const result = parseResult(raw);
      const detail = (raw as { data: Record<string, any> }).data;
      if (result.trackingNumber !== row.trackingNumber || detail.businessReference !== request.payload.businessReference ||
        detail.type !== 10 || detail.cod !== request.payload.cod || detail.specs?.size !== request.payload.specs.size ||
        typeof detail.receiver?.phone !== "string" || phone(detail.receiver.phone) !== request.payload.receiver.phone ||
        detail.dropOffAddress?.districtId !== request.payload.dropOffAddress.districtId ||
        detail.dropOffAddress?.firstLine !== request.payload.dropOffAddress.firstLine) throw new Error("Delivery correlation failed");
      return result;
    }
  };
}
