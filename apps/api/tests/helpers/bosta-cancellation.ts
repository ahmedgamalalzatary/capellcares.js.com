import { syncEnvironment } from "./bosta-sync.js";

export const cancellationSettings = { accountVerified: true, accountEvidence: "controlled fixture only", accountId: "fixture",
  readContract: { verified: true, evidence: "controlled fixture only", printedPath: ["cancelProof", "printed"],
    prePickupPath: ["cancelProof", "prePickup"], warehouseCustodyPath: ["cancelProof", "warehouse"],
    canCancelPath: ["cancelProof", "allowed"], cancelledPath: ["cancelProof", "cancelled"] } };
export const cancellationEnvironment = { ...syncEnvironment, BOSTA_CANCELLATION_ENABLED: "true", BOSTA_CANCELLATION_SETTINGS_JSON: JSON.stringify(cancellationSettings) };
