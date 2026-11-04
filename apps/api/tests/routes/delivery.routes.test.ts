import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { db } from "@capella/database/src/db";
import { deliveryAreas, deliveryGovernorates, orders, productVariants, products } from "@capella/database/drizzle/schema";

beforeEach(async () => {
  await resetApiTestDatabase();
});

/** Area 2 style setup: one active governorate with a paid area, plus inactive ones checkout must hide. */
async function seedDelivery() {
  await db.delete(deliveryGovernorates);
  const [ahmadi] = await db.insert(deliveryGovernorates).values({ arName: "الأحمدي", enName: "Ahmadi", sortOrder: 1 }).$returningId();
  const [jahra] = await db.insert(deliveryGovernorates).values({ arName: "الجهراء", enName: "Jahra", status: "inactive", sortOrder: 2 }).$returningId();
  const [empty] = await db.insert(deliveryGovernorates).values({ arName: "العاصمة", enName: "Capital", sortOrder: 0 }).$returningId();
  const [fahaheel] = await db.insert(deliveryAreas).values({ governorateId: ahmadi!.id, arName: "الفحيحيل", enName: "Fahaheel", fee: "1.500" }).$returningId();
  const [closed] = await db.insert(deliveryAreas).values({ governorateId: ahmadi!.id, arName: "المنقف", enName: "Mangaf", fee: "1.000", status: "inactive" }).$returningId();
  const [jahraArea] = await db.insert(deliveryAreas).values({ governorateId: jahra!.id, arName: "الجهراء", enName: "Jahra City", fee: "3.000" }).$returningId();
  await db.insert(deliveryAreas).values({ governorateId: empty!.id, arName: "الشرق", enName: "Sharq", fee: "1.000", status: "inactive" });
  return { fahaheelId: fahaheel!.id, closedAreaId: closed!.id, jahraAreaId: jahraArea!.id };
}

function checkoutBody(areaId: number, items: unknown[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    fullName: "Kuwait Buyer",
    phone: "55123456",
    email: "kuwait-buyer@capella.test",
    areaId,
    addressLine: "Block 3, Street 10",
    buildingApartment: "House 4",
    paymentMethod: "cod",
    items,
    ...extra
  });
}

const jsonHeaders = () => ({ "content-type": "application/json", "idempotency-key": crypto.randomUUID() });

test("checkout lists only active governorates that have an active area, without fees", async () => {
  await seedDelivery();
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/delivery/governorates");
    assert.equal(response.status, 200);
    assert.deepEqual(response.json.governorates.map((g: any) => g.enName), ["Ahmadi"]);
    assert.deepEqual(response.json.governorates[0].areas.map((a: any) => a.enName), ["Fahaheel"]);
    assert.equal(response.json.governorates[0].areas[0].fee, undefined);
  });
});

test("checkout charges the area fee, saves it and the Arabic area names on the order", async () => {
  const ids = await getBaselineIds();
  const { fahaheelId } = await seedDelivery();
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: jsonHeaders(),
      body: checkoutBody(fahaheelId, [{ type: "product", variantId: ids.firstVariantId, qty: 2 }])
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    const [order] = await db.select().from(orders).where(eq(orders.id, response.json.id));
    assert.equal(order?.governorate, "الأحمدي");
    assert.equal(order?.cityArea, "الفحيحيل");
    assert.equal(order?.areaId, fahaheelId);
    assert.equal(Number(order?.deliveryFee), 1.5);
    assert.equal(Number(order?.totalAmount), 71.5);
  });
});

test("checkout rejects unknown, inactive, and hidden-governorate areas", async () => {
  const ids = await getBaselineIds();
  const { closedAreaId, jahraAreaId } = await seedDelivery();
  await withTestServer(app, async (request) => {
    for (const areaId of [closedAreaId, jahraAreaId, 999_999]) {
      const response = await request("/api/v1/checkout", {
        method: "POST",
        headers: jsonHeaders(),
        body: checkoutBody(areaId, [{ type: "product", variantId: ids.firstVariantId, qty: 1 }])
      });
      assert.equal(response.status, 400, `area ${areaId}`);
      assert.match(response.json.message, /delivery area/i);
    }
  });
});

test("a product's own delivery fee replaces the area fee; mixed carts add both", async () => {
  const ids = await getBaselineIds();
  const { fahaheelId } = await seedDelivery();
  await db.update(products).set({ deliveryFee: "0.750" }).where(eq(products.id, ids.productTwoId));
  await withTestServer(app, async (request) => {
    const quote = async (items: unknown[]) => (await request("/api/v1/checkout/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ areaId: fahaheelId, items })
    })).json;

    assert.deepEqual(await quote([{ type: "product", variantId: ids.secondVariantId, qty: 3 }]), { subtotal: 165, deliveryFee: 0.75, total: 165.75 });
    assert.deepEqual(await quote([
      { type: "product", variantId: ids.firstVariantId, qty: 1 },
      { type: "product", variantId: ids.secondVariantId, qty: 1 }
    ]), { subtotal: 90, deliveryFee: 2.25, total: 92.25 });
    assert.deepEqual(await quote([{ type: "offer", offerId: ids.offerId, qty: 1 }]), { subtotal: 70, deliveryFee: 1.5, total: 71.5 });
  });
});

test("checkout refuses an order whose expected total (in fils) no longer matches", async () => {
  const ids = await getBaselineIds();
  const { fahaheelId } = await seedDelivery();
  await withTestServer(app, async (request) => {
    const items = [{ type: "product", variantId: ids.firstVariantId, qty: 1 }];
    const stale = await request("/api/v1/checkout", { method: "POST", headers: jsonHeaders(), body: checkoutBody(fahaheelId, items, { expectedAmountFils: 35_000 }) });
    assert.equal(stale.status, 409);
    const fresh = await request("/api/v1/checkout", { method: "POST", headers: jsonHeaders(), body: checkoutBody(fahaheelId, items, { expectedAmountFils: 36_500 }) });
    assert.equal(fresh.status, 201);
  });
});

test("prices keep fils end to end", async () => {
  const ids = await getBaselineIds();
  const { fahaheelId } = await seedDelivery();
  await db.update(productVariants).set({ sellingPrice: "1.125" }).where(eq(productVariants.id, ids.firstVariantId));
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: jsonHeaders(),
      body: checkoutBody(fahaheelId, [{ type: "product", variantId: ids.firstVariantId, qty: 3 }], { expectedAmountFils: 4_875 })
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    const [order] = await db.select().from(orders).where(eq(orders.id, response.json.id));
    assert.equal(Number(order?.totalAmount), 4.875);
  });
});

test("ERP reads and saves the whole delivery setup, keeping ids and list order", async () => {
  await seedDelivery();
  await withTestServer(app, async (request) => {
    const headers = { ...(await getAdminAuthHeaders(request)), "content-type": "application/json" };
    const before = await request("/api/erp/delivery", { headers });
    assert.equal(before.status, 200);
    const ahmadi = before.json.governorates.find((g: any) => g.enName === "Ahmadi");
    assert.deepEqual(ahmadi.areas.map((a: any) => [a.enName, a.fee, a.status]), [["Fahaheel", 1.5, "active"], ["Mangaf", 1, "inactive"]]);

    const saved = await request("/api/erp/delivery", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        governorates: [
          { arName: "حولي الجديدة", enName: "New Hawalli", status: "active", areas: [{ arName: "الجابرية", enName: "Jabriya", fee: 2.125, status: "active" }] },
          { id: ahmadi.id, arName: "الأحمدي", enName: "Ahmadi", status: "active", areas: [{ ...ahmadi.areas[0], fee: 2 }] }
        ]
      })
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.json));
    const after = (await request("/api/erp/delivery", { headers })).json.governorates;
    assert.deepEqual(after.map((g: any) => g.enName), ["New Hawalli", "Ahmadi"]);
    assert.equal(after[1].id, ahmadi.id);
    assert.equal(after[1].areas[0].id, ahmadi.areas[0].id);
    assert.equal(after[1].areas[0].fee, 2);
    assert.equal(after[0].areas[0].fee, 2.125);
    assert.equal(after[1].areas.length, 1);
  });
});

test("ERP delivery save rejects duplicate names and more than 3 decimals", async () => {
  await withTestServer(app, async (request) => {
    const headers = { ...(await getAdminAuthHeaders(request)), "content-type": "application/json" };
    const area = { arName: "أ", enName: "A", fee: 1, status: "active" };
    const gov = (areas: unknown[]) => ({ arName: "م", enName: "G", status: "active", areas });
    for (const governorates of [[gov([area, { ...area }])], [gov([{ ...area, fee: 1.0005 }])], [gov([]), gov([])]]) {
      const response = await request("/api/erp/delivery", { method: "PUT", headers, body: JSON.stringify({ governorates }) });
      assert.equal(response.status, 400);
    }
  });
});

test("ERP delivery needs the delivery permissions", async () => {
  await withTestServer(app, async (request) => {
    const reader = await getStaffAuthHeaders(request, { permissionKeys: ["delivery.read"] });
    assert.equal((await request("/api/erp/delivery", { headers: reader })).status, 200);
    const write = await request("/api/erp/delivery", {
      method: "PUT",
      headers: { ...reader, "content-type": "application/json" },
      body: JSON.stringify({ governorates: [] })
    });
    assert.equal(write.status, 403);
    const stranger = await getStaffAuthHeaders(request, { permissionKeys: ["orders.read"] });
    assert.equal((await request("/api/erp/delivery", { headers: stranger })).status, 403);
  });
});
