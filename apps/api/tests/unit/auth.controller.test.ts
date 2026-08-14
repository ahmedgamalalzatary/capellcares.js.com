import assert from "node:assert/strict";
import test from "node:test";

import * as authControllerModule from "../../src/modules/auth/auth.controller.js";
import * as adminAuthControllerModule from "../../src/modules/admin/auth/admin-auth.controller.js";

test("logout remains successful when session revocation rejects", async () => {
  const { createLogoutController } = authControllerModule;

  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  const handler = createLogoutController(async () => {
    throw new Error("database unavailable");
  });
  const req = {
    headers: {},
    cookies: { capella_refresh: "refresh-token" },
    body: {},
    get() {
      return undefined;
    }
  };
  const response = {
    statusCode: 200,
    cookieCalls: [] as unknown[][],
    sent: false,
    cookie(...args: unknown[]) {
      response.cookieCalls.push(args);
      return response;
    },
    status(statusCode: number) {
      response.statusCode = statusCode;
      return response;
    },
    send() {
      response.sent = true;
      return response;
    }
  };

  try {
    await handler(req as never, response as never);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(response.statusCode, 204);
  assert.equal(response.sent, true);
  assert.equal(response.cookieCalls.length, 1);
  assert.equal(response.cookieCalls[0]?.[0], "capella_refresh");
  assert.equal(response.cookieCalls[0]?.[1], "");
  assert.match(String(warnings[0]?.[0]), /revoke customer session/i);
  assert.equal(String(warnings[0]?.[1]).includes("refresh-token"), false);
});

test("admin logout remains successful and observable when session revocation rejects", async () => {
  const { createAdminLogoutController } = adminAuthControllerModule;

  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  const handler = createAdminLogoutController(async () => {
    throw new Error("database unavailable");
  });
  const req = {
    headers: {},
    cookies: { capella_admin_refresh: "admin-refresh-token" },
    body: {},
    get() { return undefined; }
  };
  const response = {
    statusCode: 200,
    cookieCalls: [] as unknown[][],
    cookie(...args: unknown[]) { response.cookieCalls.push(args); return response; },
    status(statusCode: number) { response.statusCode = statusCode; return response; },
    send() { return response; }
  };

  try {
    await handler(req as never, response as never);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(response.statusCode, 204);
  assert.equal(response.cookieCalls[0]?.[0], "capella_admin_refresh");
  assert.match(String(warnings[0]?.[0]), /revoke admin session/i);
  assert.equal(String(warnings[0]?.[1]).includes("admin-refresh-token"), false);
});

test("mobile logout remains successful without setting a cookie when revocation rejects", async () => {
  const { createLogoutController } = authControllerModule;

  const handler = createLogoutController(async () => {
    throw new Error("database unavailable");
  });
  const req = {
    headers: { "x-client": "mobile", "x-refresh-token": "refresh-token" },
    cookies: {},
    body: {},
    get(name: string) {
      return req.headers[name.toLowerCase() as keyof typeof req.headers];
    }
  };
  const response = {
    statusCode: 200,
    cookieCalls: 0,
    sent: false,
    cookie() {
      response.cookieCalls += 1;
      return response;
    },
    status(statusCode: number) {
      response.statusCode = statusCode;
      return response;
    },
    send() {
      response.sent = true;
      return response;
    }
  };

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await handler(req as never, response as never);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(response.statusCode, 204);
  assert.equal(response.sent, true);
  assert.equal(response.cookieCalls, 0);
});
