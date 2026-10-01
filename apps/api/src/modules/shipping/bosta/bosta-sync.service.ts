import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { BostaClient } from "./bosta-client.js";
import { loadBostaConfig } from "./bosta-config.js";
import { normalizeDeliveryType, normalizeReadAddress, type NormalizedReadAddress } from "./bosta-delivery-read.js";
import { BostaAddressService } from "./bosta-address.service.js";

const evidence = { verified: z.literal(true), evidence: z.string().trim().min(1) };
const unit = z.enum(["major", "minor"]);
const path = z.array(z.string().min(1)).min(1);
const settingsSchema = z.object({
  accountVerified: z.literal(true), accountEvidence: z.string().trim().min(1), accountId: z.string().trim().min(1).max(128),
  webhookContract: z.object({ ...evidence, collectionUnit: unit, timestampUnit: z.enum(["milliseconds", "seconds"]) }),
  readContract: z.object({ ...evidence, collectionUnit: unit, requestedCodUnit: unit,
    eventTimePath: path, eventTimeFormat: z.enum(["iso", "milliseconds", "seconds"]), collectionPath: path, confirmationPath: path })
});
const identifier = z.union([z.string().trim().min(1).max(64), z.number().int().positive().safe().transform(String)]);
const stateCode = z.number().int().nonnegative().max(2_147_483_647);
const typeName = z.enum(["SEND", "EXCHANGE", "CUSTOMER_RETURN_PICKUP", "RTO", "SIGN_AND_RETURN", "FXF_SEND"]);
const names: Record<number, string> = { 10: "Pickup requested", 20: "Route assigned", 21: "Picked up from business",
  22: "Picking up from consignee", 23: "Picked up from consignee", 24: "Received at warehouse", 25: "Fulfilled",
  30: "In transit between hubs", 40: "Picking up", 41: "Picked up", 45: "Delivered", 46: "Returned to business",
  47: "Exception", 48: "Terminated", 49: "Canceled", 60: "Returned to stock", 100: "Lost", 101: "Damaged",
  102: "Investigation", 103: "Awaiting your action", 104: "Archived", 105: "On hold" };

export type BostaObservation = {
  source: "webhook" | "read"; trackingNumber: string; businessReference: string | null; type: string;
  stateCode: number; stateName: string; atMs: number; collectedAmountCents: number | null;
  confirmedDelivery: boolean | null; exceptionCode: number | null;
  carrier: { recipient?: unknown; address?: unknown; addressIdentity?: NormalizedReadAddress; notes?: string;
    size?: string; requestedCodAmountCents?: number };
  raw: unknown;
};
export type BostaSyncRuntime = {
  accountId: string; environment: string; accountKey: string; canRead: boolean;
  authenticate(secret: string): boolean;
  parseWebhook(payload: unknown, now?: number): BostaObservation;
  read(trackingNumber: string, businessReference: string): Promise<BostaObservation>;
};
export const bostaAccountKey = (accountId: string, environment: string) =>
  createHash("sha256").update(JSON.stringify([accountId, environment])).digest("hex");
function atPath(value: unknown, parts: string[]): unknown {
  for (const part of parts) value = value !== null && typeof value === "object" && Object.hasOwn(value, part)
    ? (value as Record<string, unknown>)[part] : undefined;
  return value;
}
function money(value: unknown, units: "major" | "minor"): number {
  const text = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!(units === "major" ? /^\d+(\.\d{1,2})?$/ : /^\d+$/).test(text) || text.length > 20) throw new Error("Invalid carrier collection amount");
  const [whole, fraction = ""] = text.split(".");
  const cents = units === "major" ? BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")) : BigInt(whole);
  if (cents > 2_147_483_647n) throw new Error("Carrier collection amount exceeds supported storage");
  return Number(cents);
}
function eventTime(value: unknown, format: "iso" | "milliseconds" | "seconds", now = Date.now()): number {
  let ms: number;
  if (format === "iso") ms = Date.parse(z.string().datetime({ offset: true }).parse(value));
  else ms = z.number().int().positive().safe().parse(value) * (format === "seconds" ? 1000 : 1);
  if (!Number.isSafeInteger(ms) || ms <= 0 || ms > now + 300_000) throw new Error("Invalid carrier event timestamp");
  return ms;
}
export function normalizeBostaState(code: number, type: string): "created" | "picked_up" | "in_transit" | "delivered" | "returned" | "cancelled" | "exception" {
  if ([10, 11, 20, 22, 40].includes(code)) return "created";
  if ([21, 23].includes(code)) return "picked_up";
  if ([24, 30, 41].includes(code)) return "in_transit";
  if (code === 45 && ["SEND", "FXF_SEND", "SIGN_AND_RETURN"].includes(type)) return "delivered";
  if (code === 46 && ["RTO", "EXCHANGE", "CUSTOMER_RETURN_PICKUP"].includes(type)) return "returned";
  if (code === 49) return "cancelled";
  return "exception";
}
export function resolveBostaSyncRuntime(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): BostaSyncRuntime | null {
  const enabled = env.BOSTA_SYNC_ENABLED?.trim().toLowerCase();
  if (enabled !== undefined && enabled !== "" && enabled !== "true" && enabled !== "false") throw new Error("BOSTA_SYNC_ENABLED must be true or false");
  if (enabled !== "true") return null;
  const settings = settingsSchema.parse(JSON.parse(env.BOSTA_SYNC_SETTINGS_JSON ?? "null"));
  const secret = env.BOSTA_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("Bosta synchronization requires a webhook secret");
  const url = new URL(env.BOSTA_BASE_URL ?? "");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Invalid Bosta synchronization base URL");
  const environment = url.toString().replace(/\/+$/, "");
  const config = loadBostaConfig(env);
  const client = new BostaClient(config, fetchImpl);
  const sanitize = (value: unknown): unknown => {
    const redact = (text: string) => {
      for (const sensitive of [env.BOSTA_API_KEY, secret]) if (sensitive) text = text.split(sensitive).join("[redacted]");
      return text;
    };
    if (typeof value === "string") return redact(value);
    if (Array.isArray(value)) return value.map(sanitize);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [redact(key), sanitize(entry)]));
    return value;
  };
  // Authoritative zoning data, so a documented district NAME can be resolved to its id.
  const addresses = new BostaAddressService(() => client.get("/cities/getAllDistricts?countryId=60e4482c7cb7d4bc4849c4d5"));
  const resolveDistrictByName = async (query: { cityId: string | null; zoneId: string | null; districtName: string | null }) =>
    query.districtName
      ? await addresses.resolveDistrictsByName({ cityId: query.cityId, zoneId: query.zoneId, districtName: query.districtName })
      : [];
  return {
    accountId: settings.accountId, environment, accountKey: bostaAccountKey(settings.accountId, environment), canRead: config.canCallProvider,
    authenticate(received) {
      const hash = (value: string) => createHash("sha256").update(value).digest();
      return timingSafeEqual(hash(received), hash(secret));
    },
    parseWebhook(payload, now) {
      const body = z.object({ trackingNumber: identifier, businessReference: z.string().trim().min(1).max(64).optional(),
        state: stateCode, type: typeName, timeStamp: z.number(), isConfirmedDelivery: z.boolean().optional(),
        cod: z.union([z.number(), z.string()]).optional(), exceptionCode: z.number().int().nonnegative().optional() }).parse(payload);
      return { source: "webhook", trackingNumber: body.trackingNumber, businessReference: body.businessReference ?? null,
        type: body.type, stateCode: body.state, stateName: names[body.state] ?? `Unknown state ${body.state}`,
        atMs: eventTime(body.timeStamp, settings.webhookContract.timestampUnit, now),
        collectedAmountCents: body.state === 45 && body.cod !== undefined ? money(body.cod, settings.webhookContract.collectionUnit) : null,
        confirmedDelivery: body.isConfirmedDelivery ?? null, exceptionCode: body.exceptionCode ?? null, carrier: {}, raw: sanitize(payload) };
    },
    async read(trackingNumber, businessReference) {
      if (!config.canCallProvider) throw new Error("Bosta provider reads are disabled");
      const raw = await client.get(`/deliveries/business/${encodeURIComponent(trackingNumber)}`);
      const parsed = z.object({ success: z.literal(true), data: z.object({ trackingNumber: identifier,
        businessReference: z.string(), state: z.object({ code: stateCode, value: z.string().min(1).max(64) }),
        type: z.union([z.number().int(), z.object({ code: z.number().int(), value: z.string().optional() })]),
        receiver: z.record(z.unknown()).optional(), dropOffAddress: z.record(z.unknown()).optional(), notes: z.string().optional(),
        specs: z.object({ size: z.string().min(1).max(64).optional() }).optional(), cod: z.union([z.number(), z.string()]).optional(),
        exceptionCode: z.number().int().nonnegative().optional() }).passthrough() }).parse(raw).data;
      if (parsed.trackingNumber !== trackingNumber || parsed.businessReference !== businessReference) throw new Error("Delivery correlation failed");
      const type = normalizeDeliveryType(parsed.type).label;
      const collected = atPath(parsed, settings.readContract.collectionPath);
      const confirmation = atPath(parsed, settings.readContract.confirmationPath);
      if (confirmation !== undefined && confirmation !== null && typeof confirmation !== "boolean") throw new Error("Invalid carrier delivery confirmation");
      // The sanitized blob stays as raw evidence; identity is normalized separately so
      // edit confirmation compares proven ids instead of assuming flat provider fields.
      let addressIdentity: NormalizedReadAddress | undefined;
      try { addressIdentity = await normalizeReadAddress(parsed.dropOffAddress, resolveDistrictByName); }
      catch { addressIdentity = { cityId: null, zoneId: null, districtId: null, firstLine: "" }; }
      return { source: "read", trackingNumber, businessReference, type, stateCode: parsed.state.code, stateName: sanitize(parsed.state.value) as string,
        atMs: eventTime(atPath(parsed, settings.readContract.eventTimePath), settings.readContract.eventTimeFormat),
        collectedAmountCents: collected === undefined || collected === null ? null : money(collected, settings.readContract.collectionUnit),
        confirmedDelivery: typeof confirmation === "boolean" ? confirmation : null, exceptionCode: parsed.exceptionCode ?? null,
        carrier: { ...(parsed.receiver ? { recipient: sanitize(parsed.receiver) } : {}),
          ...(addressIdentity ? { address: sanitize(parsed.dropOffAddress), addressIdentity } : {}),
          ...(parsed.notes !== undefined ? { notes: sanitize(parsed.notes) as string } : {}),
          ...(parsed.specs?.size ? { size: sanitize(parsed.specs.size) as string } : {}),
          ...(parsed.cod !== undefined ? { requestedCodAmountCents: money(parsed.cod, settings.readContract.requestedCodUnit) } : {}) }, raw: sanitize(raw) };
    }
  };
}
