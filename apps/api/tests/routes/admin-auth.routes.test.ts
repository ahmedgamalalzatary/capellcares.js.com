import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminUsers } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { ensureBootstrapAdmin } from "../../src/modules/admin/auth/admin-auth.service.js";
import { updateAdminUserPermissions } from "../../src/services/erp-permissions.service.js";
import { createTestAdminUser, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

const previousEnv = {
  ALLOW_DEV_ADMIN_FALLBACK: process.env.ALLOW_DEV_ADMIN_FALLBACK,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  DEV_ADMIN_EMAIL: process.env.DEV_ADMIN_EMAIL,
  DEV_ADMIN_PASSWORD: process.env.DEV_ADMIN_PASSWORD
};

beforeEach(async () => {
  await resetApiTestDatabase();
  process.env.ALLOW_DEV_ADMIN_FALLBACK = "false";
  process.env.ADMIN_EMAIL = "admin@minikoshk.test";
  process.env.ADMIN_PASSWORD = "AdminPass123";
  await ensureBootstrapAdmin();
});

afterEach(() => {
  setEnv("ALLOW_DEV_ADMIN_FALLBACK", previousEnv.ALLOW_DEV_ADMIN_FALLBACK);
  setEnv("ADMIN_EMAIL", previousEnv.ADMIN_EMAIL);
  setEnv("ADMIN_PASSWORD", previousEnv.ADMIN_PASSWORD);
  setEnv("DEV_ADMIN_EMAIL", previousEnv.DEV_ADMIN_EMAIL);
  setEnv("DEV_ADMIN_PASSWORD", previousEnv.DEV_ADMIN_PASSWORD);
});

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

test("erp admin login uses the single server-configured admin account", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@minikoshk.test",
        password: "AdminPass123"
      })
    });

    assert.equal(response.status, 200);
    assert.ok(response.json.accessToken);
    assert.equal(response.json.user.email, "admin@minikoshk.test");
    assert.match(response.headers.get("set-cookie") ?? "", /minikoshk_admin_refresh=/);
  });
});

test("erp protected routes reject x-admin-basic even when the old fallback flag is enabled", async () => {
  process.env.ALLOW_DEV_ADMIN_FALLBACK = "true";
  process.env.DEV_ADMIN_EMAIL = "admin@minikoshk.eg";
  process.env.DEV_ADMIN_PASSWORD = "admin1234";

  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/products", {
      headers: { "x-admin-basic": "admin@minikoshk.eg:admin1234" }
    });

    assert.equal(response.status, 401);
  });
});

test("erp admin logout revokes the current refresh session", async () => {
  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@minikoshk.test",
        password: "AdminPass123"
      })
    });

    assert.equal(loginResponse.status, 200);
    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    const logoutResponse = await request("/api/erp/auth/logout", {
      method: "POST",
      headers: { cookie: refreshCookie }
    });

    assert.equal(logoutResponse.status, 204);
    const clearedCookies = logoutResponse.headers.get("set-cookie") ?? "";
    assert.match(clearedCookies, /minikoshk_admin_refresh=;/);
    assert.match(clearedCookies, /capella_admin_refresh=;/);

    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { cookie: refreshCookie }
    });

    assert.equal(refreshResponse.status, 401);
  });
});

test("erp auth refresh returns the staff user linked to the refresh session", async () => {
  await createTestAdminUser({
    name: "Staff User",
    email: "staff@minikoshk.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: true
  });
  await updateAdminUserPermissions("staff@minikoshk.test", ["orders.update_payment_status"]);

  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "staff@minikoshk.test",
        password: "StaffPass123"
      })
    });

    assert.equal(loginResponse.status, 200);
    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { cookie: refreshCookie }
    });

    assert.equal(refreshResponse.status, 200);
    assert.equal(refreshResponse.json.user.email, "staff@minikoshk.test");
    assert.equal(refreshResponse.json.user.role, "staff");
    assert.deepEqual(refreshResponse.json.user.permissionKeys, ["orders.read", "orders.update_payment_status"]);
  });
});

test("erp auth refresh accepts the legacy admin refresh cookie name during migration", async () => {
  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@minikoshk.test",
        password: "AdminPass123"
      })
    });

    assert.equal(loginResponse.status, 200);
    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    const legacyCookie = refreshCookie.replace("minikoshk_admin_refresh=", "capella_admin_refresh=");
    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { cookie: legacyCookie }
    });

    assert.equal(refreshResponse.status, 200);
    assert.match(refreshResponse.headers.get("set-cookie") ?? "", /minikoshk_admin_refresh=/);
  });
});

test("erp auth refresh rejects deactivated staff sessions", async () => {
  await createTestAdminUser({
    name: "Staff User",
    email: "inactive-refresh@minikoshk.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: true
  });

  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "inactive-refresh@minikoshk.test",
        password: "StaffPass123"
      })
    });

    assert.equal(loginResponse.status, 200);
    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    await db
      .update(adminUsers)
      .set({ isActive: false })
      .where(eq(adminUsers.email, "inactive-refresh@minikoshk.test"));

    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { cookie: refreshCookie }
    });

    assert.equal(refreshResponse.status, 401);
    assert.deepEqual(refreshResponse.json, { message: "Invalid refresh token" });
  });
});
