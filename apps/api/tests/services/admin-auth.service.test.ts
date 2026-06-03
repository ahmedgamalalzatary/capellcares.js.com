import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { updateAdminUserPermissions } from "../../src/services/erp-permissions.service.js";
import {
  loginAdmin,
  refreshAdminSession
} from "../../src/modules/admin/auth/admin-auth.service.js";
import { createTestAdminUser, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("loginAdmin returns admin access token for the server-configured admin", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@capella.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  const result = await loginAdmin(
    { email: "admin@capella.eg", password: "admin1234" },
    { env }
  );

  assert.equal(result.user.email, "admin@capella.eg");
  const payload = jwt.verify(result.accessToken, env.JWT_ACCESS_SECRET!) as {
    role?: string;
    type?: string;
  };
  assert.equal(payload.role, "admin");
  assert.equal(payload.type, "admin_access");
});

test("loginAdmin rejects invalid credentials", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@capella.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await assert.rejects(
    () => loginAdmin({ email: "wrong@capella.eg", password: "bad" }, { env }),
    /invalid/i
  );
});

test("loginAdmin rejects when admin credentials are not configured", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
  };

  await assert.rejects(
    () => loginAdmin({ email: "admin@capella.eg", password: "admin1234" }, { env }),
    /not configured/i
  );
});

test("refreshAdminSession resolves the ERP user linked to the refresh session", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_NAME: "Bootstrap Admin",
    ADMIN_EMAIL: "admin@capella.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await loginAdmin({ email: env.ADMIN_EMAIL!, password: env.ADMIN_PASSWORD! }, { env });

  const staffPassword = "staff1234";
  await createTestAdminUser({
    name: "Staff User",
    email: "staff@capella.eg",
    passwordHash: await bcrypt.hash(staffPassword, 10),
    role: "staff",
    isActive: true
  });

  const staffLogin = await loginAdmin(
    { email: "staff@capella.eg", password: staffPassword },
    { env }
  );

  const refreshed = await refreshAdminSession(staffLogin.refreshToken);

  assert.equal(refreshed.user.email, "staff@capella.eg");
  assert.equal(refreshed.user.role, "staff");
});

test("loginAdmin allows active staff through the ERP login endpoint", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@capella.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  const staffPassword = "staff1234";
  await createTestAdminUser({
    name: "Active Staff",
    email: "staff@capella.eg",
    passwordHash: await bcrypt.hash(staffPassword, 10),
    role: "staff",
    isActive: true
  });
  await updateAdminUserPermissions("staff@capella.eg", ["orders.update_payment_status"]);

  const result = await loginAdmin(
    { email: "staff@capella.eg", password: staffPassword },
    { env }
  );

  assert.equal(result.user.email, "staff@capella.eg");
  assert.equal(result.user.role, "staff");
  assert.deepEqual(result.user.permissionKeys, ["orders.read", "orders.update_payment_status"]);
});

test("loginAdmin rejects inactive staff", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@capella.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await createTestAdminUser({
    name: "Inactive Staff",
    email: "inactive-staff@capella.eg",
    passwordHash: await bcrypt.hash("staff1234", 10),
    role: "staff",
    isActive: false
  });

  await assert.rejects(
    () => loginAdmin({ email: "inactive-staff@capella.eg", password: "staff1234" }, { env }),
    /invalid/i
  );
});

test("refreshAdminSession returns effective permission keys for staff users", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_NAME: "Bootstrap Admin",
    ADMIN_EMAIL: "admin@capella.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await loginAdmin({ email: env.ADMIN_EMAIL!, password: env.ADMIN_PASSWORD! }, { env });

  const staffPassword = "staff1234";
  await createTestAdminUser({
    name: "Active Staff",
    email: "staff-permissions@capella.eg",
    passwordHash: await bcrypt.hash(staffPassword, 10),
    role: "staff",
    isActive: true
  });
  await updateAdminUserPermissions("staff-permissions@capella.eg", ["products.update"]);

  const loginResult = await loginAdmin(
    { email: "staff-permissions@capella.eg", password: staffPassword },
    { env }
  );

  const refreshed = await refreshAdminSession(loginResult.refreshToken);

  assert.deepEqual(refreshed.user.permissionKeys, ["products.read", "products.update"]);
});
