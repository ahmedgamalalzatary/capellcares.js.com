import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminUserPermissions, adminUsers, permissions } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { resetApiTestDatabase, createTestAdminUser } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { syncPermissionCatalog } from "../../src/services/erp-permissions.service.js";

beforeEach(async () => {
  await resetApiTestDatabase();
  await syncPermissionCatalog();
});

test("admin can list staff users", async () => {
  const activeStaffId = await createTestAdminUser({
    name: "Active Staff",
    email: "active-staff@capella.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: true
  });
  const inactiveStaffId = await createTestAdminUser({
    name: "Inactive Staff",
    email: "inactive-staff@capella.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: false
  });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/staff", {
      headers: authHeaders
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.items.length, 2);
    assert.deepEqual(
      response.json.items.map((item: { id: number; email: string; isActive: boolean }) => ({
        id: item.id,
        email: item.email,
        isActive: item.isActive
      })).sort((a: { email: string }, b: { email: string }) => a.email.localeCompare(b.email)),
      [
        { id: activeStaffId, email: "active-staff@capella.test", isActive: true },
        { id: inactiveStaffId, email: "inactive-staff@capella.test", isActive: false }
      ]
    );
  });
});

test("admin can create active staff with explicit permissions", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/staff", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Orders Staff",
        email: "orders-staff@capella.test",
        password: "StaffPass123",
        isActive: true,
        permissionKeys: ["orders.update_payment_status"]
      })
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.item.email, "orders-staff@capella.test");
    assert.equal(response.json.item.role, "staff");
    assert.equal(response.json.item.isActive, true);
    assert.deepEqual(response.json.item.permissionKeys, ["orders.read", "orders.update_payment_status"]);
  });
});

test("admin staff create returns 400 for invalid payload instead of crashing", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/staff", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: "invalid-staff@capella.test",
        password: "StaffPass123",
        isActive: true,
        permissionKeys: []
      })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.json, { error: "Staff name is required" });
  });
});

test("admin staff create returns 409 for duplicate email without mutating permissions", async () => {
  const existingStaffId = await createTestAdminUser({
    name: "Existing Staff",
    email: "duplicate-staff@capella.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: true
  });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/staff", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Staff",
        email: "duplicate-staff@capella.test",
        password: "StaffPass123",
        isActive: true,
        permissionKeys: ["orders.update_payment_status"]
      })
    });

    assert.equal(response.status, 409);
    assert.deepEqual(response.json, { error: "Staff email already exists" });
  });

  const allStaffUsers = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.role, "staff"));

  assert.deepEqual(allStaffUsers, [{ id: existingStaffId, email: "duplicate-staff@capella.test" }]);

  const assignedPermissions = await db
    .select({ permissionId: adminUserPermissions.permissionId })
    .from(adminUserPermissions)
    .where(eq(adminUserPermissions.adminUserId, existingStaffId));

  assert.deepEqual(assignedPermissions, []);
});

test("admin can edit staff without replacing password when password is blank", async () => {
  const staffId = await createTestAdminUser({
    name: "Editable Staff",
    email: "editable-staff@capella.test",
    passwordHash: await bcrypt.hash("KeepThisPass123", 10),
    role: "staff",
    isActive: true
  });

  const [beforeUpdate] = await db
    .select({ passwordHash: adminUsers.passwordHash })
    .from(adminUsers)
    .where(eq(adminUsers.id, staffId))
    .limit(1);

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/staff/${staffId}`, {
      method: "PUT",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Edited Staff",
        email: "edited-staff@capella.test",
        password: "",
        isActive: true,
        permissionKeys: ["products.update"]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.item.email, "edited-staff@capella.test");
    assert.deepEqual(response.json.item.permissionKeys, ["products.read", "products.update"]);
  });

  const [afterUpdate] = await db
    .select({ passwordHash: adminUsers.passwordHash, email: adminUsers.email, name: adminUsers.name })
    .from(adminUsers)
    .where(eq(adminUsers.id, staffId))
    .limit(1);

  assert.equal(afterUpdate?.name, "Edited Staff");
  assert.equal(afterUpdate?.email, "edited-staff@capella.test");
  assert.equal(afterUpdate?.passwordHash, beforeUpdate?.passwordHash);
});

test("admin can deactivate a staff user", async () => {
  const staffId = await createTestAdminUser({
    name: "Deactivate Staff",
    email: "deactivate-staff@capella.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: true
  });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/staff/${staffId}`, {
      method: "PUT",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Deactivate Staff",
        email: "deactivate-staff@capella.test",
        password: "",
        isActive: false,
        permissionKeys: []
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.item.isActive, false);
  });
});

test("deactivated staff immediately lose access on the next protected request", async () => {
  await withTestServer(app, async (request) => {
    const staffAuth = await getStaffAuthHeaders(request, {
      email: "protected-staff@capella.test",
      isActive: true
    });
    const adminAuth = await getAdminAuthHeaders(request);

    const [staffUser] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, "protected-staff@capella.test"))
      .limit(1);

    assert.ok(staffUser);

    const deactivateResponse = await request(`/api/erp/staff/${staffUser.id}`, {
      method: "PUT",
      headers: { ...adminAuth, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Protected Staff",
        email: "protected-staff@capella.test",
        password: "",
        isActive: false,
        permissionKeys: ["products.read"]
      })
    });

    assert.equal(deactivateResponse.status, 200);

    const protectedResponse = await request("/api/erp/products", {
      headers: { authorization: staffAuth.authorization }
    });

    assert.equal(protectedResponse.status, 401);
    assert.deepEqual(protectedResponse.json, { message: "Invalid admin token" });
  });
});

test("staff users cannot access staff-management endpoints", async () => {
  await withTestServer(app, async (request) => {
    const staffAuth = await getStaffAuthHeaders(request);
    const response = await request("/api/erp/staff", {
      headers: { authorization: staffAuth.authorization }
    });

    assert.equal(response.status, 403);
    assert.deepEqual(response.json, { message: "Forbidden" });
  });
});

test("admin cannot mutate the bootstrap admin through staff-management flows", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const bootstrapAdminEmail = process.env.ADMIN_EMAIL;

    const [bootstrapAdmin] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, bootstrapAdminEmail ?? ""))
      .limit(1);

    assert.ok(bootstrapAdmin);

    const response = await request(`/api/erp/staff/${bootstrapAdmin.id}`, {
      method: "PUT",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Mutated Admin",
        email: "mutated-admin@capella.test",
        password: "NewAdminPass123",
        isActive: false,
        permissionKeys: []
      })
    });

    assert.equal(response.status, 404);
  });
});

test("permission dependencies are normalized when saving staff assignments", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/staff", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Products Staff",
        email: "products-staff@capella.test",
        password: "StaffPass123",
        isActive: true,
        permissionKeys: ["products.restore"]
      })
    });

    assert.equal(createResponse.status, 201);

    const [staffUser] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, "products-staff@capella.test"))
      .limit(1);

    assert.ok(staffUser);

    const savedPermissions = await db
      .select({ key: permissions.key })
      .from(adminUserPermissions)
      .innerJoin(permissions, eq(permissions.id, adminUserPermissions.permissionId))
      .where(eq(adminUserPermissions.adminUserId, staffUser.id));

    assert.deepEqual(
      savedPermissions.map((row) => row.key).sort(),
      ["products.read", "products.restore", "trash.read"]
    );
  });
});

test("admin can read the permission catalog for assignment UI", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/staff/permissions", {
      headers: authHeaders
    });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.json.items));
    assert.ok(
      response.json.items.some(
        (item: { key: string; dependencies?: string[] }) =>
          item.key === "orders.update_payment_status" &&
          Array.isArray(item.dependencies) &&
          item.dependencies.includes("orders.read")
      )
    );
  });
});
