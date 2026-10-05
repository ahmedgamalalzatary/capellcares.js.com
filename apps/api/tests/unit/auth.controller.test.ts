import assert from "node:assert/strict";
import test from "node:test";

import {
  createRefreshController,
  createLogoutController
} from "../../src/modules/auth/auth.controller.js";
import {
  createAdminRefreshController,
  createAdminLogoutController
} from "../../src/modules/admin/auth/admin-auth.controller.js";
import { RefreshTokenRejectedError } from "../../src/services/auth-session.service.js";

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

function createRequest(cookies: Record<string, string>, headers: Record<string, string> = {}) {
  return {
    cookies,
    get(name: string) {
      return headers[name.toLowerCase()];
    }
  };
}

test("customer logout remains successful when session revocation rejects", async () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  const handler = createLogoutController(async () => {
    throw new Error("database unavailable");
  });
  const req = createRequest({ capella_refresh: "refresh-token" });
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
  const req = createRequest({ capella_admin_refresh: "admin-refresh-token" });
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

function createJsonResponse() {
  const response = {
    statusCode: 200,
    jsonBody: undefined as unknown,
    cookieCalls: [] as unknown[][],
    cookie(...args: unknown[]) {
      response.cookieCalls.push(args);
      return response;
    },
    status(statusCode: number) {
      response.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      response.jsonBody = body;
      return response;
    }
  };
  return response;
}

function createMobileRequest(headers: Record<string, string>) {
  return {
    cookies: {},
    body: {},
    get(name: string) {
      return headers[name.toLowerCase()];
    }
  };
}

test("customer refresh returns 401 when the refresh token is genuinely rejected", async () => {
  const handler = createRefreshController(async () => {
    throw new RefreshTokenRejectedError();
  });
  const response = createJsonResponse();

  await handler(
    createMobileRequest({ "x-client": "mobile", "x-refresh-token": "token" }) as never,
    response as never
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.jsonBody, { message: "Invalid refresh token" });
});

test("customer refresh returns 500 for a transient failure so the session is not cleared", async () => {
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  const handler = createRefreshController(async () => {
    throw new Error("database unavailable");
  });
  const response = createJsonResponse();

  try {
    await handler(
      createMobileRequest({ "x-client": "mobile", "x-refresh-token": "token" }) as never,
      response as never
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(response.statusCode, 500);
  assert.equal(response.jsonBody !== undefined && "accessToken" in (response.jsonBody as object), false);
  assert.equal(errors.length, 1, "the transient failure should be logged for operators");
});

test("admin refresh returns 401 when the refresh token is genuinely rejected", async () => {
  const handler = createAdminRefreshController(async () => {
    throw new RefreshTokenRejectedError();
  });
  const response = createJsonResponse();

  await handler(
    createMobileRequest({ "x-client": "mobile", "x-refresh-token": "token" }) as never,
    response as never
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.jsonBody, { message: "Invalid refresh token" });
});

test("admin refresh returns 500 for a transient failure so the session is not cleared", async () => {
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  const handler = createAdminRefreshController(async () => {
    throw new Error("database unavailable");
  });
  const response = createJsonResponse();

  try {
    await handler(
      createMobileRequest({ "x-client": "mobile", "x-refresh-token": "token" }) as never,
      response as never
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(response.statusCode, 500);
  assert.equal(errors.length, 1, "the transient failure should be logged for operators");
});
