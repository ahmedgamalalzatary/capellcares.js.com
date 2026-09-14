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
  process.env.ADMIN_EMAIL = "admin@capella.test";
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
        email: "admin@capella.test",
        password: "AdminPass123"
      })
    });

    assert.equal(response.status, 200);
    assert.ok(response.json.accessToken);
    assert.equal("refreshToken" in response.json, false);
    assert.equal(response.json.user.email, "admin@capella.test");
    assert.match(response.headers.get("set-cookie") ?? "", /capella_admin_refresh=/);
  });
});

test("erp mobile login also returns the refresh token in the response body", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({
        email: "admin@capella.test",
        password: "AdminPass123"
      })
    });

    assert.equal(response.status, 200);
    assert.equal(typeof response.json.refreshToken, "string");
    assert.ok(response.json.refreshToken.length > 0);
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

test("erp browser origin cannot spoof mobile login to expose the refresh token", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3001",
        "x-client": "mobile"
      },
      body: JSON.stringify({
        email: "admin@capella.test",
        password: "AdminPass123"
      })
    });

    assert.equal(response.status, 200);
    assert.equal("refreshToken" in response.json, false);
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

test("erp mobile refresh accepts a header token and returns its rotated replacement", async () => {
  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({
        email: "admin@capella.test",
        password: "AdminPass123"
      })
    });
    const firstRefreshToken = loginResponse.json.refreshToken;
    assert.equal(typeof firstRefreshToken, "string");

    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": firstRefreshToken }
    });

    assert.equal(refreshResponse.status, 200);
    assert.equal(typeof refreshResponse.json.refreshToken, "string");
    assert.notEqual(refreshResponse.json.refreshToken, firstRefreshToken);
    assert.equal(refreshResponse.json.user.email, "admin@capella.test");

    const oldTokenResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": firstRefreshToken }
    });
    assert.equal(oldTokenResponse.status, 401);
  });
});

test("erp mobile refresh ignores cookies and requires its header or body token", async () => {
  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@capella.test",
        password: "AdminPass123"
      })
    });
    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: {
        cookie: refreshCookie,
        "x-client": "mobile",
        "x-refresh-token": "ignored-header-token"
      }
    });

    assert.equal(refreshResponse.status, 401);
    assert.equal("refreshToken" in refreshResponse.json, false);
    assert.equal(refreshResponse.headers.get("set-cookie"), null);
  });
});

test("erp mobile refresh accepts a refresh token in the request body", async () => {
  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({
        email: "admin@capella.test",
        password: "AdminPass123"
      })
    });

    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({ refreshToken: loginResponse.json.refreshToken })
    });

    assert.equal(refreshResponse.status, 200);
    assert.equal(typeof refreshResponse.json.refreshToken, "string");
  });
});

test("erp mobile refresh and logout ignore a real web cookie when a header session is present", async () => {
  await withTestServer(app, async (request) => {
    const credentials = JSON.stringify({
      email: "admin@capella.test",
      password: "AdminPass123"
    });
    const webLogin = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: credentials
    });
    const webCookie = webLogin.headers.get("set-cookie");
    assert.ok(webCookie);
    const mobileLogin = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: credentials
    });

    const firstMobileRefresh = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: {
        cookie: webCookie,
        "x-client": "mobile",
        "x-refresh-token": mobileLogin.json.refreshToken
      }
    });
    assert.equal(firstMobileRefresh.status, 200);
    assert.equal(firstMobileRefresh.headers.get("set-cookie"), null);
    const rotatedMobileToken = firstMobileRefresh.json.refreshToken;
    assert.equal(typeof rotatedMobileToken, "string");

    const secondMobileRefresh = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": rotatedMobileToken }
    });
    assert.equal(secondMobileRefresh.status, 200);
    const latestMobileToken = secondMobileRefresh.json.refreshToken;

    const mobileLogout = await request("/api/erp/auth/logout", {
      method: "POST",
      headers: { cookie: webCookie, "x-client": "mobile", "x-refresh-token": latestMobileToken }
    });
    assert.equal(mobileLogout.status, 204);
    assert.equal(mobileLogout.headers.get("set-cookie"), null);
    const revokedMobileRefresh = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": latestMobileToken }
    });
    assert.equal(revokedMobileRefresh.status, 401);

    const webRefresh = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { cookie: webCookie }
    });
    assert.equal(webRefresh.status, 200);
    assert.equal("refreshToken" in webRefresh.json, false);
  });
});

test("erp mobile logout revokes a refresh token supplied in the header", async () => {
  await withTestServer(app, async (request) => {
    const loginResponse = await request("/api/erp/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({
        email: "admin@capella.test",
        password: "AdminPass123"
      })
    });
    const refreshToken = loginResponse.json.refreshToken;

    const logoutResponse = await request("/api/erp/auth/logout", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": refreshToken }
    });
    assert.equal(logoutResponse.status, 204);

    const refreshResponse = await request("/api/erp/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": refreshToken }
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
    assert.equal("refreshToken" in refreshResponse.json, false);
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
