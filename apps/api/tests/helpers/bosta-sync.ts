import { deliveryEnvironment } from "./bosta-delivery.js";

export const syncSettings = {
  accountVerified: true, accountEvidence: "controlled fixture only", accountId: "fixture",
  webhookContract: { verified: true, evidence: "controlled fixture only", collectionUnit: "major", timestampUnit: "milliseconds" },
  readContract: { verified: true, evidence: "controlled fixture only", collectionUnit: "major", requestedCodUnit: "major",
    eventTimePath: ["updatedAt"], eventTimeFormat: "iso", collectionPath: ["collection", "amount"],
    confirmationPath: ["collection", "confirmed"] }
};
export const syncEnvironment = { ...deliveryEnvironment, BOSTA_SYNC_ENABLED: "true",
  BOSTA_SYNC_SETTINGS_JSON: JSON.stringify(syncSettings) };
export function webhookFixture(changes: Record<string, unknown> = {}) {
  return { _id: "provider-delivery", trackingNumber: "5108002", businessReference: "reference", type: "SEND",
    state: 45, cod: 132.29, isConfirmedDelivery: true, timeStamp: Date.now() - 60_000, ...changes };
}
export function readFixture(reference = "reference", changes: Record<string, unknown> = {}) {
  return { success: true, data: { _id: "provider-delivery", trackingNumber: "5108002", businessReference: reference,
    type: { code: 10, value: "Send" }, state: { code: 45, value: "Delivered" }, updatedAt: new Date(Date.now() - 30_000).toISOString(),
    cod: 150, collection: { amount: 132.29, confirmed: true }, receiver: { fullName: "Carrier buyer", phone: "01012345678" },
    dropOffAddress: { firstLine: "Carrier address", districtId: "carrier-district" }, notes: "Carrier notes",
    specs: { size: "MEDIUM", packageType: "Parcel", packageDetails: { itemsCount: 1, description: "Serum" } }, ...changes } };
}
