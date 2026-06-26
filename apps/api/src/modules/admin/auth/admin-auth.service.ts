import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import {
  createAdminUser,
  findAdminUserByEmail,
  findAdminUserById,
  findFirstAdminUser,
  updateAdminUser,
  type AdminUserRecord
} from "../../../repositories/admin-user.repository.js";
import {
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession
} from "../../../services/auth-session.service.js";
import { getEffectiveAdminPermissions } from "../../../services/erp-permissions.service.js";
import { resolveSecret } from "../../../config/secrets.js";
import type { AdminLoginInput } from "./admin-auth.schemas.js";

type JwtExpiresIn = NonNullable<SignOptions["expiresIn"]>;
type JwtDurationUnit = "ms" | "s" | "m" | "h" | "d" | "w" | "y";
type JwtDuration = `${number}${JwtDurationUnit}`;
type ErpAuthUser = Pick<AdminUserRecord, "name" | "email" | "role"> & {
  permissionKeys: string[];
};

function isJwtDuration(value: string): value is JwtDuration {
  return /^(\d+)(ms|s|m|h|d|w|y)$/.test(value);
}

async function toErpAuthUser(adminUser: AdminUserRecord): Promise<ErpAuthUser> {
  return {
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
    permissionKeys: await getEffectiveAdminPermissions(adminUser.id)
  };
}

function resolveJwtAccessTtl(raw: string | undefined): JwtExpiresIn {
  if (!raw) {
    return "15m";
  }

  const seconds = Number(raw);
  if (Number.isInteger(seconds) && seconds > 0) {
    return seconds;
  }

  if (isJwtDuration(raw)) {
    return raw;
  }

  throw new Error("Invalid JWT_ACCESS_TTL; expected a positive integer or duration like 15m");
}

export async function loginAdmin(
  input: AdminLoginInput,
  options?: { env?: NodeJS.ProcessEnv }
) {
  const env = options?.env ?? process.env;

  const email = input.email.trim().toLowerCase();
  const admin = await findAdminUserByEmail(email);
  if (!admin) {
    throw new Error("Invalid admin credentials");
  }
  if (admin.role === "staff" && !admin.isActive) {
    throw new Error("Invalid admin credentials");
  }
  const ok = await bcrypt.compare(input.password, admin.passwordHash);
  if (!ok) throw new Error("Invalid admin credentials");

  const accessSecret = resolveSecret("JWT_ACCESS_SECRET", {
    value: env.JWT_ACCESS_SECRET,
    devFallback: "dev-access-secret",
    env
  });
  const session = await createRefreshSession({ accountType: "admin", adminUserId: admin.id });
  const accessToken = issueAdminAccessToken(admin, session.sessionId, accessSecret, env.JWT_ACCESS_TTL);

  return {
    accessToken,
    refreshToken: session.refreshToken,
    user: await toErpAuthUser(admin)
  };
}

/**
 * Reconcile the single admin account to the environment configuration, which is
 * the source of truth. Runs at server startup (not during login) so credential
 * changes apply at a deliberate moment rather than as a side effect of auth.
 */
export async function ensureBootstrapAdmin(env: NodeJS.ProcessEnv = process.env) {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  const name = env.ADMIN_NAME?.trim() || "Minikoshk Admin";
  if (!email || !password) {
    throw new Error("Admin credentials are not configured");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await findFirstAdminUser();
  if (!existing) {
    await createAdminUser({ name, email, passwordHash, role: "admin", isActive: true });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, existing.passwordHash);
  if (existing.email !== email || existing.name !== name || !passwordMatches) {
    await updateAdminUser(existing.id, { name, email, passwordHash, role: "admin", isActive: true });
  }
}

export async function refreshAdminSession(refreshToken: string) {
  const session = await rotateRefreshSession(refreshToken, "admin");
  if (!session.adminUserId) throw new Error("Invalid admin refresh session");
  const admin = await findAdminUserById(session.adminUserId);
  if (!admin) throw new Error("Invalid admin refresh session");
  if (admin.role === "staff" && !admin.isActive) throw new Error("Invalid admin refresh session");
  return {
    accessToken: issueAdminAccessToken(
      admin,
      session.sessionId,
      resolveSecret("JWT_ACCESS_SECRET", {
        value: process.env.JWT_ACCESS_SECRET,
        devFallback: "dev-access-secret"
      }),
      process.env.JWT_ACCESS_TTL
    ),
    refreshToken: session.refreshToken,
    user: await toErpAuthUser(admin)
  };
}

export function logoutAdminSession(refreshToken: string) {
  return revokeRefreshSession(refreshToken, "admin");
}

function issueAdminAccessToken(
  adminUser: AdminUserRecord,
  sessionId: number,
  accessSecret: string,
  rawTtl: string | undefined
) {
  return jwt.sign(
    {
      sub: adminUser.id,
      role: adminUser.role,
      type: "admin_access",
      sid: sessionId
    },
    accessSecret,
    { expiresIn: resolveJwtAccessTtl(rawTtl) }
  );
}
