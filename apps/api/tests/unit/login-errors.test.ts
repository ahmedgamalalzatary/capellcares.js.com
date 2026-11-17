import assert from "node:assert/strict";
import test from "node:test";

import { createLoginController } from "../../src/modules/auth/auth.controller.js";
import { createAdminLoginController } from "../../src/modules/admin/auth/admin-auth.controller.js";
import { InvalidCredentialsError } from "../../src/modules/auth/auth-errors.js";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(statusCode: number) {
      response.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
    cookie() {
      return response;
    }
  };
  return response;
}

const request = { body: { email: "a@b.co", password: "x" }, ip: "203.0.113.9", get: () => undefined } as any;

async function silenced<T>(run: () => Promise<T>) {
  const originals = { warn: console.warn, error: console.error };
  const logs: unknown[][] = [];
  console.warn = (...args: unknown[]) => logs.push(args);
  console.error = (...args: unknown[]) => logs.push(args);
  try {
    await run();
  } finally {
    console.warn = originals.warn;
    console.error = originals.error;
  }
  return logs;
}

test("customer login answers 401 for wrong credentials", async () => {
  const res = createResponse();
  await createLoginController(async () => { throw new InvalidCredentialsError(); })(request, res as any, () => {});
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: "Invalid credentials" });
});

test("customer login forwards unexpected failures instead of echoing their message", async () => {
  const res = createResponse();
  let forwarded: unknown;
  await createLoginController(async () => { throw new Error("ER_ACCESS_DENIED_ERROR: user 'capella'@'10.0.0.2'"); })(
    request, res as any, (error?: unknown) => { forwarded = error; }
  );
  assert.ok(forwarded instanceof Error);
  assert.equal(res.body, undefined);
});

test("admin login logs failed attempts with the source IP and answers 401", async () => {
  const res = createResponse();
  const logs = await silenced(() =>
    createAdminLoginController(async () => { throw new InvalidCredentialsError("Invalid admin credentials"); })(request, res as any, () => {})
  );
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: "Invalid admin credentials" });
  assert.ok(logs.some((line) => String(line[0]).includes("Failed admin login") && String(line[0]).includes("203.0.113.9")));
});

test("admin login forwards unexpected failures instead of echoing their message", async () => {
  const res = createResponse();
  let forwarded: unknown;
  await createAdminLoginController(async () => { throw new Error("connect ECONNREFUSED 10.0.0.2:3306"); })(
    request, res as any, (error?: unknown) => { forwarded = error; }
  );
  assert.ok(forwarded instanceof Error);
  assert.equal(res.body, undefined);
});
