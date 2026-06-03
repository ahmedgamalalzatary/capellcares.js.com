import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { createCustomer, findCustomerByEmail, findCustomerById } from "../../repositories/customer.repository.js";
import {
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession
} from "../../services/auth-session.service.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

type JwtExpiresIn = NonNullable<SignOptions["expiresIn"]>;
type JwtDurationUnit = "ms" | "s" | "m" | "h" | "d" | "w" | "y";
type JwtDuration = `${number}${JwtDurationUnit}`;

function isJwtDuration(value: string): value is JwtDuration {
  return /^(\d+)(ms|s|m|h|d|w|y)$/.test(value);
}

function resolveJwtAccessTtl(raw: string | undefined): JwtExpiresIn {
  if (!raw) return "15m";
  const seconds = Number(raw);
  if (Number.isInteger(seconds) && seconds > 0) return seconds;
  if (isJwtDuration(raw)) return raw;
  throw new Error("Invalid JWT_ACCESS_TTL; expected a positive integer or duration like 15m");
}

export async function signup(input: { name: string; email: string; password: string }) {
  const existing = await findCustomerByEmail(input.email);
  if (existing) throw new Error("Email already exists");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const created = await createCustomer({ name: input.name, email: input.email, passwordHash });
  return { id: created.id, name: input.name, email: input.email };
}

export async function login(input: { email: string; password: string }) {
  const customer = await findCustomerByEmail(input.email);
  if (!customer) throw new Error("Invalid credentials");
  const ok = await bcrypt.compare(input.password, customer.passwordHash);
  if (!ok) throw new Error("Invalid credentials");
  const session = await createRefreshSession({ accountType: "customer", customerId: customer.id });
  const accessToken = issueAccessToken(customer.id, session.sessionId);
  const refreshToken = session.refreshToken;
  return { accessToken, refreshToken, user: { id: customer.id, name: customer.name, email: customer.email } };
}

export async function refreshCustomerSession(token: string) {
  const session = await rotateRefreshSession(token, "customer");
  if (!session.customerId) throw new Error("Invalid refresh session");
  const customer = await findCustomerById(session.customerId);
  if (!customer) throw new Error("Invalid refresh session");
  return {
    accessToken: issueAccessToken(customer.id, session.sessionId),
    refreshToken: session.refreshToken
  };
}

export function logoutCustomerSession(token: string) {
  return revokeRefreshSession(token, "customer");
}

function issueAccessToken(userId: number, sessionId?: number) {
  return jwt.sign(
    { sub: userId, role: "customer", sid: sessionId },
    ACCESS_SECRET,
    { expiresIn: resolveJwtAccessTtl(process.env.JWT_ACCESS_TTL) }
  );
}
