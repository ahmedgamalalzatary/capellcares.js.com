import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test, { beforeEach } from "node:test";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { adminAuthMiddleware } from "../../src/middlewares/admin-auth.middleware.js";
import { createTestAdminUser, resetApiTestDatabase } from "../helpers/database.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

function createToken(payload: Omit<jwt.JwtPayload, "sub"> & { sub?: number | string; role?: string; type?: string }) {
  return jwt.sign(payload, ACCESS_SECRET);
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

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("adminAuthMiddleware rejects staff tokens for inactive ERP users", async () => {
  const staffId = await createTestAdminUser({
    name: "Inactive Staff",
    email: "inactive-staff@minikoshk.test",
    passwordHash: await bcrypt.hash("StaffPass123", 10),
    role: "staff",
    isActive: false
  });

  const token = createToken({ sub: staffId, role: "staff", type: "admin_access" });
  const req = createRequest(`Bearer ${token}`);
  const res = createResponse();
  let nextCalled = false;

  await adminAuthMiddleware(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Invalid admin token" });
  assert.equal(nextCalled, false);
});

test("adminAuthMiddleware fails closed on import when JWT_ACCESS_SECRET is missing in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAccessSecret = process.env.JWT_ACCESS_SECRET;

  process.env.NODE_ENV = "production";
  delete process.env.JWT_ACCESS_SECRET;

  try {
    const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
    const args = process.platform === "win32"
      ? ["/c", "pnpm", "exec", "tsx", "--eval", "import('./src/middlewares/admin-auth.middleware.ts')"]
      : ["exec", "tsx", "--eval", "import('./src/middlewares/admin-auth.middleware.ts')"];
    const result = spawnSync(
      command,
      args,
      {
        cwd: resolve(import.meta.dirname, "../.."),
        env: {
          ...process.env,
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: ""
        },
        encoding: "utf8"
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /JWT_ACCESS_SECRET/);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousAccessSecret === undefined) {
      delete process.env.JWT_ACCESS_SECRET;
    } else {
      process.env.JWT_ACCESS_SECRET = previousAccessSecret;
    }
  }
});
