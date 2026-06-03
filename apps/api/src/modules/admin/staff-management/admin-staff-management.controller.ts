import type { Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@capella/database/src/db";
import {
  createAdminUser,
  findAdminUserByEmail,
  findStaffUserById,
  listStaffUsers,
  updateAdminUser,
  type AdminUserRecord
} from "../../../repositories/admin-user.repository.js";
import type { ErpAuthenticatedRequest } from "../../../middlewares/admin-auth.middleware.js";
import {
  getEffectiveAdminPermissions,
  getPermissionDependencies,
  listPermissionCatalog,
  replaceAdminUserPermissions,
  syncPermissionCatalog
} from "../../../services/erp-permissions.service.js";

type StaffMutationInput = {
  name: string;
  email: string;
  password?: string;
  isActive: boolean;
  permissionKeys: string[];
};

function toStaffDto(user: AdminUserRecord, permissionKeys: string[]) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    permissionKeys
  };
}

function parseStaffId(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseStaffMutationBody(body: unknown, options: { requirePassword: boolean }): StaffMutationInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid staff payload");
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : undefined;
  const isActive = input.isActive;
  const permissionKeys = input.permissionKeys;

  if (!name) {
    throw new Error("Staff name is required");
  }

  if (!email) {
    throw new Error("Staff email is required");
  }

  if (typeof isActive !== "boolean") {
    throw new Error("Staff active status is required");
  }

  if (!Array.isArray(permissionKeys) || permissionKeys.some((key) => typeof key !== "string")) {
    throw new Error("Staff permissions must be a string array");
  }

  if (options.requirePassword && (!password || password.trim().length === 0)) {
    throw new Error("Staff password is required");
  }

  return {
    name,
    email,
    password,
    isActive,
    permissionKeys
  };
}

export async function listAdminStaffController(_req: ErpAuthenticatedRequest, res: Response) {
  const staffUsers = await listStaffUsers();
  const items = await Promise.all(
    staffUsers.map(async (staffUser) => toStaffDto(staffUser, await getEffectiveAdminPermissions(staffUser.id)))
  );
  res.json({ items });
}

export async function listStaffPermissionCatalogController(_req: ErpAuthenticatedRequest, res: Response) {
  const dependencies = getPermissionDependencies();
  const items = (await listPermissionCatalog()).map((key) => ({ key, dependencies: dependencies[key] ?? [] }));
  res.json({ items });
}

export async function createAdminStaffController(req: ErpAuthenticatedRequest, res: Response) {
  let input: StaffMutationInput;
  try {
    input = parseStaffMutationBody(req.body, { requirePassword: true });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }

  const existingUser = await findAdminUserByEmail(input.email);
  if (existingUser) {
    return res.status(409).json({ error: "Staff email already exists" });
  }

  const passwordHash = await bcrypt.hash(input.password ?? "", 10);
  await syncPermissionCatalog();

  try {
    const item = await db.transaction(async (tx) => {
      const created = await createAdminUser(
        {
          name: input.name,
          email: input.email,
          passwordHash,
          role: "staff",
          isActive: input.isActive
        },
        tx
      );
      const staffUser = await findStaffUserById(created.id, tx);
      if (!staffUser) {
        throw new Error("Staff user not found after creation");
      }
      await replaceAdminUserPermissions(staffUser.id, input.permissionKeys, tx);
      const permissionKeys = await getEffectiveAdminPermissions(staffUser.id, tx);
      return toStaffDto(staffUser, permissionKeys);
    });

    res.status(201).json({ item });
  } catch (error) {
    if (isDuplicateAdminEmailError(error)) {
      return res.status(409).json({ error: "Staff email already exists" });
    }
    throw error;
  }
}

export async function updateAdminStaffController(req: ErpAuthenticatedRequest, res: Response) {
  const staffId = parseStaffId(req.params.id);
  if (staffId == null) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const staffUser = await findStaffUserById(staffId);
  if (!staffUser) {
    return res.status(404).json({ message: "Not found" });
  }

  const input = parseStaffMutationBody(req.body, { requirePassword: false });
  const nextPasswordHash =
    typeof input.password === "string" && input.password.trim().length > 0
      ? await bcrypt.hash(input.password, 10)
      : undefined;

  await updateAdminUser(staffId, {
    name: input.name,
    email: input.email,
    isActive: input.isActive,
    passwordHash: nextPasswordHash,
    role: "staff"
  });
  await replaceAdminUserPermissions(staffId, input.permissionKeys);

  const updatedStaffUser = await findStaffUserById(staffId);
  if (!updatedStaffUser) {
    return res.status(404).json({ message: "Not found" });
  }

  const permissionKeys = await getEffectiveAdminPermissions(staffId);
  res.json({ item: toStaffDto(updatedStaffUser, permissionKeys) });
}

function isDuplicateAdminEmailError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { cause?: { code?: string; sqlMessage?: string } };
  return (
    candidate.cause?.code === "ER_DUP_ENTRY" &&
    candidate.cause?.sqlMessage?.includes("admin_users_email_unique") === true
  );
}
