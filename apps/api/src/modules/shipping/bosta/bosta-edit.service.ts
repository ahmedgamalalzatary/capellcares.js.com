import { z } from "zod";
import { BostaClient, BostaProviderError } from "./bosta-client.js";
import { loadBostaConfig } from "./bosta-config.js";
import { resolveBostaSyncRuntime, type BostaObservation, type BostaSyncRuntime } from "./bosta-sync.service.js";

const path = z.array(z.string().min(1)).min(1);
const settingsSchema = z.object({ accountVerified: z.literal(true), accountEvidence: z.string().trim().min(1), accountId: z.string().trim().min(1),
  readContract: z.object({ verified: z.literal(true), evidence: z.string().trim().min(1), editablePath: path, prePickupPath: path }).strict() }).strict();
export type BostaEditRuntime = { sync: BostaSyncRuntime;
  read(trackingNumber: string, reference: string): Promise<{ observation: BostaObservation; editable: boolean; prePickup: boolean }>;
  update(trackingNumber: string, payload: Record<string, unknown>): Promise<unknown> };
function atPath(value: unknown, parts: string[]) {
  for (const part of parts) value = value !== null && typeof value === "object" && Object.hasOwn(value, part)
    ? (value as Record<string, unknown>)[part] : undefined;
  if (typeof value !== "boolean") throw new Error("Verified boolean edit availability evidence is required");
  return value;
}

/** O07: provider edit availability must be verified per merchant account before staff edits
 *  reach linked shipments; absent settings simply disable the capability. */
export function resolveBostaEditRuntime(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): BostaEditRuntime | null {
  const gate = env.BOSTA_EDITS_ENABLED?.trim().toLowerCase();
  if (gate !== undefined && gate !== "" && gate !== "true" && gate !== "false") throw new Error("BOSTA_EDITS_ENABLED must be true or false");
  if (gate !== "true") return null;
  const config = loadBostaConfig(env);
  if (!config.canCallProvider) return null;
  const settings = settingsSchema.parse(JSON.parse(env.BOSTA_EDIT_SETTINGS_JSON ?? "null"));
  const sync = resolveBostaSyncRuntime(env, fetchImpl);
  if (!sync?.canRead || sync.accountId !== settings.accountId) throw new Error("Verified matching synchronization account is required for edits");
  const client = new BostaClient(config, fetchImpl);
  return {
    sync,
    async read(trackingNumber, reference) {
      const observation = await sync.read(trackingNumber, reference);
      const data = (observation.raw as { data?: unknown })?.data;
      const contract = settings.readContract;
      return { observation, editable: atPath(data, contract.editablePath), prePickup: atPath(data, contract.prePickupPath) };
    },
    async update(trackingNumber, payload) {
      const acknowledgment = await client.put(`/deliveries/business/${encodeURIComponent(trackingNumber)}`, payload);
      if (!z.object({ success: z.literal(true) }).safeParse(acknowledgment).success) {
        throw new BostaProviderError("Bosta edit outcome is uncertain; verified read required", "ambiguous", null);
      }
      return acknowledgment;
    }
  };
}
