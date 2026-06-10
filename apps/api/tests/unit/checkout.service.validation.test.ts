import assert from "node:assert/strict";
import test from "node:test";

import { submitCheckout } from "../../src/modules/checkout/checkout.service.js";

test("submitCheckout rejects malformed Egyptian phone numbers", async () => {
  await assert.rejects(
    submitCheckout({
      fullName: "Bad Phone User",
      phone: "01912345678",
      email: "bad-phone@example.com",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      buildingApartment: "Building 2, Apt 5",
      paymentMethod: "cod",
      items: [{ type: "product", variantId: 1, qty: 1 }]
    }),
    /Invalid Egyptian phone number/
  );
});

test("submitCheckout rejects governorates outside the canonical list", async () => {
  await assert.rejects(
    submitCheckout({
      fullName: "Bad Governorate User",
      phone: "01012345678",
      email: "bad-governorate@example.com",
      governorate: "NotARealGovernorate",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      buildingApartment: "Building 2, Apt 5",
      paymentMethod: "cod",
      items: [{ type: "product", variantId: 1, qty: 1 }]
    }),
    /Invalid governorate/
  );
});
