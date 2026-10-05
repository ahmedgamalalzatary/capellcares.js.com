import { and, eq, gt, isNull } from "drizzle-orm";
import { authSessions } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

type AccountType = "customer" | "admin";

/** The subset of the Drizzle client a session write needs, so the same operations can run inside a transaction (tx) or on the pool (db). */
export type AuthSessionExecutor = Pick<typeof db, "select" | "insert" | "update">;

export function findActiveAuthSessionByTokenHash(
  tokenHash: string,
  accountType: AccountType,
  executor: AuthSessionExecutor = db
) {
  return executor
    .select()
    .from(authSessions)
    .where(and(
      eq(authSessions.tokenHash, tokenHash),
      eq(authSessions.accountType, accountType),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, new Date())
    ))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

/** Resolve an access token's session id (`sid`) to a still-active session so revocation takes effect immediately rather than at token expiry. */
export function findActiveAuthSessionById(
  id: number,
  accountType: AccountType,
  executor: AuthSessionExecutor = db
) {
  return executor
    .select()
    .from(authSessions)
    .where(and(
      eq(authSessions.id, id),
      eq(authSessions.accountType, accountType),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, new Date())
    ))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function createAuthSession(input: {
  accountType: AccountType;
  customerId?: number;
  adminUserId?: number;
  tokenHash: string;
  expiresAt: Date;
}, executor: AuthSessionExecutor = db) {
  const [row] = await executor
    .insert(authSessions)
    .values({
      accountType: input.accountType,
      customerId: input.customerId,
      adminUserId: input.adminUserId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt
    })
    .$returningId();
  return row;
}

export function revokeAuthSession(id: number, executor: AuthSessionExecutor = db) {
  return executor
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, id));
}

/** Atomically revoke a session only if it is still active; returns true when this caller won the revocation (one affected row), false if already revoked, which makes refresh rotation safe against concurrent/replayed requests. */
export async function revokeActiveAuthSession(id: number, executor: AuthSessionExecutor = db): Promise<boolean> {
  const result = await executor
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)));
  return result[0].affectedRows > 0;
}
