import jwt from "jsonwebtoken";
import {
  isDevAdminFallbackEnabled,
  resolveDevAdminCredentials
} from "../../../middlewares/admin-auth.config.js";
import type { AdminLoginInput } from "./admin-auth.schemas.js";

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
    { expiresIn: env.JWT_ACCESS_TTL ?? "15m" }
  );

  return {
    accessToken,
    user: {
      name: "Capella Admin",
      email: creds.email
    }
  };
}
