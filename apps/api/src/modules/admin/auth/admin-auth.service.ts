import jwt, { type SignOptions } from "jsonwebtoken";
import {
  isDevAdminFallbackEnabled,
  resolveDevAdminCredentials
} from "../../../middlewares/admin-auth.config.js";
import type { AdminLoginInput } from "./admin-auth.schemas.js";

type JwtExpiresIn = NonNullable<SignOptions["expiresIn"]>;
type JwtDurationUnit = "ms" | "s" | "m" | "h" | "d" | "w" | "y";
type JwtDuration = `${number}${JwtDurationUnit}`;

function isJwtDuration(value: string): value is JwtDuration {
  return /^(\d+)(ms|s|m|h|d|w|y)$/.test(value);
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
  if (!isDevAdminFallbackEnabled(env)) {
    throw new Error("Admin dev fallback is disabled");
  }

  const creds = resolveDevAdminCredentials(env);
  const email = input.email.trim().toLowerCase();
  if (email !== creds.email.toLowerCase() || input.password !== creds.password) {
    throw new Error("Invalid admin credentials");
  }

  const accessSecret = env.JWT_ACCESS_SECRET ?? "dev-access-secret";
  const accessToken = jwt.sign(
    {
      sub: "dev-admin",
      role: "admin",
      type: "admin_access"
    },
    accessSecret,
    { expiresIn: resolveJwtAccessTtl(env.JWT_ACCESS_TTL) }
  );

  return {
    accessToken,
    user: {
      name: "Capella Admin",
      email: creds.email
    }
  };
}
