import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminUsers } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
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
  process.env.ADMIN_EMAIL = "admin@capella.test";
  process.env.ADMIN_PASSWORD = "AdminPass123";
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
        email: "admin@capella.test",
        password: "AdminPass123"
      })
    });

    assert.equal(response.status, 200);
    assert.ok(response.json.accessToken);
    assert.equal(response.json.user.email, "admin@capella.test");
    assert.match(response.headers.get("set-cookie") ?? "", /capella_admin_refresh=/);
  });
});

test("erp protected routes reject x-admin-basic even when the old fallback flag is enabled", async () => {
  process.env.ALLOW_DEV_ADMIN_FALLBACK = "true";
  process.env.DEV_ADMIN_EMAIL = "admin@capella.eg";
  process.env.DEV_ADMIN_PASSWORD = "admin1234";

  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/products", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
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
        email: "admin@capella.test",
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
    assert.match(logoutResponse.headers.get("set-cookie") ?? "", /capella_admin_refresh=;/);

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
    email: "staff@capella.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: true
  });
  await updateAdminUserPermissions("staff@capella.test", ["orders.update_payment_status"]);

  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "staff@capella.test",
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
    assert.equal(refreshResponse.json.user.email, "staff@capella.test");
    assert.equal(refreshResponse.json.user.role, "staff");
    assert.deepEqual(refreshResponse.json.user.permissionKeys, ["orders.read", "orders.update_payment_status"]);
  });
});

test("erp auth refresh rejects deactivated staff sessions", async () => {
  await createTestAdminUser({
    name: "Staff User",
    email: "inactive-refresh@capella.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: true
  });

  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "inactive-refresh@capella.test",
        password: "StaffPass123"
      })
    });

    assert.equal(loginResponse.status, 200);
    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    await db
      .update(adminUsers)
      .set({ isActive: false })
      .where(eq(adminUsers.email, "inactive-refresh@capella.test"));

    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { cookie: refreshCookie }
    });

    assert.equal(refreshResponse.status, 401);
    assert.deepEqual(refreshResponse.json, { message: "Invalid refresh token" });
  });
});
