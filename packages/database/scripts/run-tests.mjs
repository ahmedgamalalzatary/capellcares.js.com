import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(packageRoot, "..", "..");

process.env.NODE_ENV = "test";

// Load the workspace .env.test into process.env before spawning the test child.
// The child inherits process.env, so modules that import the DB client at import
// time (e.g. integrity.test.ts) get a real connection URL. Existing env vars win,
// so CI can override without editing the file.
const testEnvPath = resolve(workspaceRoot, ".env.test");
if (existsSync(testEnvPath) && typeof process.loadEnvFile === "function") {
  const preexisting = { ...process.env };
  process.loadEnvFile(testEnvPath);
  for (const [key, value] of Object.entries(preexisting)) {
    process.env[key] = value;
  }
}

if (!process.env.DATABASE_URL && process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, "--max-old-space-size=4096"]
  .filter(Boolean)
  .join(" ");

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
