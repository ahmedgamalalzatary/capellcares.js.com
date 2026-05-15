import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createCustomer, findCustomerByEmail } from "../../repositories/customer.repository.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";

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
  const accessToken = jwt.sign({ sub: customer.id, role: "customer" }, ACCESS_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ sub: customer.id, role: "customer" }, REFRESH_SECRET, { expiresIn: "30d" });
  return { accessToken, refreshToken, user: { id: customer.id, name: customer.name, email: customer.email } };
}

export function verifyRefreshToken(token: string) {
  const raw = jwt.verify(token, REFRESH_SECRET) as unknown;
  const payload = raw as { sub?: number | string; role?: string };
  if (!payload?.sub || !payload?.role) throw new Error("Invalid refresh payload");
  return { sub: Number(payload.sub), role: payload.role };
}

export function issueAccessToken(userId: number) {
  return jwt.sign({ sub: userId, role: "customer" }, ACCESS_SECRET, { expiresIn: "15m" });
}
