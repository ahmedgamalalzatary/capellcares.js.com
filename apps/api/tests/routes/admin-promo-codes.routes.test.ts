import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { promoCodeEvents, promoCodes } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

const body = (overrides: Record<string, unknown> = {}) => ({
  code: "summer20",
  arName: "خصم الصيف",
  enName: "Summer sale",
  startsAt: null,
  endsAt: null,
  discountType: "percentage",
  discountValue: 20,
  maxDiscountAmount: null,
  freeShipping: false,
  gift: null,
  eligibility: { scope: "all", include: [], exclude: [] },
  minOrderAmount: null,
  maxOrderAmount: null,
  minEligiblePieces: null,
  maxDiscountedPieces: null,
  totalUsageLimit: null,
  perCustomerLimit: null,
  firstOrderOnly: false,
  isPrivate: false,
  customerIds: [],
  ...overrides
});

const json = (payload: unknown, headers: Record<string, string>) => ({
  method: "POST",
  headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify(payload)
});

test("an admin creates a code with every benefit and rule, and reads it back with its targets, customers and audit", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const created = await request("/api/erp/promo-codes", json(body({
      discountType: "fixed",
      discountValue: 50,
      freeShipping: true,
      gift: { itemType: "product_variant", itemId: ids.firstVariantId, qty: 1 },
      eligibility: { scope: "selected", include: [{ type: "category", id: ids.rootCategoryId }, { type: "offer", id: ids.offerId }], exclude: [{ type: "product", id: ids.productTwoId }] },
      minOrderAmount: 100,
      maxOrderAmount: 5000,
      minEligiblePieces: 2,
      maxDiscountedPieces: 5,
      totalUsageLimit: 100,
      perCustomerLimit: 1,
      firstOrderOnly: true,
      isPrivate: true,
      customerIds: [ids.customerId],
      startsAt: "2030-01-01T00:00:00.000Z",
      endsAt: "2030-02-01T00:00:00.000Z"
    }), headers));
    assert.equal(created.status, 201, JSON.stringify(created.json));

    const detail = await request(`/api/erp/promo-codes/${created.json.id}`, { headers });
    assert.equal(detail.status, 200);
    const code = detail.json;
    assert.equal(code.code, "SUMMER20");
    assert.equal(code.status, "active");
    assert.equal(code.discountType, "fixed");
    assert.equal(code.discountValue, 50);
    assert.equal(code.freeShipping, true);
    assert.deepEqual(code.gift, { itemType: "product_variant", itemId: ids.firstVariantId, qty: 1 });
    assert.equal(code.startsAt, "2030-01-01T00:00:00.000Z");
    assert.equal(code.endsAt, "2030-02-01T00:00:00.000Z");
    assert.equal(code.firstOrderOnly, true);
    assert.equal(code.isPrivate, true);
    assert.equal(code.showInAccount, false);
    assert.deepEqual(code.eligibility.include.map((target: { type: string }) => target.type).sort(), ["category", "offer"]);
    assert.deepEqual(code.eligibility.exclude, [{ type: "product", id: ids.productTwoId }]);
    assert.deepEqual(code.customers.map((customer: { id: number }) => customer.id), [ids.customerId]);
    assert.deepEqual(code.events.map((event: { action: string }) => event.action), ["created"]);
    assert.deepEqual(code.usage, { used: 0, reserved: 0, released: 0, overLimit: 0 });
  });
});

test("a code without a start date starts when it is created", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const before = Date.now();
    const created = await request("/api/erp/promo-codes", json(body(), headers));
    const detail = await request(`/api/erp/promo-codes/${created.json.id}`, { headers });
    const startsAt = new Date(detail.json.startsAt).getTime();
    assert.ok(startsAt >= before - 2000 && startsAt <= Date.now() + 2000, detail.json.startsAt);
    assert.equal(detail.json.endsAt, null);
  });
});

test("creation refuses invalid rules, duplicate codes in any case, ended schedules and missing items", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const invalid = await request("/api/erp/promo-codes", json(body({ discountType: null, discountValue: null }), headers));
    assert.equal(invalid.status, 400);
    assert.deepEqual(invalid.json.errors, ["promo.benefit_required"]);

    assert.equal((await request("/api/erp/promo-codes", json(body(), headers))).status, 201);
    const duplicate = await request("/api/erp/promo-codes", json(body({ code: " Summer20 " }), headers));
    assert.equal(duplicate.status, 409);
    assert.deepEqual(duplicate.json.errors, ["promo.code_taken"]);

    const ended = await request("/api/erp/promo-codes", json(body({ code: "OLD1", endsAt: "2020-01-01T00:00:00.000Z" }), headers));
    assert.equal(ended.status, 400);
    assert.deepEqual(ended.json.errors, ["promo.schedule_ended"]);

    const missing = await request("/api/erp/promo-codes", json(body({ code: "GHOST", eligibility: { scope: "selected", include: [{ type: "product", id: 999999 }], exclude: [] } }), headers));
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.json.errors, ["promo.target_missing"]);

    const missingGift = await request("/api/erp/promo-codes", json(body({ code: "GHOSTGIFT", gift: { itemType: "offer", itemId: 999999, qty: 1 } }), headers));
    assert.deepEqual(missingGift.json.errors, ["promo.gift_missing"]);

    const missingCustomer = await request("/api/erp/promo-codes", json(body({ code: "GHOSTCUST", isPrivate: true, customerIds: [999999] }), headers));
    assert.deepEqual(missingCustomer.json.errors, ["promo.customer_missing"]);
  });
});

test("codes cannot be edited or deleted; only their status changes, active ⇄ paused → stopped, each change audited", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { id } = (await request("/api/erp/promo-codes", json(body(), headers))).json;
    const status = (action: string) => request(`/api/erp/promo-codes/${id}/status`, json({ action }, headers));

    assert.equal((await request(`/api/erp/promo-codes/${id}`, { method: "PUT", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body({ discountValue: 90 })) })).status, 404);
    assert.equal((await request(`/api/erp/promo-codes/${id}`, { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: "{}" })).status, 404);
    assert.equal((await request(`/api/erp/promo-codes/${id}`, { method: "DELETE", headers })).status, 404);

    assert.equal((await status("resume")).status, 409);
    assert.equal((await status("pause")).json.status, "paused");
    assert.equal((await status("pause")).status, 409);
    assert.equal((await status("resume")).json.status, "active");
    assert.equal((await status("stop")).json.status, "stopped");
    assert.equal((await status("resume")).status, 409);
    assert.equal((await status("stop")).status, 409);

    const [row] = await db.select({ discountValue: promoCodes.discountValue }).from(promoCodes).where(eq(promoCodes.id, id));
    assert.equal(Number(row!.discountValue), 20);
    const events = await db.select({ action: promoCodeEvents.action }).from(promoCodeEvents).where(eq(promoCodeEvents.promoCodeId, id)).orderBy(promoCodeEvents.id);
    assert.deepEqual(events.map((event) => event.action), ["created", "paused", "resumed", "stopped"]);
  });
});

test("the list shows every code newest first with its use count, filtered by status", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const first = (await request("/api/erp/promo-codes", json(body({ code: "FIRST" }), headers))).json;
    await request("/api/erp/promo-codes", json(body({ code: "SECOND", totalUsageLimit: 50 }), headers));
    await request(`/api/erp/promo-codes/${first.id}/status`, json({ action: "pause" }, headers));

    const all = await request("/api/erp/promo-codes", { headers });
    assert.deepEqual(all.json.items.map((item: { code: string }) => item.code), ["SECOND", "FIRST"]);
    assert.deepEqual(all.json.items[0].usage, { used: 0, reserved: 0, released: 0, overLimit: 0 });
    assert.equal(all.json.items[0].totalUsageLimit, 50);

    const paused = await request("/api/erp/promo-codes?status=paused", { headers });
    assert.deepEqual(paused.json.items.map((item: { code: string }) => item.code), ["FIRST"]);
  });
});

test("staff need promos.read to view, promos.create to create and promos.update_status to change status", async () => {
  await withTestServer(app, async (request) => {
    const admin = await getAdminAuthHeaders(request);
    const { id } = (await request("/api/erp/promo-codes", json(body(), admin))).json;

    const none = await getStaffAuthHeaders(request);
    assert.equal((await request("/api/erp/promo-codes", { headers: none })).status, 403);

    const reader = await getStaffAuthHeaders(request, { permissionKeys: ["promos.read"] });
    assert.equal((await request("/api/erp/promo-codes", { headers: reader })).status, 200);
    assert.equal((await request(`/api/erp/promo-codes/${id}`, { headers: reader })).status, 200);
    assert.equal((await request("/api/erp/promo-codes", json(body({ code: "NEWONE" }), reader))).status, 403);
    assert.equal((await request(`/api/erp/promo-codes/${id}/status`, json({ action: "pause" }, reader))).status, 403);

    const creator = await getStaffAuthHeaders(request, { permissionKeys: ["promos.create"] });
    assert.equal((await request("/api/erp/promo-codes", json(body({ code: "NEWONE" }), creator))).status, 201);
    assert.equal((await request("/api/erp/promo-codes/customers?q=seed", { headers: creator })).status, 200);

    const switcher = await getStaffAuthHeaders(request, { permissionKeys: ["promos.update_status"] });
    assert.equal((await request(`/api/erp/promo-codes/${id}/status`, json({ action: "pause" }, switcher))).status, 200);
  });
});

test("staff creating a private code search customers by name or email", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const found = await request("/api/erp/promo-codes/customers?q=seed-customer", { headers });
    assert.deepEqual(found.json.items.map((customer: { id: number }) => customer.id), [ids.customerId]);
    assert.ok(found.json.items[0].email);
    assert.deepEqual((await request("/api/erp/promo-codes/customers?q=nobody-here", { headers })).json.items, []);
  });
});
