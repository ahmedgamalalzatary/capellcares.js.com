import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

function parseAuthUser(req: { headers: { authorization?: string } }) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const raw = jwt.verify(token, ACCESS_SECRET) as unknown;
    const payload = raw as { sub?: number | string; role?: string };
    if (!payload?.sub || !payload?.role) return null;
    const id = typeof payload.sub === "string" ? Number(payload.sub) : payload.sub;
    if (!Number.isFinite(id)) return null;
    return { id, role: payload.role };
  } catch {
    return null;
  }
}

function createToken(payload: jwt.JwtPayload, secret: string = ACCESS_SECRET) {
  return jwt.sign(payload, secret);
}

test("parseAuthUser returns null when no token is provided", () => {
  const result = parseAuthUser({ headers: {} });
  assert.equal(result, null);
});

test("parseAuthUser returns null when token is invalid", () => {
  const result = parseAuthUser({ headers: { authorization: "Bearer invalid-token" } });
  assert.equal(result, null);
});

test("parseAuthUser returns null when sub is missing", () => {
  const token = createToken({ role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(result, null);
});

test("parseAuthUser returns null when role is missing", () => {
  const token = createToken({ sub: 1 });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(result, null);
});

test("parseAuthUser returns user when sub is a number", () => {
  const token = createToken({ sub: 42, role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.deepEqual(result, { id: 42, role: "customer" });
});

test("parseAuthUser returns user when sub is a numeric string", () => {
  const token = createToken({ sub: "42", role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.deepEqual(result, { id: 42, role: "customer" });
});

test("parseAuthUser returns null when sub is a non-numeric string", () => {
  const token = createToken({ sub: "abc", role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(result, null);
});

test("parseAuthUser returns null when sub is NaN-producing string", () => {
  const token = createToken({ sub: "123abc", role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(result, null);
});

test("parseAuthUser returns null when sub is empty string", () => {
  const token = createToken({ sub: "", role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(result, null);
});

test("parseAuthUser returns null when sub is Infinity", () => {
  const token = createToken({ sub: Infinity, role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(result, null);
});

test("parseAuthUser returns null when sub is -Infinity", () => {
  const token = createToken({ sub: -Infinity, role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(result, null);
});

test("parseAuthUser returns null when sub is NaN", () => {
  const token = createToken({ sub: NaN, role: "customer" });
  const result = parseAuthUser({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(result, null);
});
