import { z } from "zod";
import { BostaClient, BostaProviderError } from "./bosta-client.js";
import { loadBostaConfig } from "./bosta-config.js";
import { resolveBostaSyncRuntime, type BostaObservation, type BostaSyncRuntime } from "./bosta-sync.service.js";

const path = z.array(z.string().min(1)).min(1);
const settingsSchema = z.object({ accountVerified: z.literal(true), accountEvidence: z.string().trim().min(1), accountId: z.string().trim().min(1),
  readContract: z.object({ verified: z.literal(true), evidence: z.string().trim().min(1), printedPath: path,
    prePickupPath: path, warehouseCustodyPath: path, canCancelPath: path, cancelledPath: path }).strict() }).strict();
export type CancellationObservation = { observation: BostaObservation; printed: boolean; prePickup: boolean;
  warehouseCustody: boolean; canCancel: boolean; cancelled: boolean };
export type BostaCancellationRuntime = { sync: BostaSyncRuntime;
  read(trackingNumber: string, reference: string): Promise<CancellationObservation>;
  cancel(trackingNumber: string): Promise<void> };
function atPath(value: unknown, parts: string[]) {
  for (const part of parts) value = value !== null && typeof value === "object" && Object.hasOwn(value, part)
    ? (value as Record<string, unknown>)[part] : undefined;
  if (typeof value !== "boolean") throw new Error("Verified boolean cancellation/printing/custody evidence is required");
  return value;
}

export function resolveBostaCancellationRuntime(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): BostaCancellationRuntime | null {
  const gate = env.BOSTA_CANCELLATION_ENABLED?.trim().toLowerCase();
  if (gate !== undefined && gate !== "" && gate !== "true" && gate !== "false") throw new Error("BOSTA_CANCELLATION_ENABLED must be true or false");
  if (gate !== "true") return null;
  const config = loadBostaConfig(env);
  if (!config.canCallProvider) return null;
  const settings = settingsSchema.parse(JSON.parse(env.BOSTA_CANCELLATION_SETTINGS_JSON ?? "null"));
  const sync = resolveBostaSyncRuntime(env, fetchImpl);
  if (!sync?.canRead || sync.accountId !== settings.accountId) throw new Error("Verified matching synchronization account is required for cancellation");
  const client = new BostaClient(config, fetchImpl);
  return {
    sync,
    async read(trackingNumber, reference) {
      const observation = await sync.read(trackingNumber, reference);
      const data = (observation.raw as { data?: unknown })?.data;
      const contract = settings.readContract;
      return { observation, printed: atPath(data, contract.printedPath), prePickup: atPath(data, contract.prePickupPath),
        warehouseCustody: atPath(data, contract.warehouseCustodyPath), canCancel: atPath(data, contract.canCancelPath), cancelled: atPath(data, contract.cancelledPath) };
    },
    async cancel(trackingNumber) {
      const acknowledgment = await client.delete(`/deliveries/business/${encodeURIComponent(trackingNumber)}/terminate`);
      if (!z.object({ success: z.literal(true) }).safeParse(acknowledgment).success) {
        throw new BostaProviderError("Bosta cancellation outcome is uncertain; verified read required", "ambiguous", null);
      }
    }
  };
}
