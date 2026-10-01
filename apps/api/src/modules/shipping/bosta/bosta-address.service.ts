/**
 * Bosta supported-address service backed by `GET /cities/getAllDistricts`.
 * A district is deliverable only when it exists and `dropOffAvailability` is
 * true (D10: governorate coverage does not imply district deliverability).
 */
import { BostaResponseValidationError } from "./bosta-client.js";
import { shippingDestinationSchema, type ShippingDestination } from "@capella/shared";

export type DistrictAvailability = {
  districtId: string;
  cityId: string;
  cityName?: string;
  dropOffAvailable: boolean;
};

export type DistrictNameCandidate = {
  cityId: string;
  zoneId: string | null;
  districtId: string;
  districtName: string;
};

type DistrictsPayload = {
  success?: boolean;
  data?: Array<{
    cityId?: string;
    cityName?: string;
    cityOtherName?: string;
    districts?: Array<{
      districtId?: string;
      zoneId?: string;
      zoneName?: string;
      zoneOtherName?: string;
      districtName?: string;
      districtOtherName?: string;
      dropOffAvailability?: boolean;
    }>;
  }>;
} | null;

type DistrictsSnapshot = {
  payload: NonNullable<DistrictsPayload>;
  districts: Map<string, DistrictAvailability>;
  expiresAt: number;
};

export function normalizeDistrictsResponse(payload: DistrictsPayload): Map<string, DistrictAvailability> {
  if (!payload || payload.success === false || !Array.isArray(payload.data)) {
    throw new BostaResponseValidationError("Bosta districts response is malformed");
  }
  const map = new Map<string, DistrictAvailability>();
  for (const city of payload.data) {
    if (!city || typeof city.cityId !== "string" || !city.cityId.trim() || !Array.isArray(city.districts)) {
      throw new BostaResponseValidationError("Bosta districts response is malformed");
    }
    for (const district of city.districts) {
      if (!district || typeof district.districtId !== "string" || !district.districtId.trim() || map.has(district.districtId)) {
        throw new BostaResponseValidationError("Bosta districts response is malformed");
      }
      map.set(district.districtId, {
        districtId: district.districtId,
        cityId: city.cityId,
        cityName: city.cityName,
        dropOffAvailable: district.dropOffAvailability === true
      });
    }
  }
  return map;
}

export class BostaAddressService {
  private snapshot: DistrictsSnapshot | null = null;
  private loading: Promise<DistrictsSnapshot> | null = null;

  constructor(private readonly fetchDistricts: () => Promise<unknown>) {}

  private async loadDistricts(): Promise<DistrictsSnapshot> {
    if (this.snapshot && Date.now() < this.snapshot.expiresAt) return this.snapshot;
    if (!this.loading) {
      this.loading = (async () => {
        const payload = await this.fetchDistricts() as DistrictsPayload;
        const districts = normalizeDistrictsResponse(payload);
        this.snapshot = { payload: payload!, districts, expiresAt: Date.now() + 30_000 };
        return this.snapshot;
      })().finally(() => { this.loading = null; });
    }
    return this.loading;
  }

  async listDestinations(): Promise<ShippingDestination[]> {
    const { payload } = await this.loadDistricts();
    const destinations: ShippingDestination[] = [];
    for (const city of payload!.data!) {
      for (const district of city.districts!) {
        if (district.dropOffAvailability !== true) continue;
        const parsed = shippingDestinationSchema.safeParse({
          cityId: city.cityId, zoneId: district.zoneId, districtId: district.districtId,
          cityName: { en: city.cityName, ar: city.cityOtherName || city.cityName },
          zoneName: { en: district.zoneName, ar: district.zoneOtherName || district.zoneName },
          districtName: { en: district.districtName, ar: district.districtOtherName || district.districtName }
        });
        if (!parsed.success) throw new BostaResponseValidationError("Bosta checkout address response is malformed");
        destinations.push(parsed.data);
      }
    }
    return destinations;
  }

  async isDeliverable(districtId: string): Promise<boolean> {
    return (await this.findDistrict(districtId))?.dropOffAvailable === true;
  }

  async findDistrict(districtId: string): Promise<DistrictAvailability | null> {
    const { districts } = await this.loadDistricts();
    const district = districts.get(districtId);
    return district ? { ...district } : null;
  }

  /**
   * Resolves a district NAME to candidate ids using the authoritative zoning data.
   * Returns every candidate, narrowed by city/zone when the provider proved them;
   * the caller must treat anything other than a single match as unresolved. A
   * name is never an identifier on its own.
   */
  async resolveDistrictsByName(query: { cityId: string | null; zoneId: string | null; districtName: string }): Promise<DistrictNameCandidate[]> {
    const { payload } = await this.loadDistricts();
    const matches: DistrictNameCandidate[] = [];
    for (const city of payload!.data!) {
      if (query.cityId && city.cityId !== query.cityId) continue;
      for (const district of city.districts!) {
        if (query.zoneId && district.zoneId !== query.zoneId) continue;
        if (district.districtName !== query.districtName) continue;
        if (!city.cityId) continue;
        matches.push({ cityId: city.cityId, zoneId: district.zoneId ?? null,
          districtId: district.districtId!, districtName: district.districtName! });
      }
    }
    return matches;
  }
}
