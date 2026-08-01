import { eq, inArray } from "drizzle-orm";
import {
  adminUserPermissions,
  adminUsers,
  permissions
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

const ERP_PERMISSION_KEYS = [
  "dashboard.read",
  "products.read",
  "products.create",
  "products.update",
  "products.discount",
  "products.soft_delete",
  "products.restore",
  "products.permanent_delete",
  "products.toggle_status",
  "products.stock_update",
  "categories.read",
  "categories.create",
  "categories.update",
  "categories.soft_delete",
  "categories.restore",
  "categories.permanent_delete",
  "offers.read",
  "offers.create",
  "offers.update",
  "offers.soft_delete",
  "offers.restore",
  "offers.permanent_delete",
  "offers.toggle_status",
  "collections.read",
  "collections.create",
  "collections.update",
  "collections.soft_delete",
  "collections.restore",
  "collections.toggle_status",
  "advices.read",
  "advices.create",
  "advices.update",
  "advices.delete",
  "advices.toggle_status",
  "shop_media.read",
  "shop_media.update",
  "orders.read",
  "orders.update_payment_status",
  "reviews.read",
  "reviews.toggle_status",
  "reviews.soft_delete",
  "reviews.restore",
  "reviews.permanent_delete",
  "sales.read",
  "trash.read"
] as const;

export type ErpPermissionKey = (typeof ERP_PERMISSION_KEYS)[number];

const ERP_PERMISSION_KEY_SET = new Set<string>(ERP_PERMISSION_KEYS);
type PermissionsDbExecutor = Pick<typeof db, "select" | "insert" | "delete">;

const ERP_PERMISSION_DEPENDENCIES: Partial<Record<ErpPermissionKey, ErpPermissionKey[]>> = {
  "products.create": ["products.read"],
  "products.update": ["products.read"],
  "products.discount": ["products.read"],
  "products.soft_delete": ["products.read"],
  "products.restore": ["products.read", "trash.read"],
  "products.permanent_delete": ["products.read", "trash.read"],
  "products.toggle_status": ["products.read"],
  "products.stock_update": ["products.read"],
  "categories.create": ["categories.read"],
  "categories.update": ["categories.read"],
  "categories.soft_delete": ["categories.read"],
  "categories.restore": ["categories.read", "trash.read"],
  "categories.permanent_delete": ["categories.read", "trash.read"],
  "offers.create": ["offers.read"],
  "offers.update": ["offers.read"],
  "offers.soft_delete": ["offers.read"],
  "offers.restore": ["offers.read", "trash.read"],
  "offers.permanent_delete": ["offers.read", "trash.read"],
  "offers.toggle_status": ["offers.read"],
  "collections.create": ["collections.read"],
  "collections.update": ["collections.read"],
  "collections.soft_delete": ["collections.read"],
  "collections.restore": ["collections.read", "trash.read"],
  "collections.toggle_status": ["collections.read"],
  "advices.create": ["advices.read"],
  "advices.update": ["advices.read"],
  "advices.delete": ["advices.read"],
  "advices.toggle_status": ["advices.read"],
  "shop_media.update": ["shop_media.read"],
  "orders.update_payment_status": ["orders.read"],
  "reviews.toggle_status": ["reviews.read"],
  "reviews.soft_delete": ["reviews.read"],
  "reviews.restore": ["reviews.read", "trash.read"],
  "reviews.permanent_delete": ["reviews.read", "trash.read"]
};

export function normalizePermissionKeys(keys: string[]) {
  const resolved = new Set<ErpPermissionKey>();

  function addKey(key: string) {
    if (!ERP_PERMISSION_KEY_SET.has(key)) {
      return;
    }
    const typedKey = key as ErpPermissionKey;
    if (resolved.has(typedKey)) {
      return;
    }
    resolved.add(typedKey);
    for (const dependency of ERP_PERMISSION_DEPENDENCIES[typedKey] ?? []) {
      addKey(dependency);
    }
  }

  for (const key of keys) {
    addKey(key);
  }

  return [...resolved].sort();
}

export async function syncPermissionCatalog() {
  const existingRows = await db.select({ key: permissions.key }).from(permissions);
  const existingKeys = new Set(existingRows.map((row) => row.key));
  const missingKeys = ERP_PERMISSION_KEYS.filter((key) => !existingKeys.has(key));

  if (missingKeys.length > 0) {
    await db.insert(permissions).values(missingKeys.map((key) => ({ key })));
  }
}

export async function listPermissionCatalog() {
  await syncPermissionCatalog();
  const rows = await db.select({ key: permissions.key }).from(permissions);
  return rows.map((row) => row.key).sort();
}

export function getPermissionDependencies() {
  return Object.fromEntries(
    ERP_PERMISSION_KEYS.map((key) => [key, [...(ERP_PERMISSION_DEPENDENCIES[key] ?? [])]])
  );
}

export async function getEffectiveAdminPermissions(adminUserId: number, executor: PermissionsDbExecutor = db) {
  const [adminUser] = await executor
    .select({ role: adminUsers.role })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminUserId))
    .limit(1);

  if (!adminUser) {
    return [];
  }

  if (adminUser.role === "admin") {
    return [...ERP_PERMISSION_KEYS];
  }

  const rows = await executor
    .select({ key: permissions.key })
    .from(adminUserPermissions)
    .innerJoin(permissions, eq(permissions.id, adminUserPermissions.permissionId))
    .where(eq(adminUserPermissions.adminUserId, adminUserId));

  return rows.map((row) => row.key).sort();
}

export async function updateAdminUserPermissions(adminEmail: string, requestedKeys: string[]) {
  await syncPermissionCatalog();

  const [adminUser] = await db
    .select({ id: adminUsers.id, role: adminUsers.role })
    .from(adminUsers)
    .where(eq(adminUsers.email, adminEmail))
    .limit(1);

  if (!adminUser) {
    throw new Error("Admin user not found");
  }

  if (adminUser.role !== "staff") {
    return;
  }

  await replaceAdminUserPermissions(adminUser.id, requestedKeys);
}

export async function replaceAdminUserPermissions(
  adminUserId: number,
  requestedKeys: string[],
  executor: PermissionsDbExecutor = db
) {
  const normalizedKeys = normalizePermissionKeys(requestedKeys);
  const permissionRows = normalizedKeys.length === 0
    ? []
    : await executor
        .select({ id: permissions.id, key: permissions.key })
        .from(permissions)
        .where(inArray(permissions.key, normalizedKeys));

  await executor.delete(adminUserPermissions).where(eq(adminUserPermissions.adminUserId, adminUserId));

  if (permissionRows.length > 0) {
    await executor.insert(adminUserPermissions).values(
      permissionRows.map((permission) => ({
        adminUserId,
        permissionId: permission.id
      }))
    );
  }
}

export async function hasErpPermission(adminUserId: number, permissionKey: string) {
  const effectivePermissions = await getEffectiveAdminPermissions(adminUserId);
  return effectivePermissions.includes(permissionKey as ErpPermissionKey);
}
