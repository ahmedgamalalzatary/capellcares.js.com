import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeDistrictsResponse,
  BostaAddressService
} from "../../src/modules/shipping/bosta/bosta-address.service.js";

// Controlled fixture mirroring GET /cities/getAllDistricts.
const DISTRICTS_PAYLOAD = {
  success: true,
  message: "Done successfully.",
  data: [
    {
      cityId: "city-cairo",
      cityName: "Cairo",
      cityOtherName: "القاهرة",
      cityCode: "EG-01",
      districts: [
        { zoneId: "z1", zoneName: "Nasr City", zoneOtherName: "مدينة نصر", districtId: "d-nasr", districtName: "Nasr City", districtOtherName: "مدينة نصر", pickupAvailability: true, dropOffAvailability: true },
        { zoneId: "z2", zoneName: "Heliopolis", zoneOtherName: "مصر الجديدة", districtId: "d-helio", districtName: "Heliopolis", districtOtherName: "مصر الجديدة", pickupAvailability: true, dropOffAvailability: false }
      ],
      pickupAvailability: true,
      dropOffAvailability: true
    },
    {
      cityId: "city-alex",
      cityName: "Alexandria",
      cityOtherName: "الإسكندرية",
      cityCode: "EG-02",
      districts: [
        { zoneId: "z3", zoneName: "Smouha", zoneOtherName: "سموحة", districtId: "d-smouha", districtName: "Smouha", districtOtherName: "سموحة", pickupAvailability: true, dropOffAvailability: true }
      ],
      pickupAvailability: true,
      dropOffAvailability: true
    }
  ]
};

test("normalizes the districts response into a flat deliverability map", () => {
  const map = normalizeDistrictsResponse(DISTRICTS_PAYLOAD);
  assert.equal(map.get("d-nasr")?.dropOffAvailable, true);
  assert.equal(map.get("d-helio")?.dropOffAvailable, false);
  assert.equal(map.get("d-smouha")?.dropOffAvailable, true);
});

test("a district is deliverable only when it exists and drop-off is available", async () => {
  const service = new BostaAddressService(async () => DISTRICTS_PAYLOAD);
  assert.equal(await service.isDeliverable("d-nasr"), true);
  assert.equal(await service.isDeliverable("d-helio"), false);
  assert.equal(await service.isDeliverable("unknown"), false);
});

test("checkout address options retain supported city, zone and district names in both languages", async () => {
  const service = new BostaAddressService(async () => DISTRICTS_PAYLOAD);
  const options = await (service as any).listDestinations();
  assert.equal(options.length, 2);
  assert.deepEqual(options[0], { cityId: "city-cairo", zoneId: "z1", districtId: "d-nasr",
    cityName: { en: "Cairo", ar: "القاهرة" }, zoneName: { en: "Nasr City", ar: "مدينة نصر" },
    districtName: { en: "Nasr City", ar: "مدينة نصر" } });
  assert.equal(options.some((row: any) => row.districtId === "d-helio"), false);
});

test("a malformed districts payload is rejected, not treated as empty", () => {
  assert.throws(() => normalizeDistrictsResponse({ success: false, data: null }), /district/i);
  assert.throws(() => normalizeDistrictsResponse(null), /district/i);
});

test("failed or contradictory address data cannot authorize a destination", () => {
  for (const payload of [
    { ...DISTRICTS_PAYLOAD, success: false },
    { data: [{ cityId: "", districts: [{ districtId: "d1", dropOffAvailability: true }] }] },
    { data: [{ cityId: "c1", districts: [{ districtId: "", dropOffAvailability: true }] }] },
    { data: [{ cityId: "c1", districts: [{ districtId: "d1" }, { districtId: "d1" }] }] }
  ]) {
    assert.throws(() => normalizeDistrictsResponse(payload), /district/i);
  }
});

test("address options and concurrent district lookups share one validated provider download", async () => {
  let downloads = 0;
  const service = new BostaAddressService(async () => {
    downloads++;
    return structuredClone(DISTRICTS_PAYLOAD);
  });
  const [options, available, unavailable, missing] = await Promise.all([
    service.listDestinations(), service.findDistrict("d-nasr"),
    service.isDeliverable("d-helio"), service.isDeliverable("unknown")
  ]);
  assert.equal(options.length, 2);
  assert.equal(available?.dropOffAvailable, true);
  assert.equal(unavailable, false);
  assert.equal(missing, false);
  assert.equal(await service.isDeliverable("d-smouha"), true);
  assert.equal(downloads, 1);
});

test("expired address data refreshes availability and cannot survive a provider failure", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  let payload = structuredClone(DISTRICTS_PAYLOAD);
  let outage = false;
  const service = new BostaAddressService(async () => {
    if (outage) throw new Error("address provider unavailable");
    return structuredClone(payload);
  });
  assert.equal(await service.isDeliverable("d-nasr"), true);
  payload.data[0].districts[0].dropOffAvailability = false;
  assert.equal(await service.isDeliverable("d-nasr"), true);
  t.mock.timers.tick(30_000);
  assert.equal(await service.isDeliverable("d-nasr"), false);
  outage = true;
  t.mock.timers.tick(30_000);
  await assert.rejects(service.findDistrict("d-nasr"), /unavailable/);
  outage = false;
  payload.data[0].districts[0].dropOffAvailability = true;
  assert.equal(await service.isDeliverable("d-nasr"), true);
});

test("failed and malformed address downloads are retried rather than cached", async () => {
  for (const failure of [null, new Error("provider unavailable")]) {
    let recovered = false;
    const service = new BostaAddressService(async () => {
      if (recovered) return structuredClone(DISTRICTS_PAYLOAD);
      if (failure instanceof Error) throw failure;
      return failure;
    });
    await assert.rejects(service.findDistrict("d-nasr"));
    recovered = true;
    assert.equal(await service.isDeliverable("d-nasr"), true);
  }
});

test("mutating a district result cannot change later destination validation", async () => {
  const service = new BostaAddressService(async () => structuredClone(DISTRICTS_PAYLOAD));
  const district = await service.findDistrict("d-helio");
  assert.ok(district);
  district.dropOffAvailable = true;
  assert.equal(await service.isDeliverable("d-helio"), false);
});
