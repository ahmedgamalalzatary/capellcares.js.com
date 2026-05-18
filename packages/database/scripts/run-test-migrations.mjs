import mysql from "mysql2/promise";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..", "..", "..");
const envTestPath = resolve(workspaceRoot, ".env.test");

if (typeof process.loadEnvFile === "function" && existsSync(envTestPath)) {
  process.loadEnvFile(envTestPath);
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL must be defined before running test migrations");
}

await ensureDatabaseExists(process.env.DATABASE_URL);

const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
const args =
  process.platform === "win32"
    ? ["/c", "pnpm", "exec", "drizzle-kit", "migrate", "--config=drizzle.config.ts"]
    : ["exec", "drizzle-kit", "migrate", "--config=drizzle.config.ts"];

const child = spawn(command, args, {
  cwd: resolve(workspaceRoot, "packages", "database"),
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

async function ensureDatabaseExists(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name");
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/";

  const connection = await mysql.createConnection(adminUrl.toString());
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
  } finally {
    await connection.end();
  }
}
