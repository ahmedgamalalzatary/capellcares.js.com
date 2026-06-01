import { eq } from "drizzle-orm";
import { adminUsers } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export type AdminUserRole = "admin" | "staff";

export type AdminUserRecord = typeof adminUsers.$inferSelect;

export function findAdminUserByEmail(email: string) {
  return db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function findAdminUserById(id: number) {
  return db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function findFirstAdminUser() {
  return db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.role, "admin"))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role?: AdminUserRole;
  isActive?: boolean;
}) {
  const [row] = await db.insert(adminUsers).values(input).$returningId();
  return row;
}

export async function updateAdminUser(id: number, input: {
  name: string;
  email: string;
  passwordHash: string;
  role?: AdminUserRole;
  isActive?: boolean;
}) {
  await db
    .update(adminUsers)
    .set(input)
    .where(eq(adminUsers.id, id));
}
