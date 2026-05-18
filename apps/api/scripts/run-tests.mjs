import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(packageRoot, "..", "..");
const envTestPath = resolve(workspaceRoot, ".env.test");

if (typeof process.loadEnvFile === "function" && existsSync(envTestPath)) {
  process.loadEnvFile(envTestPath);
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const extraArgs = process.argv.slice(2);
const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
const args =
  process.platform === "win32"
    ? ["/c", "pnpm", "exec", "tsx", "--test", "--test-force-exit", "--test-concurrency=1", ...extraArgs]
    : ["exec", "tsx", "--test", "--test-force-exit", "--test-concurrency=1", ...extraArgs];

const child = spawn(command, args, {
  cwd: packageRoot,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
