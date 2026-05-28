import { spawn } from "node:child_process";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const extraArgs = process.argv.slice(2);
const testArgs = extraArgs.length > 0 ? extraArgs : ["tests/**/*.test.ts"];
const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
const args =
  process.platform === "win32"
    ? ["/c", "pnpm", "exec", "tsx", "--test", "--test-force-exit", "--test-concurrency=1", ...testArgs]
    : ["exec", "tsx", "--test", "--test-force-exit", "--test-concurrency=1", ...testArgs];

const child = spawn(command, args, {
  cwd: packageRoot,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
