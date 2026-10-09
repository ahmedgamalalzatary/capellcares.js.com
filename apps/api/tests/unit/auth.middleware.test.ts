import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

import { authMiddleware, createAuthMiddleware, optionalAuthMiddleware } from "../../src/middlewares/auth.middleware.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

function createToken(payload: Omit<jwt.JwtPayload, "sub"> & { sub?: number | string; role?: string }, secret: string = ACCESS_SECRET) {
  return jwt.sign(payload, secret);
}

function createRequest(authorization?: string) {
  return {
    headers: authorization === undefined ? {} : { authorization }
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

test("authMiddleware returns 401 when no token is provided", async () => {
  const req = createRequest();
  const res = createResponse();
  let nextCalled = false;

  await authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("authMiddleware returns 401 when token is invalid", async () => {
  const req = createRequest("Bearer invalid-token");
  const res = createResponse();
  let nextCalled = false;

  await authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("authMiddleware assigns req.user and calls next for a valid token", async () => {
  const token = createToken({ sub: 42, role: "customer" });
  const req = createRequest(`Bearer ${token}`) as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  await authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.deepEqual(req.user, { id: 42, role: "customer" });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("authMiddleware rejects admin access tokens on customer routes", async () => {
  const token = createToken({ sub: 1, role: "admin", type: "admin_access" });
  const req = createRequest(`Bearer ${token}`);
  const res = createResponse();
  let nextCalled = false;

  await authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("authMiddleware rejects staff access tokens on customer routes", async () => {
  const token = createToken({ sub: 1, role: "staff", type: "admin_access" });
  const req = createRequest(`Bearer ${token}`);
  const res = createResponse();
  let nextCalled = false;

  await authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("optionalAuthMiddleware rejects an explicitly supplied admin token", async () => {
  const token = createToken({ sub: 1, role: "admin", type: "admin_access" });
  const req = createRequest(`Bearer ${token}`) as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  await optionalAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(req.user, undefined);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("authMiddleware rejects non-integer subject values", async () => {
  const token = createToken({ sub: 42.5, role: "customer" });
  const req = createRequest(`Bearer ${token}`);
  const res = createResponse();
  let nextCalled = false;

  await authMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("optionalAuthMiddleware assigns req.user and calls next for a valid token", async () => {
  const token = createToken({ sub: "42", role: "customer" });
  const req = createRequest(`Bearer ${token}`) as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  await optionalAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.deepEqual(req.user, { id: 42, role: "customer" });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("optionalAuthMiddleware rejects an explicitly supplied invalid token", async () => {
  const req = createRequest("Bearer invalid-token") as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  await optionalAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(req.user, undefined);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("optionalAuthMiddleware allows a request with no authorization header", async () => {
  const req = createRequest() as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  await optionalAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(req.user, undefined);
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("optionalAuthMiddleware rejects an empty authorization header", async () => {
  const req = createRequest("");
  const res = createResponse();
  let nextCalled = false;

  await optionalAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("optionalAuthMiddleware rejects a whitespace-only authorization header", async () => {
  const req = createRequest("   ");
  const res = createResponse();
  let nextCalled = false;

  await optionalAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
  assert.equal(nextCalled, false);
});

test("authMiddleware returns 503 (not 401) when the session lookup fails", async () => {
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  const middleware = createAuthMiddleware(async () => {
    throw new Error("database unavailable");
  });
  const token = createToken({ sub: 42, role: "customer", sid: 7 });
  const req = createRequest(`Bearer ${token}`);
  const res = createResponse();
  let nextCalled = false;

  try {
    await middleware(req as never, res as never, () => {
      nextCalled = true;
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(res.statusCode, 503);
  assert.equal(nextCalled, false);
  assert.equal(errors.length, 1);
});

test("authMiddleware rejects a token whose session belongs to another subject", async () => {
  const middleware = createAuthMiddleware(async () => ({ id: 99, accountType: "customer", customerId: 99 }));
  const token = createToken({ sub: 42, role: "customer", sid: 7 });
  const req = createRequest(`Bearer ${token}`);
  const res = createResponse();
  let nextCalled = false;

  await middleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("authMiddleware accepts a token whose active session matches its subject", async () => {
  const middleware = createAuthMiddleware(async () => ({ id: 7, accountType: "customer", customerId: 42 }));
  const token = createToken({ sub: 42, role: "customer", sid: 7 });
  const req = createRequest(`Bearer ${token}`) as { headers: { authorization?: string }; user?: { id: number; role: string } };
  const res = createResponse();
  let nextCalled = false;

  await middleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.deepEqual(req.user, { id: 42, role: "customer" });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});
