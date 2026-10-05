import { createHash, randomBytes } from "node:crypto";
import { db } from "@capella/database/src/db";
import {
  createAuthSession,
  findActiveAuthSessionByTokenHash,
  revokeActiveAuthSession,
  revokeAuthSession,
  type AuthSessionExecutor
} from "../modules/auth/auth-session.repository.js";

type AccountType = "customer" | "admin";

/** A genuine refresh-token rejection (invalid, expired, revoked, replayed or malformed session). Distinct from an operational failure so callers can return 401 to the client without erasing a session that a transient outage did not invalidate. */
export class RefreshTokenRejectedError extends Error {
  constructor(message = "Invalid refresh token") {
    super(message);
    this.name = "RefreshTokenRejectedError";
  }
}

const DEFAULT_REFRESH_TTL_DAYS = 30;

export function resolveRefreshTtlMs(raw = process.env.JWT_REFRESH_TTL) {
  if (!raw) return DEFAULT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

  const seconds = Number(raw);
  if (Number.isInteger(seconds) && seconds > 0) return seconds * 1000;

  const match = raw.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error("Invalid JWT_REFRESH_TTL; expected a positive integer or duration like 30d");
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return value * multipliers[unit]!;
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type SessionInput = {
  accountType: AccountType;
  customerId?: number;
  adminUserId?: number;
};

async function insertRefreshSession(input: SessionInput, executor: AuthSessionExecutor = db) {
  const refreshToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + resolveRefreshTtlMs());
  const created = await createAuthSession({
    accountType: input.accountType,
    customerId: input.customerId,
    adminUserId: input.adminUserId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt
  }, executor);
  return { refreshToken, sessionId: created.id, expiresAt };
}

export function createRefreshSession(input: SessionInput) {
  return insertRefreshSession(input);
}

export async function rotateRefreshSession(
  refreshToken: string,
  accountType: AccountType,
  insertSession: typeof insertRefreshSession = insertRefreshSession
) {
  // Revocation and the replacement insert share one transaction: if the insert fails or the process dies, the revoke rolls back and the client can retry with the same token instead of being forced to re-login.
  return db.transaction(async (tx) => {
    const session = await findActiveAuthSessionByTokenHash(hashRefreshToken(refreshToken), accountType, tx);
    if (!session) throw new RefreshTokenRejectedError();

    // Conditional revoke: only the caller that flips revoked_at may issue a replacement session, so concurrent/replayed refreshes cannot both win.
    const won = await revokeActiveAuthSession(session.id, tx);
    if (!won) throw new RefreshTokenRejectedError();

    const rotated = await insertSession({
      accountType,
      customerId: session.customerId ?? undefined,
      adminUserId: session.adminUserId ?? undefined
    }, tx);

    return {
      ...rotated,
      customerId: session.customerId,
      adminUserId: session.adminUserId
    };
  });
}

export async function revokeRefreshSession(refreshToken: string, accountType: AccountType) {
  const session = await findActiveAuthSessionByTokenHash(hashRefreshToken(refreshToken), accountType);
  if (!session) return;
  await revokeAuthSession(session.id);
}
