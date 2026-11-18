import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { customers, orders, promoCodeCustomers, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { PromoRejectedError } from "../../src/modules/promos/promo-checkout.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

// Spec section 7, cases 22-25: who counts as the same customer for first-order, per-customer and private codes.
beforeEach(resetApiTestDatabase);

async function code(overrides: Partial<typeof promoCodes.$inferInsert>) {
  const text = overrides.code ?? "ONCE";
  const [row] = await db.insert(promoCodes).values({ arName: "خصم", enName: "Code", status: "active", startsAt: new Date(Date.now() - 60_000),
    discountType: "percentage", discountValue: "10.00", eligibilityScope: "all", ...overrides, code: text, codeNormalized: text }).$returningId();
  return row!.id;
}

async function newCustomer(email: string) {
  const [row] = await db.insert(customers).values({ name: "New Account", email, passwordHash: "unused" }).$returningId();
  return row!.id;
}

async function pastOrder(values: { customerId: number | null; phone: string; paymentStatus?: "pending" | "accepted" | "denied" }) {
  await db.insert(orders).values({ orderCode: `PAST-${crypto.randomUUID().slice(0, 8)}`, customerType: values.customerId ? "registered" : "guest",
    customerId: values.customerId, fullName: "Earlier", phone: values.phone, email: "earlier@capella.test", governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street", buildingApartment: "1", notes: "", paymentMethod: "cod",
    paymentStatus: values.paymentStatus ?? "accepted", totalAmount: "100.00" });
}

async function checkout(customerId: number, phone: string, promoCode = "ONCE") {
  const ids = await getBaselineIds();
  return { fullName: "Buyer", phone, email: "buyer@capella.test", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1",
    buildingApartment: "1", paymentMethod: "cod" as const, customerId, promoCode, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
}

const reason = async (payload: Awaited<ReturnType<typeof checkout>>) => (await priceCheckout(payload)).promo?.dto.status === "applied"
  ? "applied" : (await priceCheckout(payload)).promo?.dto.reason;

test("#22 a first-order code is refused when a guest order already used this phone in another format", async () => {
  const fresh = await newCustomer("fresh@capella.test");
  await code({ firstOrderOnly: true });
  await pastOrder({ customerId: null, phone: "+201011112222" });
  assert.equal(await reason(await checkout(fresh, "010 1111 2222")), "first_order");
  assert.equal(await reason(await checkout(fresh, "01033334444")), "applied");
});

test("#24 a first-order code is refused for an account with any earlier order, even denied and under another phone", async () => {
  const { customerId } = await getBaselineIds();
  await code({ firstOrderOnly: true });
  await pastOrder({ customerId, phone: "+201055556666", paymentStatus: "denied" });
  assert.equal(await reason(await checkout(customerId, "01077778888")), "first_order");
});

test("#23 a deleted and re-created account cannot use a per-customer code again from the same phone", async () => {
  const codeId = await code({ perCustomerLimit: 1 });
  // The first account's redemption keeps its phone after the account is gone (customer_id set null).
  await db.insert(promoRedemptions).values({ promoCodeId: codeId, customerId: null, phoneNormalized: "+201099990000", state: "used" });
  const recreated = await newCustomer("recreated@capella.test");
  await assert.rejects(createOrderFromCheckout(await checkout(recreated, "01099990000"), { idempotencyKey: crypto.randomUUID() }),
    (error: unknown) => error instanceof PromoRejectedError && error.rejection.reason === "customer_limit");
});

test("the per-customer limit also follows the account when the customer changes phone", async () => {
  const { customerId } = await getBaselineIds();
  const codeId = await code({ perCustomerLimit: 1 });
  await db.insert(promoRedemptions).values({ promoCodeId: codeId, customerId, phoneNormalized: "+201011110000", state: "used" });
  assert.equal(await reason(await checkout(customerId, "01022220000")), "customer_limit");
});

test("#25 a private code forwarded to another account is refused; the listed account can use it", async () => {
  const { customerId } = await getBaselineIds();
  const privateId = await code({ code: "VIP", isPrivate: true });
  await db.insert(promoCodeCustomers).values({ promoCodeId: privateId, customerId });
  const stranger = await newCustomer("stranger@capella.test");
  assert.equal(await reason(await checkout(stranger, "01012345678", "vip")), "private");
  assert.equal(await reason(await checkout(customerId, "01012345678", "vip")), "applied");
});

test("released uses do not count toward limits, so a cancelled order frees a first use again", async () => {
  const { customerId } = await getBaselineIds();
  const codeId = await code({ perCustomerLimit: 1, totalUsageLimit: 1 });
  await db.insert(promoRedemptions).values({ promoCodeId: codeId, customerId, phoneNormalized: "+201012345678", state: "released", releaseReason: "cancelled" });
  assert.equal(await reason(await checkout(customerId, "01012345678")), "applied");
});
