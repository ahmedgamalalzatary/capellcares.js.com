import assert from "node:assert/strict";
import test from "node:test";

async function read() {
  const module = await import("../../src/modules/shipping/bosta/bosta-delivery-read.js").catch(() => null);
  assert.ok(module?.normalizeDeliveryType, "shared Bosta delivery-read normalizer is required");
  return module;
}

// Authoritative zoning evidence. A district NAME is never an identifier; it only resolves when exactly one district in the authoritative data carries that name under the already-proven city/zone.
const zoning = [
  { cityId: "city-cairo", zoneId: "zone-nasr", districtId: "district-nasr", districtName: "District 1" },
  { cityId: "city-cairo", zoneId: "zone-masr", districtId: "district-masr-1", districtName: "Shared Name" },
  { cityId: "city-giza", zoneId: "zone-masr", districtId: "district-giza-1", districtName: "Shared Name" }
];
const resolveByName = (query: { cityId?: string | null; zoneId?: string | null; districtName?: string | null }) =>
  zoning.filter((district) => (!query.cityId || district.cityId === query.cityId)
    && (!query.zoneId || district.zoneId === query.zoneId)
    && (!query.districtName || district.districtName === query.districtName));

test("delivery type accepts the documented object form and the bare numeric form for the same code", async () => {
  const { normalizeDeliveryType } = await read();
  assert.deepEqual(normalizeDeliveryType({ code: 10, value: "Send" }), { code: 10, label: "SEND" });
  assert.deepEqual(normalizeDeliveryType(10), { code: 10, label: "SEND" });
  assert.equal(normalizeDeliveryType(15).label, "CASH_COLLECTION");
  assert.equal(normalizeDeliveryType(25).label, "CUSTOMER_RETURN_PICKUP");
  assert.equal(normalizeDeliveryType(30).label, "EXCHANGE");
});

test("an unmapped type code is labelled from its code, never from untrusted provider display text", async () => {
  const { normalizeDeliveryType } = await read();
  assert.deepEqual(normalizeDeliveryType({ code: 666, value: "provider credential echo" }), { code: 666, label: "UNKNOWN_666" });
  assert.deepEqual(normalizeDeliveryType({ code: 666 }), { code: 666, label: "UNKNOWN_666" });
});

test("a type that is neither an integer nor a validated object is unresolved, and text alone never becomes a code", async () => {
  const { normalizeDeliveryType } = await read();
  for (const invalid of ["10", "Send", null, undefined, {}, { code: "10", value: "Send" }, { code: 10.5 }, true]) {
    assert.throws(() => normalizeDeliveryType(invalid), /type/i);
  }
});

test("a tracking identifier normalizes consistently across numeric and string provider forms", async () => {
  const { normalizeTrackingIdentifier } = await read();
  assert.equal(normalizeTrackingIdentifier("5108002"), "5108002");
  assert.equal(normalizeTrackingIdentifier(5108002), "5108002");
  assert.equal(normalizeTrackingIdentifier(" 5108002 "), "5108002");
  for (const invalid of ["", "   ", null, 0, -1, 1.5, {}, "x".repeat(65)]) {
    assert.throws(() => normalizeTrackingIdentifier(invalid), /identifier/i);
  }
});

test("flat address identifiers are preserved exactly as the provider returned them", async () => {
  const { normalizeReadAddress } = await read();
  assert.deepEqual(await normalizeReadAddress({ city: "Cairo", zoneId: "zone-nasr", districtId: "district-nasr",
    firstLine: "Street 1, Building 2 apartment 3" }, resolveByName), {
    cityId: null, zoneId: "zone-nasr", districtId: "district-nasr", firstLine: "Street 1, Building 2 apartment 3"
  });
});

test("documented nested city and zone objects resolve to identifiers, and a name-only district resolves by unique proof", async () => {
  const { normalizeReadAddress } = await read();
  assert.deepEqual(await normalizeReadAddress({
    city: { _id: "city-cairo", name: "cairo" },
    zone: { _id: "zone-nasr", name: "Nasr City" },
    districtName: "District 1",
    firstLine: "Street 1, Building 2 apartment 3"
  }, resolveByName), {
    cityId: "city-cairo", zoneId: "zone-nasr", districtId: "district-nasr", firstLine: "Street 1, Building 2 apartment 3"
  });
});

test("a district name that is ambiguous across zones or cities stays unresolved instead of guessing", async () => {
  const { normalizeReadAddress } = await read();
  // No city/zone proven, and two districts share the name: never pick one.
  const unqualified = await normalizeReadAddress({ districtName: "Shared Name", firstLine: "Street 1" }, resolveByName);
  assert.equal(unqualified.districtId, null, "an ambiguous district name must never be invented");
  // City+zone proven and unique under them: resolvable.
  const proven = await normalizeReadAddress({ city: { _id: "city-cairo" }, zone: { _id: "zone-nasr" },
    districtName: "District 1", firstLine: "Street 1" }, resolveByName);
  assert.equal(proven.districtId, "district-nasr");
});

test("the documented nested `_id` form is believed, and a non-documented alias is not an identifier", async () => {
  const { normalizeReadAddress, assertAddressMatches } = await read();
  // Bosta's City/CityRef/ZoneRef schemas all document `_id` (docs.bosta.co/api/api.yaml).
  assert.deepEqual(await normalizeReadAddress({
    city: { _id: "city-cairo", name: "cairo" },
    zone: { _id: "zone-nasr", name: "Nasr City" },
    districtId: "district-nasr",
    firstLine: "Street 1, Building 2 apartment 3"
  }, resolveByName), {
    cityId: "city-cairo", zoneId: "zone-nasr", districtId: "district-nasr", firstLine: "Street 1, Building 2 apartment 3"
  });
  // `id` is not the documented nested field. It must never be silently promoted to identity, so a requested city can never correlate against an alias-only read.
  const aliasOnly = await normalizeReadAddress({ city: { id: "city-cairo" }, districtId: "district-nasr",
    firstLine: "Street 1" }, resolveByName);
  assert.equal(aliasOnly.cityId, null, "an undocumented nested alias is not proof of city identity");
  assert.throws(() => assertAddressMatches(aliasOnly, { cityId: "city-cairo", districtId: "district-nasr",
    firstLine: "Street 1" }), /city|correlat/i);
});

test("a nested alias and a flat id that disagree are a contradiction, not a preference", async () => {
  const { normalizeReadAddress } = await read();
  // Documented `_id` and an alias `id` naming different cities must not be resolved by picking one: a response carrying two identities is an unresolved read.
  await assert.rejects(normalizeReadAddress({ city: { _id: "city-cairo", id: "city-giza" },
    districtId: "district-nasr", firstLine: "Street 1" }, resolveByName), /contradict/i);
  await assert.rejects(normalizeReadAddress({ cityId: "city-cairo", city: { _id: "city-giza" },
    districtId: "district-nasr", firstLine: "Street 1" }, resolveByName), /contradict/i);
  await assert.rejects(normalizeReadAddress({ zoneId: "zone-nasr", zone: { _id: "zone-masr" },
    districtId: "district-nasr", firstLine: "Street 1" }, resolveByName), /contradict/i);
});

test("a district name resolves only under a city/zone the response actually proved", async () => {
  const { normalizeReadAddress } = await read();
  // With the documented `_id`, "District 1" is uniquely resolvable under Cairo/Nasr City.
  assert.equal((await normalizeReadAddress({ city: { _id: "city-cairo" }, zone: { _id: "zone-nasr" },
    districtName: "District 1", firstLine: "Street 1" }, resolveByName)).districtId, "district-nasr");
  // A flat zone id is proof too, and a matching district resolves under it.
  assert.equal((await normalizeReadAddress({ zoneId: "zone-nasr", districtName: "District 1",
    firstLine: "Street 1" }, resolveByName)).districtId, "district-nasr");
  // No city or zone at all: a name shared by two cities must stay unresolved.
  assert.equal((await normalizeReadAddress({ districtName: "Shared Name", firstLine: "Street 1" },
    resolveByName)).districtId, null);
  // An alias-only city does not narrow the search either.
  assert.equal((await normalizeReadAddress({ city: { id: "city-cairo" }, districtName: "Shared Name",
    firstLine: "Street 1" }, resolveByName)).districtId, null);
});

test("a district name with no authoritative match and a missing address both remain unresolved", async () => {
  const { normalizeReadAddress } = await read();
  assert.equal((await normalizeReadAddress({ districtName: "Nowhere", firstLine: "Street 1" }, resolveByName)).districtId, null);
  assert.equal((await normalizeReadAddress(undefined, resolveByName)).districtId, null);
});

test("flat and nested identifiers that contradict each other fail closed rather than preferring one", async () => {
  const { normalizeReadAddress } = await read();
  await assert.rejects(normalizeReadAddress({ zoneId: "zone-masr", zone: { _id: "zone-nasr" }, districtId: "district-nasr",
    firstLine: "Street 1" }, resolveByName), /contradict/i);
  await assert.rejects(normalizeReadAddress({ cityId: "city-cairo", city: { _id: "city-giza" },
    districtId: "district-nasr", firstLine: "Street 1" }, resolveByName), /contradict/i);
});

test("the documented create/drop-off form using a flat cityId and a district name resolves by unique proof", async () => {
  const { normalizeReadAddress } = await read();
  // Documented shape: { city, cityId, districtName, firstLine }.
  assert.deepEqual(await normalizeReadAddress({ city: "Cairo", cityId: "city-cairo", districtName: "District 1",
    firstLine: "Street 1, Building 2 apartment 3" }, resolveByName), {
    cityId: "city-cairo", zoneId: null, districtId: "district-nasr", firstLine: "Street 1, Building 2 apartment 3"
  });
  // A name that matches nothing authoritative stays unresolved.
  assert.equal((await normalizeReadAddress({ city: "Cairo", cityId: "city-cairo", districtName: "Nowhere",
    firstLine: "Street 1" }, resolveByName)).districtId, null);
});

test("address comparison requires the normalized identifiers and the complete requested line together", async () => {
  const { normalizeReadAddress, assertAddressMatches } = await read();
  const address = await normalizeReadAddress({ city: { _id: "city-cairo" }, zone: { _id: "zone-nasr" },
    districtId: "district-nasr", firstLine: "Street 1, Building 2 apartment 3" }, resolveByName);
  const requested = { zoneId: "zone-nasr", districtId: "district-nasr", firstLine: "Street 1, Building 2 apartment 3" };
  assert.doesNotThrow(() => assertAddressMatches(address, requested));
  assert.throws(() => assertAddressMatches(address, { ...requested, firstLine: "Street 1" }), /address|correlat/i);
  assert.throws(() => assertAddressMatches(address, { ...requested, districtId: "district-other" }), /address|correlat/i);
  const unproven = await normalizeReadAddress({ firstLine: "Street 1" }, resolveByName);
  assert.throws(() => assertAddressMatches(unproven, requested),
    /address|correlat/i, "an address with no provable identity can never match a requested destination");
});

test("a complete delivery read normalizes the documented shape and rejects contradictory money, size and recipient", async () => {
  const { normalizeDeliveryRead, assertDeliveryMatches } = await read();
  const request = {
    trackingNumber: "5108002", businessReference: "bosta_create_7", typeCode: 10, requestedCodCents: 13229,
    size: "SMALL", recipientPhone: "+201012345678",
    address: { zoneId: "zone-nasr", districtId: "district-nasr", firstLine: "Street 1, Building 2 apartment 3" }
  };
  const correlated = await normalizeDeliveryRead({
    success: true,
    data: {
      _id: "provider-delivery", trackingNumber: 5108002, businessReference: "bosta_create_7",
      type: { code: 10, value: "Send" }, state: { code: 45, value: "Delivered" },
      cod: 132.29, collection: { amount: 132.29, confirmed: true }, specs: { size: "SMALL" }, receiver: { phone: "01012345678" },
      dropOffAddress: { city: { _id: "city-cairo" }, zone: { _id: "zone-nasr" }, districtId: "district-nasr",
        firstLine: "Street 1, Building 2 apartment 3" }
    }
  }, { resolveByName });

  assert.equal(correlated.trackingNumber, "5108002");
  assert.equal(correlated.type.code, 10);
  assert.equal(correlated.collectedAmountCents, 13229);
  assert.equal(correlated.requestedCodAmountCents, 13229);
  assert.equal(correlated.recipientPhone, "+201012345678");
  assert.equal(correlated.address.districtId, "district-nasr");

  // Everything that must NOT correlate.
  for (const [changes, pattern] of [
    [{ businessReference: "other" }, /reference|correlat/i],
    [{ type: { code: 25, value: "Return" } }, /type/i],
    [{ cod: 35 }, /correlat|money/i],
    [{ specs: { size: "LARGE" } }, /correlat|size/i],
    [{ receiver: { phone: "010999999999" } }, /correlat|recipient/i]
  ] as const) {
    const read = await normalizeDeliveryRead({ success: true,
      data: { trackingNumber: 5108002, businessReference: "bosta_create_7", type: { code: 10, value: "Send" },
        state: { code: 45, value: "Delivered" }, cod: 132.29, specs: { size: "SMALL" },
        receiver: { phone: "01012345678" },
        dropOffAddress: { zone: { _id: "zone-nasr" }, districtId: "district-nasr",
          firstLine: "Street 1, Building 2 apartment 3" }, ...changes } }, { resolveByName });
    assert.throws(() => assertDeliveryMatches(read, request), pattern);
  }

  // A tracking number that is not the one searched for never correlates.
  const otherTracking = await normalizeDeliveryRead({ success: true,
    data: { trackingNumber: "5108003", businessReference: "bosta_create_7", type: { code: 10, value: "Send" },
      state: { code: 45, value: "Delivered" }, cod: 132.29, specs: { size: "SMALL" },
      receiver: { phone: "01012345678" },
      dropOffAddress: { zone: { _id: "zone-nasr" }, districtId: "district-nasr",
        firstLine: "Street 1, Building 2 apartment 3" } } }, { resolveByName });
  assert.throws(() => assertDeliveryMatches(otherTracking, request), /tracking|correlat/i);

  assert.doesNotThrow(() => assertDeliveryMatches(correlated, request));
});

test("a malformed business read is unresolved rather than evidence that no delivery exists", async () => {
  const { normalizeDeliveryRead } = await read();
  for (const invalid of [null, {}, { success: false }, { success: true }, { success: true, data: null },
    { success: true, data: { trackingNumber: "5108002", state: { code: 45, value: "Delivered" } } }]) {
    await assert.rejects(normalizeDeliveryRead(invalid, { resolveByName }), /invalid|malformed|correlat|tracking/i);
  }
});