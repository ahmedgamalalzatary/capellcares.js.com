import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import { db } from "@minikoshk/database/src/db";
import { orders } from "@minikoshk/database/drizzle/schema";
import { app } from "../../src/app.js";
import { syncPermissionCatalog, updateAdminUserPermissions } from "../../src/services/erp-permissions.service.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("admin bypass still succeeds on protected ERP routes", async () => {
  await syncPermissionCatalog();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      headers: authHeaders
    });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.json.items));
  });
});

test("staff without permission receives 403 on a protected ERP route", async () => {
  await syncPermissionCatalog();

  await withTestServer(app, async (request) => {
    const authHeaders = await getStaffAuthHeaders(request);
    const response = await request("/api/erp/products", {
      headers: authHeaders
    });

    assert.equal(response.status, 403);
    assert.deepEqual(response.json, { message: "Forbidden" });
  });
});

test("staff with the correct permission succeeds on the matching route", async () => {
  await syncPermissionCatalog();

  await withTestServer(app, async (request) => {
    const auth = await getStaffAuthHeaders(request);
    await updateAdminUserPermissions(auth.user.email, ["products.read"]);

    const response = await request("/api/erp/products", {
      headers: { authorization: auth.authorization }
    });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.json.items));
  });
});

test("orders.update_payment_status is enforced separately from orders.read", async () => {
  await syncPermissionCatalog();
  const ids = await getBaselineIds();

  const [created] = await db.insert(orders).values({
    orderCode: "AUTHZ-001",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@minikoshk.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "pending",
    totalAmount: "150.00"
  }).$returningId();

  await withTestServer(app, async (request) => {
    const auth = await getStaffAuthHeaders(request, {
      email: "orders-staff@minikoshk.test"
    });
    await updateAdminUserPermissions(auth.user.email, ["orders.read"]);

    const listResponse = await request("/api/erp/orders", {
      headers: { authorization: auth.authorization }
    });
    assert.equal(listResponse.status, 200);

    const updateResponse = await request(`/api/erp/orders/${created.id}/payment-status`, {
      method: "POST",
      headers: {
        authorization: auth.authorization,
        "content-type": "application/json"
      },
      body: JSON.stringify({ paymentStatus: "accepted" })
    });

    assert.equal(updateResponse.status, 403);

    await updateAdminUserPermissions(auth.user.email, ["orders.update_payment_status"]);

    const secondUpdateResponse = await request(`/api/erp/orders/${created.id}/payment-status`, {
      method: "POST",
      headers: {
        authorization: auth.authorization,
        "content-type": "application/json"
      },
      body: JSON.stringify({ paymentStatus: "accepted" })
    });

    assert.equal(secondUpdateResponse.status, 200);
    assert.equal(secondUpdateResponse.json.ok, true);
  });

  const [updated] = await db
    .select({ paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(eq(orders.id, created.id))
    .limit(1);

  assert.equal(updated?.paymentStatus, "accepted");
});

test("uploads are denied unless the request comes from an authorized edit-capable flow", async () => {
  await syncPermissionCatalog();

  await withTestServer(app, async (request) => {
    const auth = await getStaffAuthHeaders(request, {
      email: "uploads-staff@minikoshk.test"
    });
    await updateAdminUserPermissions(auth.user.email, ["products.read"]);

    const forbiddenUpload = await request("/api/erp/uploads", {
      method: "POST",
      headers: {
        authorization: auth.authorization,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        fileName: "cream.png",
        mimeType: "image/png",
        contentBase64: Buffer.from("hello").toString("base64")
      })
    });

    assert.equal(forbiddenUpload.status, 403);

    await updateAdminUserPermissions(auth.user.email, ["products.update"]);

    const allowedUpload = await request("/api/erp/uploads", {
      method: "POST",
      headers: {
        authorization: auth.authorization,
        "content-type": "application/json",
        "x-minikoshk-upload-context": "products.update"
      },
      body: JSON.stringify({
        fileName: "cream.png",
        mimeType: "image/png",
        contentBase64: Buffer.from("hello").toString("base64")
      })
    });

    assert.equal(allowedUpload.status, 201);
    assert.ok(allowedUpload.json.path);
  });
});
