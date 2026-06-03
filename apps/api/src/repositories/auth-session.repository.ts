import { and, eq, gt, isNull } from "drizzle-orm";
import { authSessions } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

type AccountType = "customer" | "admin";

export function findActiveAuthSessionByTokenHash(tokenHash: string, accountType: AccountType) {
  return db
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

export async function createAuthSession(input: {
  accountType: AccountType;
  customerId?: number;
  adminUserId?: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const [row] = await db
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

export function revokeAuthSession(id: number) {
  return db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, id));
}
