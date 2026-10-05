import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import bcrypt from "bcryptjs";

import { createRefreshSession, RefreshTokenRejectedError, rotateRefreshSession } from "../../src/services/auth-session.service.js";
import { revokeActiveAuthSession } from "../../src/modules/auth/auth-session.repository.js";
import { createTestAdminUser, resetApiTestDatabase } from "../helpers/database.js";

let adminUserId: number;

beforeEach(async () => {
  await resetApiTestDatabase();
  adminUserId = await createTestAdminUser({
    name: "Session Admin",
    email: `session-admin-${Date.now()}@capella.test`,
    passwordHash: await bcrypt.hash("password", 1),
    role: "admin",
    isActive: true
  });
});

test("revokeActiveAuthSession wins exactly once for the same session", async () => {
  const created = await createRefreshSession({ accountType: "admin", adminUserId });

  const first = await revokeActiveAuthSession(created.sessionId);
  const second = await revokeActiveAuthSession(created.sessionId);

  assert.equal(first, true, "first revoke should claim the active session");
  assert.equal(second, false, "second revoke should observe it already revoked");
});

test("rotateRefreshSession succeeds once for a valid token", async () => {
  const created = await createRefreshSession({ accountType: "admin", adminUserId });
  const rotated = await rotateRefreshSession(created.refreshToken, "admin");
  assert.ok(rotated.refreshToken);
  assert.notEqual(rotated.refreshToken, created.refreshToken);
});

test("rotateRefreshSession allows only one winner for concurrent rotations of the same token", async () => {
  const created = await createRefreshSession({ accountType: "admin", adminUserId });

  const results = await Promise.allSettled([
    rotateRefreshSession(created.refreshToken, "admin"),
    rotateRefreshSession(created.refreshToken, "admin")
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1, "exactly one rotation should succeed");
  assert.equal(rejected.length, 1, "the second concurrent rotation should be rejected");
});

test("rotateRefreshSession rejects an already-rotated token (replay)", async () => {
  const created = await createRefreshSession({ accountType: "admin", adminUserId });
  await rotateRefreshSession(created.refreshToken, "admin");

  await assert.rejects(rotateRefreshSession(created.refreshToken, "admin"), RefreshTokenRejectedError);
});

test("a failed replacement insert rolls back the revocation so the original token stays usable", async () => {
  const created = await createRefreshSession({ accountType: "admin", adminUserId });

  await assert.rejects(
    rotateRefreshSession(created.refreshToken, "admin", async () => {
      throw new Error("replacement insert failed");
    })
  );

  // The revoke and the replacement insert share one transaction, so a failed insert must not consume the original session and force a needless re-login.
  const retried = await rotateRefreshSession(created.refreshToken, "admin");
  assert.notEqual(retried.refreshToken, created.refreshToken);
});
