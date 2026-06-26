import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { updateAdminUserPermissions } from "../../src/services/erp-permissions.service.js";
import {
  ensureBootstrapAdmin,
  loginAdmin,
  refreshAdminSession
} from "../../src/modules/admin/auth/admin-auth.service.js";
import { findAdminUserByEmail } from "../../src/repositories/admin-user.repository.js";
import { createTestAdminUser, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("ensureBootstrapAdmin creates the admin from env when none exists", async () => {
  const env: NodeJS.ProcessEnv = {
    ADMIN_EMAIL: "admin@minikoshk.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await ensureBootstrapAdmin(env);

  const admin = await findAdminUserByEmail("admin@minikoshk.eg");
  assert.ok(admin, "admin should be created from env");
  assert.equal(admin?.role, "admin");
});

test("ensureBootstrapAdmin reconciles an existing admin to env (env is source of truth)", async () => {
  await ensureBootstrapAdmin({ ADMIN_EMAIL: "old@minikoshk.eg", ADMIN_PASSWORD: "admin1234" });
  await ensureBootstrapAdmin({ ADMIN_EMAIL: "new@minikoshk.eg", ADMIN_PASSWORD: "admin1234" });

  assert.ok(await findAdminUserByEmail("new@minikoshk.eg"), "admin should follow env email");
  assert.equal(await findAdminUserByEmail("old@minikoshk.eg"), null);
});

test("loginAdmin does not mutate the admin account when env differs", async () => {
  await ensureBootstrapAdmin({ ADMIN_EMAIL: "admin@minikoshk.eg", ADMIN_PASSWORD: "admin1234" });

  // A login carrying a different env email must NOT rewrite the existing admin.
  await assert.rejects(
    loginAdmin(
      { email: "drifted@minikoshk.eg", password: "admin1234" },
      { env: { JWT_ACCESS_SECRET: "test-access-secret", ADMIN_EMAIL: "drifted@minikoshk.eg", ADMIN_PASSWORD: "admin1234" } }
    )
  );

  assert.ok(await findAdminUserByEmail("admin@minikoshk.eg"), "original admin must remain unchanged");
  assert.equal(await findAdminUserByEmail("drifted@minikoshk.eg"), null);
});

test("loginAdmin returns admin access token for the server-configured admin", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@minikoshk.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await ensureBootstrapAdmin(env);
  const result = await loginAdmin(
    { email: "admin@minikoshk.eg", password: "admin1234" },
    { env }
  );

  assert.equal(result.user.email, "admin@minikoshk.eg");
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
    ADMIN_EMAIL: "admin@minikoshk.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await assert.rejects(
    () => loginAdmin({ email: "wrong@minikoshk.eg", password: "bad" }, { env }),
    /invalid/i
  );
});

test("ensureBootstrapAdmin rejects when admin credentials are not configured", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
  };

  await assert.rejects(() => ensureBootstrapAdmin(env), /not configured/i);
});

test("refreshAdminSession resolves the ERP user linked to the refresh session", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_NAME: "Bootstrap Admin",
    ADMIN_EMAIL: "admin@minikoshk.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await ensureBootstrapAdmin(env);
  await loginAdmin({ email: env.ADMIN_EMAIL!, password: env.ADMIN_PASSWORD! }, { env });

  const staffPassword = "staff1234";
  await createTestAdminUser({
    name: "Staff User",
    email: "staff@minikoshk.eg",
    passwordHash: await bcrypt.hash(staffPassword, 10),
    role: "staff",
    isActive: true
  });

  const staffLogin = await loginAdmin(
    { email: "staff@minikoshk.eg", password: staffPassword },
    { env }
  );

  const refreshed = await refreshAdminSession(staffLogin.refreshToken);

  assert.equal(refreshed.user.email, "staff@minikoshk.eg");
  assert.equal(refreshed.user.role, "staff");
});

test("loginAdmin allows active staff through the ERP login endpoint", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@minikoshk.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  const staffPassword = "staff1234";
  await createTestAdminUser({
    name: "Active Staff",
    email: "staff@minikoshk.eg",
    passwordHash: await bcrypt.hash(staffPassword, 10),
    role: "staff",
    isActive: true
  });
  await updateAdminUserPermissions("staff@minikoshk.eg", ["orders.update_payment_status"]);

  const result = await loginAdmin(
    { email: "staff@minikoshk.eg", password: staffPassword },
    { env }
  );

  assert.equal(result.user.email, "staff@minikoshk.eg");
  assert.equal(result.user.role, "staff");
  assert.deepEqual(result.user.permissionKeys, ["orders.read", "orders.update_payment_status"]);
});

test("loginAdmin rejects inactive staff", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@minikoshk.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await createTestAdminUser({
    name: "Inactive Staff",
    email: "inactive-staff@minikoshk.eg",
    passwordHash: await bcrypt.hash("staff1234", 10),
    role: "staff",
    isActive: false
  });

  await assert.rejects(
    () => loginAdmin({ email: "inactive-staff@minikoshk.eg", password: "staff1234" }, { env }),
    /invalid/i
  );
});

test("refreshAdminSession returns effective permission keys for staff users", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_NAME: "Bootstrap Admin",
    ADMIN_EMAIL: "admin@minikoshk.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await ensureBootstrapAdmin(env);
  await loginAdmin({ email: env.ADMIN_EMAIL!, password: env.ADMIN_PASSWORD! }, { env });

  const staffPassword = "staff1234";
  await createTestAdminUser({
    name: "Active Staff",
    email: "staff-permissions@minikoshk.eg",
    passwordHash: await bcrypt.hash(staffPassword, 10),
    role: "staff",
    isActive: true
  });
  await updateAdminUserPermissions("staff-permissions@minikoshk.eg", ["products.update"]);

  const loginResult = await loginAdmin(
    { email: "staff-permissions@minikoshk.eg", password: staffPassword },
    { env }
  );

  const refreshed = await refreshAdminSession(loginResult.refreshToken);

  assert.deepEqual(refreshed.user.permissionKeys, ["products.read", "products.update"]);
});
