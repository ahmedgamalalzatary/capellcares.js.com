import { createHash, randomBytes } from "node:crypto";
import {
  createAuthSession,
  findActiveAuthSessionByTokenHash,
  revokeActiveAuthSession,
  revokeAuthSession
} from "../repositories/auth-session.repository.js";

type AccountType = "customer" | "admin";

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

export async function createRefreshSession(input: {
  accountType: AccountType;
  customerId?: number;
  adminUserId?: number;
}) {
  const refreshToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + resolveRefreshTtlMs());
  const created = await createAuthSession({
    accountType: input.accountType,
    customerId: input.customerId,
    adminUserId: input.adminUserId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt
  });
  return { refreshToken, sessionId: created.id, expiresAt };
}

export async function rotateRefreshSession(refreshToken: string, accountType: AccountType) {
  const session = await findActiveAuthSessionByTokenHash(hashRefreshToken(refreshToken), accountType);
  if (!session) throw new Error("Invalid refresh token");

  // Conditional revoke: only the caller that flips revoked_at may issue a
  // replacement session, so concurrent/replayed refreshes cannot both win.
  const won = await revokeActiveAuthSession(session.id);
  if (!won) throw new Error("Invalid refresh token");

  const rotated = await createRefreshSession({
    accountType,
    customerId: session.customerId ?? undefined,
    adminUserId: session.adminUserId ?? undefined
  });

  return {
    ...rotated,
    customerId: session.customerId,
    adminUserId: session.adminUserId
  };
}

export async function revokeRefreshSession(refreshToken: string, accountType: AccountType) {
  const session = await findActiveAuthSessionByTokenHash(hashRefreshToken(refreshToken), accountType);
  if (!session) return;
  await revokeAuthSession(session.id);
}
