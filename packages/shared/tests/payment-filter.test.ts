import assert from "node:assert/strict";
import test from "node:test";
import { orderMatchesPaymentStatusFilter, PAYMOB_REVERSED_STATUSES } from "../src/constants/payment-filter.js";

const cod = (paymentStatus: "pending" | "accepted" | "denied") => ({ paymentMethod: "cod" as const, paymentStatus, providerPaymentStatus: null });
const paymob = (providerPaymentStatus: "pending" | "succeeded" | "failed" | "partially_refunded" | "refunded" | "voided" | null) =>
  ({ paymentMethod: "paymob" as const, paymentStatus: "accepted" as const, providerPaymentStatus });

test("cash on delivery orders match by the staff-set status", () => {
  assert.equal(orderMatchesPaymentStatusFilter(cod("accepted"), "accepted"), true);
  assert.equal(orderMatchesPaymentStatusFilter(cod("accepted"), "pending"), false);
});

test("Paymob orders match by the provider's status", () => {
  assert.equal(orderMatchesPaymentStatusFilter(paymob("succeeded"), "accepted"), true);
  for (const status of PAYMOB_REVERSED_STATUSES) assert.equal(orderMatchesPaymentStatusFilter(paymob(status), "denied"), true);
  assert.equal(orderMatchesPaymentStatusFilter(paymob("pending"), "pending"), true);
  assert.equal(orderMatchesPaymentStatusFilter(paymob(null), "pending"), true);
  assert.equal(orderMatchesPaymentStatusFilter(paymob("succeeded"), "pending"), false);
});
