import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import bcrypt from "bcryptjs";

import { app } from "../../src/app.js";
import { deleteCustomerByEmail, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

const signupEmail = "route-auth-signup@capella.test";
const loginEmail = "route-auth-login@capella.test";
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
    assert.equal("refreshToken" in response.json, false);
    assert.match(response.headers.get("set-cookie") ?? "", /capella_refresh=/);
    void passwordHash;
  });
});

test("mobile login also returns the refresh token in the response body", async () => {
  const email = "route-auth-mobile-login@capella.test";
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mobile Login", email, password })
    });

    const response = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({ email, password })
    });

    assert.equal(response.status, 200);
    assert.equal(typeof response.json.refreshToken, "string");
    assert.ok(response.json.refreshToken.length > 0);
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

test("browser origin cannot spoof mobile login to expose the refresh token", async () => {
  const email = "route-auth-browser-login@capella.test";
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Browser Login", email, password })
    });

    const response = await request("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-client": "mobile"
      },
      body: JSON.stringify({ email, password })
    });

    assert.equal(response.status, 200);
    assert.equal("refreshToken" in response.json, false);
    assert.match(response.headers.get("set-cookie") ?? "", /capella_refresh=/);
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
    assert.equal("refreshToken" in refreshResponse.json, false);
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

test("mobile refresh accepts a header token and returns its rotated replacement", async () => {
  const email = "route-auth-mobile-refresh@capella.test";
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mobile Refresh", email, password })
    });

    const loginResponse = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({ email, password })
    });
    const firstRefreshToken = loginResponse.json.refreshToken;
    assert.equal(typeof firstRefreshToken, "string");

    const refreshResponse = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": firstRefreshToken }
    });

    assert.equal(refreshResponse.status, 200);
    assert.ok(refreshResponse.json.accessToken);
    assert.equal(typeof refreshResponse.json.refreshToken, "string");
    assert.notEqual(refreshResponse.json.refreshToken, firstRefreshToken);

    const oldTokenResponse = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": firstRefreshToken }
    });
    assert.equal(oldTokenResponse.status, 401);
  });
});

test("mobile refresh ignores cookies and requires its header or body token", async () => {
  const email = "route-auth-mobile-cookie@capella.test";
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Cookie Protection", email, password })
    });
    const loginResponse = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const refreshCookie = loginResponse.headers.get("set-cookie");
    assert.ok(refreshCookie);

    const refreshResponse = await request("/api/v1/auth/refresh", {
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

test("mobile refresh accepts a refresh token in the request body", async () => {
  const email = "route-auth-mobile-body@capella.test";
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mobile Body Refresh", email, password })
    });

    const loginResponse = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({ email, password })
    });

    const refreshResponse = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({ refreshToken: loginResponse.json.refreshToken })
    });

    assert.equal(refreshResponse.status, 200);
    assert.equal(typeof refreshResponse.json.refreshToken, "string");
  });
});

test("mobile refresh and logout ignore a real web cookie when a header session is present", async () => {
  const email = "route-auth-mixed-sessions@capella.test";
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mixed Sessions", email, password })
    });
    const credentials = JSON.stringify({ email, password });
    const webLogin = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: credentials
    });
    const webCookie = webLogin.headers.get("set-cookie");
    assert.ok(webCookie);
    const mobileLogin = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: credentials
    });

    const firstMobileRefresh = await request("/api/v1/auth/refresh", {
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

    const secondMobileRefresh = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": rotatedMobileToken }
    });
    assert.equal(secondMobileRefresh.status, 200);
    const latestMobileToken = secondMobileRefresh.json.refreshToken;

    const mobileLogout = await request("/api/v1/auth/logout", {
      method: "POST",
      headers: { cookie: webCookie, "x-client": "mobile", "x-refresh-token": latestMobileToken }
    });
    assert.equal(mobileLogout.status, 204);
    assert.equal(mobileLogout.headers.get("set-cookie"), null);
    const revokedMobileRefresh = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": latestMobileToken }
    });
    assert.equal(revokedMobileRefresh.status, 401);

    const webRefresh = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { cookie: webCookie }
    });
    assert.equal(webRefresh.status, 200);
    assert.equal("refreshToken" in webRefresh.json, false);
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

test("mobile logout revokes a refresh token supplied in the header", async () => {
  const email = "route-auth-mobile-logout@capella.test";
  await withTestServer(app, async (request) => {
    await request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mobile Logout", email, password })
    });

    const loginResponse = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "mobile" },
      body: JSON.stringify({ email, password })
    });
    const refreshToken = loginResponse.json.refreshToken;

    const logoutResponse = await request("/api/v1/auth/logout", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": refreshToken }
    });
    assert.equal(logoutResponse.status, 204);

    const refreshResponse = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "x-client": "mobile", "x-refresh-token": refreshToken }
    });
    assert.equal(refreshResponse.status, 401);
  });
});
