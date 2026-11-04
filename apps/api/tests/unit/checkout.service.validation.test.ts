import assert from "node:assert/strict";
import test from "node:test";

import { submitCheckout } from "../../src/modules/checkout/checkout.service.js";

test("submitCheckout rejects malformed Kuwaiti phone numbers", async () => {
  await assert.rejects(
    submitCheckout({
      fullName: "Bad Phone User",
      phone: "01012345678",
      email: "bad-phone@example.com",
      areaId: 1,
      addressLine: "Block 3, Street 10",
      buildingApartment: "Building 2, Apt 5",
      paymentMethod: "cod",
      items: [{ type: "product", variantId: 1, qty: 1 }]
    }),
    /Invalid Kuwaiti phone number/
  );
});
