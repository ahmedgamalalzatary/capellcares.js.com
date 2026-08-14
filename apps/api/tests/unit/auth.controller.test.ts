import assert from "node:assert/strict";
import test from "node:test";

import * as authControllerModule from "../../src/modules/auth/auth.controller.js";

test("logout remains successful when session revocation rejects", async () => {
  const createLogoutController = (
    authControllerModule as typeof authControllerModule & {
      createLogoutController?: (revokeSession: (token: string) => Promise<void>) => typeof authControllerModule.logoutController;
    }
  ).createLogoutController;

  assert.equal(typeof createLogoutController, "function");
  if (!createLogoutController) return;

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

  await handler(req as never, response as never);

  assert.equal(response.statusCode, 204);
  assert.equal(response.sent, true);
  assert.equal(response.cookieCalls.length, 1);
  assert.equal(response.cookieCalls[0]?.[0], "capella_refresh");
  assert.equal(response.cookieCalls[0]?.[1], "");
});

test("mobile logout remains successful without setting a cookie when revocation rejects", async () => {
  const createLogoutController = (
    authControllerModule as typeof authControllerModule & {
      createLogoutController?: (revokeSession: (token: string) => Promise<void>) => typeof authControllerModule.logoutController;
    }
  ).createLogoutController;

  assert.equal(typeof createLogoutController, "function");
  if (!createLogoutController) return;

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

  await handler(req as never, response as never);

  assert.equal(response.statusCode, 204);
  assert.equal(response.sent, true);
  assert.equal(response.cookieCalls, 0);
});
