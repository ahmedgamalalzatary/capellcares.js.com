import assert from "node:assert/strict";
import test from "node:test";

import { createLogoutController } from "../../src/modules/auth/auth.controller.js";
import { createAdminLogoutController } from "../../src/modules/admin/auth/admin-auth.controller.js";

function createResponse() {
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
  return response;
}

test("customer logout remains successful when session revocation rejects", async () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  const handler = createLogoutController(async () => {
    throw new Error("database unavailable");
  });
  const req = { cookies: { capella_refresh: "refresh-token" } };
  const response = createResponse();

  try {
    await handler(req as never, response as never);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(response.statusCode, 204);
  assert.equal(response.sent, true);
  assert.deepEqual(response.cookieCalls[0]?.slice(0, 2), ["capella_refresh", ""]);
  assert.match(String(warnings[0]?.[0]), /revoke customer session/i);
  assert.equal(String(warnings[0]?.[1]).includes("refresh-token"), false);
});

test("admin logout remains successful when session revocation rejects", async () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  const handler = createAdminLogoutController(async () => {
    throw new Error("database unavailable");
  });
  const req = { cookies: { capella_admin_refresh: "admin-refresh-token" } };
  const response = createResponse();

  try {
    await handler(req as never, response as never);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(response.statusCode, 204);
  assert.equal(response.sent, true);
  assert.deepEqual(response.cookieCalls[0]?.slice(0, 2), ["capella_admin_refresh", ""]);
  assert.match(String(warnings[0]?.[0]), /revoke admin session/i);
  assert.equal(String(warnings[0]?.[1]).includes("admin-refresh-token"), false);
});
