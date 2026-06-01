import { and, eq, inArray } from "drizzle-orm";
import {
  adminUserPermissions,
  adminUsers,
  permissions
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export const ERP_PERMISSION_KEYS = [
  "dashboard.read",
  "products.read",
  "products.create",
  "products.update",
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
  "offers.read",
  "offers.create",
  "offers.update",
  "offers.soft_delete",
  "offers.restore",
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
  "orders.read",
  "orders.update_payment_status",
  "sales.read",
  "trash.read"
] as const;

export type ErpPermissionKey = (typeof ERP_PERMISSION_KEYS)[number];

const ERP_PERMISSION_KEY_SET = new Set<string>(ERP_PERMISSION_KEYS);

const ERP_PERMISSION_DEPENDENCIES: Partial<Record<ErpPermissionKey, ErpPermissionKey[]>> = {
  "products.create": ["products.read"],
  "products.update": ["products.read"],
  "products.soft_delete": ["products.read"],
  "products.restore": ["products.read", "trash.read"],
  "products.permanent_delete": ["products.read", "trash.read"],
  "products.toggle_status": ["products.read"],
  "products.stock_update": ["products.read"],
  "categories.create": ["categories.read"],
  "categories.update": ["categories.read"],
  "categories.soft_delete": ["categories.read"],
  "categories.restore": ["categories.read", "trash.read"],
  "offers.create": ["offers.read"],
  "offers.update": ["offers.read"],
  "offers.soft_delete": ["offers.read"],
  "offers.restore": ["offers.read", "trash.read"],
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
  "orders.update_payment_status": ["orders.read"]
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

export async function getEffectiveAdminPermissions(adminUserId: number) {
  const [adminUser] = await db
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

  const rows = await db
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

  const normalizedKeys = normalizePermissionKeys(requestedKeys);
  const permissionRows = normalizedKeys.length === 0
    ? []
    : await db
        .select({ id: permissions.id, key: permissions.key })
        .from(permissions)
        .where(inArray(permissions.key, normalizedKeys));

  await db.delete(adminUserPermissions).where(eq(adminUserPermissions.adminUserId, adminUser.id));

  if (permissionRows.length > 0) {
    await db.insert(adminUserPermissions).values(
      permissionRows.map((permission) => ({
        adminUserId: adminUser.id,
        permissionId: permission.id
      }))
    );
  }
}

export async function hasErpPermission(adminUserId: number, permissionKey: string) {
  const effectivePermissions = await getEffectiveAdminPermissions(adminUserId);
  return effectivePermissions.includes(permissionKey as ErpPermissionKey);
}

export async function getPermissionIdByKey(permissionKey: string) {
  const [permission] = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.key, permissionKey))
    .limit(1);

  return permission?.id ?? null;
}
