import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

import { authMiddleware, optionalAuthMiddleware } from "../../src/middlewares/auth.middleware.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

function createToken(payload: Omit<jwt.JwtPayload, "sub"> & { sub?: number | string; role?: string }, secret: string = ACCESS_SECRET) {
  return jwt.sign(payload, secret);
}

function createRequest(authorization?: string) {
  return {
    headers: authorization ? { authorization } : {}
  };
}

function createResponse() {
  const response = {
    statusCode: 200,
    jsonBody: undefined as unknown,
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

test("authMiddleware returns 401 when no token is provided", () => {
  const req = createRequest();
  const res = createResponse();
  let nextCalled = false;

  authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("authMiddleware returns 401 when token is invalid", () => {
  const req = createRequest("Bearer invalid-token");
  const res = createResponse();
  let nextCalled = false;

  authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("authMiddleware assigns req.user and calls next for a valid token", () => {
  const token = createToken({ sub: 42, role: "customer" });
  const req = createRequest(`Bearer ${token}`) as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.deepEqual(req.user, { id: 42, role: "customer" });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("authMiddleware rejects non-integer subject values", () => {
  const token = createToken({ sub: 42.5, role: "customer" });
  const req = createRequest(`Bearer ${token}`);
  const res = createResponse();
  let nextCalled = false;

  authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("optionalAuthMiddleware assigns req.user and calls next for a valid token", () => {
  const token = createToken({ sub: "42", role: "customer" });
  const req = createRequest(`Bearer ${token}`) as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  optionalAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.deepEqual(req.user, { id: 42, role: "customer" });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("optionalAuthMiddleware leaves req.user unset when token is invalid", () => {
  const req = createRequest("Bearer invalid-token") as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  optionalAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(req.user, undefined);
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});
