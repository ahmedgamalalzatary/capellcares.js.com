import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { db } from "@capella/database/src/db";
import { orders, orderItems } from "@capella/database/drizzle/schema";
import { getSalesAnalyticsRepo } from "../../src/repositories/order.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
beforeEach(resetApiTestDatabase);
test("shipping income cannot be assigned to the final product in sales totals", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({ orderCode: "SHIP-SALE-1", customerType: "guest",
    fullName: "Buyer", phone: "01012345678", email: "buyer@example.com", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod", paymentStatus: "accepted",
    totalAmount: "167.29", shippingAmountCents: 9729 }).$returningId();
  await db.insert(orderItems).values({ orderId: order.id, itemType: "product_variant", variantId: ids.firstVariantId,
    qty: 2, unitPrice: "35.00", lineTotal: "70.00" });
  const sales = await getSalesAnalyticsRepo();
  assert.equal(sales.summary.totalRevenue, 70);
  assert.equal(sales.variantTotals[0].revenue, 70);
});
