import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import bcrypt from "bcryptjs";

import { app } from "../../src/app.js";
import { deleteCustomerByEmail, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

const signupEmail = "route-auth-signup@minikoshk.test";
const loginEmail = "route-auth-login@minikoshk.test";
const password = "Password123!";

beforeEach(async () => {
  await resetApiTestDatabase();
});

afterEach(async () => {
  await deleteCustomerByEmail(signupEmail);
  await deleteCustomerByEmail(loginEmail);
});

test("signup route creates a customer and returns 201", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Route Signup", email: signupEmail, password })
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.user.email, signupEmail);
  });
});

test("login route returns an access token and refresh cookie", async () => {
  const passwordHash = await bcrypt.hash(password, 10);
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Route Login", email: loginEmail, password })
    });

    const response = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password })
    });

    assert.equal(response.status, 200);
    assert.ok(response.json.accessToken);
    assert.match(response.headers.get("set-cookie") ?? "", /capella_refresh=/);
    void passwordHash;
  });
});

test("refresh route issues a new access token when refresh cookie is present", async () => {
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Route Refresh", email: loginEmail, password })
    });

    const loginResponse = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password })
    });

    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    const refreshResponse = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: {
        cookie: refreshCookie
      }
    });

    assert.equal(refreshResponse.status, 200);
    assert.ok(refreshResponse.json.accessToken);
  });
});

test("refresh route rotates the refresh cookie and rejects the previous refresh token", async () => {
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Route Rotate", email: loginEmail, password })
    });

    const loginResponse = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password })
    });

    const firstCookie = loginResponse.headers.get("set-cookie");
    assert.ok(firstCookie);

    const refreshResponse = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { cookie: firstCookie }
    });

    assert.equal(refreshResponse.status, 200);
    const rotatedCookie = refreshResponse.headers.get("set-cookie");
    assert.ok(rotatedCookie);
    assert.notEqual(rotatedCookie, firstCookie);

    const oldCookieResponse = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { cookie: firstCookie }
    });

    assert.equal(oldCookieResponse.status, 401);
  });
});

test("logout route revokes the current refresh session and clears the refresh cookie", async () => {
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Route Logout", email: loginEmail, password })
    });

    const loginResponse = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password })
    });

    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    const logoutResponse = await request("/api/v1/auth/logout", {
      method: "POST",
      headers: { cookie: refreshCookie }
    });

    assert.equal(logoutResponse.status, 204);
    assert.match(logoutResponse.headers.get("set-cookie") ?? "", /capella_refresh=;/);

    const refreshResponse = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { cookie: refreshCookie }
    });

    assert.equal(refreshResponse.status, 401);
  });
});
