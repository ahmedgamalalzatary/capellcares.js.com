import type { withTestServer } from "./request.js";
import bcrypt from "bcryptjs";
import { createTestAdminUser } from "./database.js";
import { ensureBootstrapAdmin } from "../../src/modules/admin/auth/admin-auth.service.js";

type TestRequest = Parameters<Parameters<typeof withTestServer>[1]>[0];
let authCounter = 0;

export async function getAdminAuthHeaders(request: TestRequest) {
  authCounter += 1;
  process.env.ADMIN_EMAIL = `admin-${authCounter}@capella.test`;
  process.env.ADMIN_PASSWORD = "AdminPass123";
  await ensureBootstrapAdmin();

  const response = await request("/api/erp/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    })
  });

  if (response.status !== 200 || !response.json?.accessToken) {
    throw new Error(`Failed to authenticate admin for test: ${response.status}`);
  }

  return { authorization: `Bearer ${response.json.accessToken}` };
}

export async function getStaffAuthHeaders(
  request: TestRequest,
  options?: { email?: string; password?: string; isActive?: boolean; permissionKeys?: string[] }
) {
  authCounter += 1;
  const email = options?.email ?? `staff-${authCounter}@capella.test`;
  const password = options?.password ?? "StaffPass123";

  const id = await createTestAdminUser({
    name: "Test Staff",
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: "staff",
    isActive: options?.isActive ?? true
  });
  if (options?.permissionKeys) {
    // The grant resolves keys against the permission catalog, so it must be synced first;
    // without it the insert silently matches no rows and the user keeps zero permissions.
    const { replaceAdminUserPermissions, syncPermissionCatalog } = await import("../../src/services/erp-permissions.service.js");
    await syncPermissionCatalog();
    await replaceAdminUserPermissions(id, options.permissionKeys);
  }

  const response = await request("/api/erp/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (response.status !== 200 || !response.json?.accessToken) {
    throw new Error(`Failed to authenticate staff for test: ${response.status}`);
  }

  return {
    authorization: `Bearer ${response.json.accessToken}`,
    user: response.json.user as { email: string; role: "staff" }
  };
}
