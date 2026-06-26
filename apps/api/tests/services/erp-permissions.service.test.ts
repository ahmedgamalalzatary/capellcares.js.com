import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import bcrypt from "bcryptjs";
import { db } from "@capella/database/src/db";
import {
  adminUserPermissions,
  permissions
} from "@capella/database/drizzle/schema";
import { createTestAdminUser, resetApiTestDatabase } from "../helpers/database.js";
import {
  getEffectiveAdminPermissions,
  normalizePermissionKeys,
  syncPermissionCatalog
} from "../../src/services/erp-permissions.service.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("syncPermissionCatalog creates the expected ERP permission catalog without speculative keys", async () => {
  await syncPermissionCatalog();

  const rows = await db.select({ key: permissions.key }).from(permissions);
  const keys = rows.map((row) => row.key).sort();

  assert.deepEqual(keys, [
    "advices.create",
    "advices.delete",
    "advices.read",
    "advices.toggle_status",
    "advices.update",
    "categories.create",
    "categories.read",
    "categories.restore",
    "categories.soft_delete",
    "categories.update",
    "collections.create",
    "collections.read",
    "collections.restore",
    "collections.soft_delete",
    "collections.toggle_status",
    "collections.update",
    "dashboard.read",
    "homepage_banners.read",
    "homepage_banners.update",
    "offers.create",
    "offers.read",
    "offers.restore",
    "offers.soft_delete",
    "offers.toggle_status",
    "offers.update",
    "orders.read",
    "orders.update_payment_status",
    "products.create",
    "products.permanent_delete",
    "products.read",
    "products.restore",
    "products.soft_delete",
    "products.stock_update",
    "products.toggle_status",
    "products.update",
    "sales.read",
    "trash.read"
  ]);
});

test("normalizePermissionKeys adds required read dependencies", () => {
  const normalized = normalizePermissionKeys([
    "products.update",
    "orders.update_payment_status",
    "trash.read",
    "products.update"
  ]);

  assert.deepEqual(normalized, [
    "orders.read",
    "orders.update_payment_status",
    "products.read",
    "products.update",
    "trash.read"
  ]);
});

test("getEffectiveAdminPermissions returns all permissions for admin and assigned normalized permissions for staff", async () => {
  await syncPermissionCatalog();

  const adminId = await createTestAdminUser({
    name: "Bootstrap Admin Mirror",
    email: "admin-permissions@capella.test",
    passwordHash: await bcrypt.hash("AdminPass123", 10),
    role: "admin",
    isActive: true
  });

  const staffId = await createTestAdminUser({
    name: "Staff User",
    email: "staff-permissions@capella.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: true
  });

  const assignedKeys = normalizePermissionKeys(["products.update", "orders.update_payment_status"]);
  const permissionRows = await db
    .select({ id: permissions.id, key: permissions.key })
    .from(permissions);

  await db.insert(adminUserPermissions).values(
    permissionRows
      .filter((permission) => assignedKeys.includes(permission.key))
      .map((permission) => ({
        adminUserId: staffId,
        permissionId: permission.id
      }))
  );

  const adminPermissionKeys = await getEffectiveAdminPermissions(adminId);
  const staffPermissionKeys = await getEffectiveAdminPermissions(staffId);

  assert.ok(adminPermissionKeys.includes("dashboard.read"));
  assert.ok(adminPermissionKeys.includes("products.permanent_delete"));
  assert.deepEqual(staffPermissionKeys, [
    "orders.read",
    "orders.update_payment_status",
    "products.read",
    "products.update"
  ]);
});
