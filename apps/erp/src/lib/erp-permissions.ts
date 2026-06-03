"use client";

import type { AdminAuthUser } from "@/lib/api/client";

export function hasErpPermission(user: AdminAuthUser | null, permissionKey: string) {
  if (!user) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return user.permissionKeys.includes(permissionKey);
}

export function canReadErpModule(user: AdminAuthUser | null, moduleName: string) {
  return hasErpPermission(user, `${moduleName}.read`);
}

export function canCreateErpModule(user: AdminAuthUser | null, moduleName: string) {
  return hasErpPermission(user, `${moduleName}.create`);
}

export function canUpdateErpModule(user: AdminAuthUser | null, moduleName: string) {
  return hasErpPermission(user, `${moduleName}.update`);
}

export function canSoftDeleteErpModule(user: AdminAuthUser | null, moduleName: string) {
  return hasErpPermission(user, `${moduleName}.soft_delete`);
}

export function canRestoreErpModule(user: AdminAuthUser | null, moduleName: string) {
  return hasErpPermission(user, `${moduleName}.restore`);
}

export function canToggleErpModule(user: AdminAuthUser | null, moduleName: string) {
  return hasErpPermission(user, `${moduleName}.toggle_status`);
}
