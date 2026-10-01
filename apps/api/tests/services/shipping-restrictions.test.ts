import assert from "node:assert/strict";
import test from "node:test";

async function restrictions() {
  const module = await import("../../src/modules/shipping/shipping-restrictions.js").catch(() => null);
  assert.ok(module?.assertShippingRestrictionsAllowed, "shared shipping restriction validator is required");
  return module;
}

const longLine = "Street 1, Building 2 apartment 3";

test("the drop-off first line is built once and shared by checkout, edits and dispatch", async () => {
  const { buildDropOffFirstLine, MIN_ADDRESS_LINE_LENGTH } = await restrictions();
  assert.equal(buildDropOffFirstLine("Street 1", "Building 2 apartment 3"), "Street 1, Building 2 apartment 3");
  assert.equal(MIN_ADDRESS_LINE_LENGTH, 6, "the carrier requires more than five characters");
});

test("EGP 30,000 exactly is allowed and 30,000.01 is rejected", async () => {
  const { assertShippingRestrictionsAllowed, MAX_COD_CENTS } = await restrictions();
  assert.equal(MAX_COD_CENTS, 3_000_000);
  assert.doesNotThrow(() => assertShippingRestrictionsAllowed({ firstLine: longLine, paymentMethod: "cod", codAmountCents: 3_000_000 }));
  assert.throws(() => assertShippingRestrictionsAllowed({ firstLine: longLine, paymentMethod: "cod", codAmountCents: 3_000_001 }),
    (error: any) => error.code === "SHIPPING_COD_LIMIT" && error.status === 400);
});

test("prepaid collection stays zero and an above-ceiling paid total is never rejected", async () => {
  const { assertShippingRestrictionsAllowed } = await restrictions();
  for (const codAmountCents of [0, 9_000_000]) {
    assert.doesNotThrow(() => assertShippingRestrictionsAllowed({ firstLine: longLine, paymentMethod: "paymob", codAmountCents }));
  }
});

test("a combined address line of five characters or fewer is rejected with a specific code", async () => {
  const { assertShippingRestrictionsAllowed, assertAddressAllowed } = await restrictions();
  for (const firstLine of ["", "a", "a, b", "abc,d"]) {
    assert.throws(() => assertShippingRestrictionsAllowed({ firstLine, paymentMethod: "cod", codAmountCents: 0 }),
      (error: any) => error.code === "SHIPPING_ADDRESS_INVALID" && error.status === 400);
  }
  // Whitespace-only is invalid too, even though it is long enough.
  assert.throws(() => assertShippingRestrictionsAllowed({ firstLine: "        ", paymentMethod: "cod", codAmountCents: 0 }),
    (error: any) => error.code === "SHIPPING_ADDRESS_INVALID");
  assert.throws(() => assertAddressAllowed("a", "b"), (error: any) => error.code === "SHIPPING_ADDRESS_INVALID");
  assert.doesNotThrow(() => assertAddressAllowed("Street 1", "Building 2"));
});

test("an absent address is not a restriction failure, so a quote made without one still succeeds", async () => {
  const { assertShippingRestrictionsAllowed } = await restrictions();
  assert.doesNotThrow(() => assertShippingRestrictionsAllowed({ firstLine: null, paymentMethod: "cod", codAmountCents: 500 }));
  assert.throws(() => assertShippingRestrictionsAllowed({ firstLine: null, paymentMethod: "cod", codAmountCents: 3_000_001 }),
    (error: any) => error.code === "SHIPPING_COD_LIMIT", "the money rule still applies without an address");
});

test("the address rule is checked before the COD rule so a bad address is never reported as a money problem", async () => {
  const { assertShippingRestrictionsAllowed } = await restrictions();
  assert.throws(() => assertShippingRestrictionsAllowed({ firstLine: "a, b", paymentMethod: "cod", codAmountCents: 9_000_000 }),
    (error: any) => error.code === "SHIPPING_ADDRESS_INVALID");
});