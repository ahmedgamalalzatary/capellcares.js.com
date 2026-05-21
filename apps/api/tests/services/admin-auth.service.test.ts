import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import jwt from "jsonwebtoken";
import { loginAdmin } from "../../src/modules/admin/auth/admin-auth.service.js";
import { resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("loginAdmin returns admin access token for the server-configured admin", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@capella.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  const result = await loginAdmin(
    { email: "admin@capella.eg", password: "admin1234" },
    { env }
  );

  assert.equal(result.user.email, "admin@capella.eg");
  const payload = jwt.verify(result.accessToken, env.JWT_ACCESS_SECRET!) as {
    role?: string;
    type?: string;
  };
  assert.equal(payload.role, "admin");
  assert.equal(payload.type, "admin_access");
});

test("loginAdmin rejects invalid credentials", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
    ADMIN_EMAIL: "admin@capella.eg",
    ADMIN_PASSWORD: "admin1234"
  };

  await assert.rejects(
    () => loginAdmin({ email: "wrong@capella.eg", password: "bad" }, { env }),
    /invalid/i
  );
});

test("loginAdmin rejects when admin credentials are not configured", async () => {
  const env: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: "test-access-secret",
  };

  await assert.rejects(
    () => loginAdmin({ email: "admin@capella.eg", password: "admin1234" }, { env }),
    /not configured/i
  );
});
