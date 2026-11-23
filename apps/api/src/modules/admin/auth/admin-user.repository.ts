import { and, eq } from "drizzle-orm";
import { adminUsers } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export type AdminUserRole = "admin" | "staff";

export type AdminUserRecord = typeof adminUsers.$inferSelect;
type AdminUserDbExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export function findAdminUserByEmail(email: string, executor: AdminUserDbExecutor = db) {
  return executor
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function findAdminUserById(id: number, executor: AdminUserDbExecutor = db) {
  return executor
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function findFirstAdminUser(executor: AdminUserDbExecutor = db) {
  return executor
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.role, "admin"))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function listStaffUsers(executor: AdminUserDbExecutor = db) {
  return executor
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.role, "staff"));
}

export function findStaffUserById(id: number, executor: AdminUserDbExecutor = db) {
  return executor
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1)
    .then((rows) => {
      const row = rows[0] ?? null;
      return row?.role === "staff" ? row : null;
    });
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  passwordEncrypted?: string | null;
  role?: AdminUserRole;
  isActive?: boolean;
}, executor: AdminUserDbExecutor = db) {
  const [row] = await executor.insert(adminUsers).values(input).$returningId();
  return row;
}

export async function updateAdminUser(id: number, input: {
  name: string;
  email: string;
  passwordHash?: string;
  passwordEncrypted?: string | null;
  role?: AdminUserRole;
  isActive?: boolean;
}, executor: AdminUserDbExecutor = db) {
  await executor
    .update(adminUsers)
    .set(input)
    .where(eq(adminUsers.id, id));
}

/** Permanently removes a staff account; its permissions and sessions go with it (cascading keys). Never touches an admin. */
export async function deleteStaffUser(id: number, executor: AdminUserDbExecutor = db) {
  const [result] = await executor
    .delete(adminUsers)
    .where(and(eq(adminUsers.id, id), eq(adminUsers.role, "staff")));
  return result.affectedRows > 0;
}
