/**
 * Shared, validated normalizer for Bosta delivery business reads.
 *
 * Bosta returns `type` either as a bare integer or as `{ code, value }`, and
 * returns `dropOffAddress` either with flat ids or with nested `city`/`zone`
 * objects plus a district *name*. Correlation must not depend on which form a
 * given response happened to use, but it also must never guess: an identifier
 * is only believed when the provider sent it, and a district NAME only resolves
 * through a unique match in authoritative zoning data. Anything ambiguous,
 * missing or self-contradictory stays unresolved so callers fail closed.
 */

export type NormalizedDeliveryType = { code: number; label: string };

/** Provider display text is never trusted as identity; only its code is. */
const TYPE_LABELS: Record<number, string> = {
  10: "SEND", 15: "CASH_COLLECTION", 25: "CUSTOMER_RETURN_PICKUP", 30: "EXCHANGE"
};

export function normalizeDeliveryType(value: unknown): NormalizedDeliveryType {
  const code = typeof value === "number" && Number.isInteger(value) ? value
    : value !== null && typeof value === "object" && Number.isInteger((value as { code?: unknown }).code)
      ? (value as { code: number }).code
      : null;
  if (code === null || code < 0 || !Number.isSafeInteger(code)) throw new Error("Bosta delivery type is invalid");
  return { code, label: TYPE_LABELS[code] ?? `UNKNOWN_${code}` };
}

/** Tracking arrives as a string or a number; both are the same identifier. */
export function normalizeTrackingIdentifier(value: unknown): string {
  const text = typeof value === "number" && Number.isInteger(value) ? String(value)
    : typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 64 || (typeof value === "number" && value <= 0) || /^-/.test(text)) {
    throw new Error("Bosta tracking identifier is invalid");
  }
  return text;
}

export function normalizePhone(value: unknown): string {
  if (typeof value !== "string") throw new Error("Bosta recipient phone is invalid");
  const text = value.trim();
  return text.startsWith("+20") ? text : text.startsWith("0020") ? `+20${text.slice(4)}` : `+20${text.replace(/^0/, "")}`;
}

export type NormalizedReadAddress = {
  cityId: string | null;
  zoneId: string | null;
  districtId: string | null;
  firstLine: string;
};

export type ZoningRow = { cityId: string; zoneId: string | null; districtId: string; districtName: string };
export type ResolveByName = (query: { cityId: string | null; zoneId: string | null; districtName: string | null }) => ZoningRow[] | Promise<ZoningRow[]>;

/**
 * Reads a flat id field, which the provider documents as a bare string. An object here is
 * not the documented shape, so it is never mined for an identifier.
 */
function idOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Reads a nested `city`/`zone` reference. A bare string there is a display NAME, not an id.
 *
 * Only the documented `_id` is believed; a bare `id` alias is captured separately so a
 * response carrying two disagreeing identities is reported as a contradiction instead of
 * being resolved by preferring whichever field happened to be read first.
 */
function nestedReference(value: unknown): { documentedId: string | null; aliasId: string | null } {
  if (value === null || typeof value !== "object") return { documentedId: null, aliasId: null };
  const record = value as Record<string, unknown>;
  const documented = record._id;
  const alias = record.id;
  return {
    documentedId: typeof documented === "string" && documented.trim() ? documented.trim() : null,
    aliasId: typeof alias === "string" && alias.trim() ? alias.trim() : null
  };
}

function nameOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value !== null && typeof value === "object") {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

/**
 * Combines a flat id with the documented nested `_id`.
 *
 * A non-documented nested `id` alias contributes ONLY to contradiction detection: a response
 * carrying `_id: A` and `id: B` is an unresolved read, but a response carrying only the alias
 * proves nothing and stays unresolved rather than being believed as identity.
 */
function reconcileIdentity(label: string, flat: string | null, reference: { documentedId: string | null; aliasId: string | null }): string | null {
  if (reference.aliasId !== null && reference.documentedId !== null && reference.aliasId !== reference.documentedId) {
    throw new Error(`Bosta address ${label} identifiers contradict each other`);
  }
  const present = [flat, reference.documentedId].filter((value): value is string => value !== null);
  if (new Set(present).size > 1) throw new Error(`Bosta address ${label} identifiers contradict each other`);
  return present[0] ?? null;
}

/**
 * Preserves flat ids when present and extracts the documented nested `_id` when present. A
 * district display name is not an id: it resolves only through a unique authoritative match
 * under the proven city/zone.
 */
export async function normalizeReadAddress(value: unknown, resolveByName: ResolveByName): Promise<NormalizedReadAddress> {
  const record = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const firstLine = typeof record.firstLine === "string" ? record.firstLine.trim() : "";

  const zoneId = reconcileIdentity("zone", idOf(record.zoneId), nestedReference(record.zone));
  const cityId = reconcileIdentity("city", idOf(record.cityId), nestedReference(record.city));
  const districtId = idOf(record.districtId);
  const districtName = nameOf(record.districtName) ?? nameOf(record.district);

  let resolvedDistrictId = districtId;
  if (!resolvedDistrictId && districtName) {
    const matches = await resolveByName({ cityId, zoneId, districtName });
    // Ambiguity or no authoritative match stays unresolved. A single match is only
    // believed when it does not contradict the identity the provider already gave us.
    if (matches.length === 1
      && (!cityId || matches[0].cityId === cityId)
      && (!zoneId || matches[0].zoneId === zoneId)) resolvedDistrictId = matches[0].districtId;
  }
  return { cityId, zoneId, districtId: resolvedDistrictId, firstLine };
}

export type RequestedAddress = { cityId?: string | null; zoneId?: string | null; districtId: string | null; firstLine: string };

/**
 * Correlation needs provable identity *and* the complete requested line. A read
 * that could not prove its destination can never match a requested one.
 */
export function assertAddressMatches(actual: NormalizedReadAddress, requested: RequestedAddress): void {
  const zoneMatches = !requested.zoneId || actual.zoneId === requested.zoneId;
  const cityMatches = !requested.cityId || actual.cityId === requested.cityId;
  if (!actual.districtId || actual.districtId !== requested.districtId) throw new Error("Bosta address correlation failed: destination is unproven or different");
  if (!zoneMatches || !cityMatches) throw new Error("Bosta address correlation failed: destination zone or city differs");
  if (actual.firstLine !== requested.firstLine) throw new Error("Bosta address correlation failed: address line differs");
}

export type NormalizedDeliveryRead = {
  trackingNumber: string;
  businessReference: string;
  type: NormalizedDeliveryType;
  stateCode: number;
  stateName: string;
  collectedAmountCents: number | null;
  requestedCodAmountCents: number | null;
  recipientPhone: string | null;
  size: string | null;
  address: NormalizedReadAddress;
};

export type DeliveryReadContext = {
  resolveByName: ResolveByName;
  /** Provider paths are configuration, not assumptions. */
  collectionPath?: string[];
  confirmationPath?: string[];
};

const at = (value: unknown, path: string[]): unknown => {
  for (const key of path) value = value !== null && typeof value === "object" && Object.hasOwn(value, key)
    ? (value as Record<string, unknown>)[key] : undefined;
  return value;
};

/** Money arrives as a major-unit number or a numeric string; both are cents here. */
export function normalizeAmountCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim())) return Math.round(Number(value.trim()) * 100);
  return null;
}

/**
 * Validates a business read and correlates it against the request it claims to
 * satisfy. Throws on any missing, ambiguous or contradictory field. A throw is
 * an unresolved outcome, never proof that no delivery exists.
 */
export async function normalizeDeliveryRead(raw: unknown, context: DeliveryReadContext): Promise<NormalizedDeliveryRead> {
  const failure = () => new Error("Bosta delivery read is invalid or failed correlation");
  const data = at(raw, ["data"]);
  if (at(raw, ["success"]) !== true || data === null || typeof data !== "object") throw failure();
  const record = data as Record<string, unknown>;

  const trackingNumber = normalizeTrackingIdentifier(record.trackingNumber);
  const businessReference = typeof record.businessReference === "string" ? record.businessReference : null;
  if (!businessReference) throw failure();

  const state = record.state;
  if (state === null || typeof state !== "object" || !Number.isInteger((state as { code?: unknown }).code)) throw failure();
  const stateCode = (state as { code: number }).code;
  const stateName = typeof (state as { value?: unknown }).value === "string" ? (state as { value: string }).value : "";

  let type: NormalizedDeliveryType;
  try { type = normalizeDeliveryType(record.type); } catch { throw failure(); }

  const size = at(record, ["specs", "size"]);
  const recipientRaw = record.receiver;
  let recipientPhone: string | null = null;
  if (recipientRaw !== null && typeof recipientRaw === "object") {
    const phone = (recipientRaw as { phone?: unknown }).phone;
    if (phone !== undefined && phone !== null) {
      try { recipientPhone = normalizePhone(phone); } catch { throw failure(); }
    }
  }
  const address = await normalizeReadAddress(record.dropOffAddress, context.resolveByName).catch((error: unknown) => {
    // A self-contradictory address is reported as an unresolved read.
    if (error instanceof Error && /contradict/i.test(error.message)) throw failure();
    return { cityId: null, zoneId: null, districtId: null, firstLine: "" } as NormalizedReadAddress;
  });

  return {
    trackingNumber, businessReference, type, stateCode, stateName,
    collectedAmountCents: normalizeAmountCents(at(record, context.collectionPath ?? ["collection", "amount"])),
    requestedCodAmountCents: normalizeAmountCents(record.cod),
    recipientPhone, size: typeof size === "string" && size.trim() ? size.trim() : null,
    address
  };
}

export type DeliveryCorrelationExpectation = {
  trackingNumber?: string | null;
  businessReference?: string | null;
  typeCode?: number | null;
  requestedCodCents?: number | null;
  size?: string | null;
  recipientPhone?: string | null;
  address?: RequestedAddress;
};

/** Strict comparison shared by recovery, synchronization and edit confirmation. */
export function assertDeliveryMatches(actual: NormalizedDeliveryRead, expected: DeliveryCorrelationExpectation): void {
  const failure = (reason: string) => new Error(`Bosta delivery correlation failed: ${reason}`);
  if (expected.trackingNumber && actual.trackingNumber !== expected.trackingNumber) throw failure("tracking number differs");
  if (expected.businessReference && actual.businessReference !== expected.businessReference) throw failure("business reference differs");
  if (expected.typeCode !== undefined && expected.typeCode !== null && actual.type.code !== expected.typeCode) throw failure("delivery type differs");
  if (expected.size !== undefined && expected.size !== null && actual.size !== expected.size) throw failure("package size differs");
  if (expected.recipientPhone && (!actual.recipientPhone || actual.recipientPhone !== expected.recipientPhone)) throw failure("recipient phone differs");
  if (expected.requestedCodCents !== undefined && expected.requestedCodCents !== null
    && actual.requestedCodAmountCents !== expected.requestedCodCents) throw failure("requested money differs");
  if (expected.address) assertAddressMatches(actual.address, expected.address);
}