import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(packageRoot, "..", "..");

process.env.NODE_ENV = "test";

// Load the workspace .env.test into process.env before spawning the test child; the child inherits it, so modules importing the DB client at import time get a real connection URL.
// Existing env vars win, so CI can override without editing the file.
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
const wantsCoverage = extraArgs.includes("--coverage");
const filteredArgs = extraArgs.filter((arg) => arg !== "--coverage");
const testArgs = filteredArgs.length > 0 ? filteredArgs : ["tests/**/*.test.ts"];

// Node's built-in coverage counts only loaded files, so the reported figure is a lower bound on workspace coverage rather than a whole-workspace percentage.
const coverageArgs = wantsCoverage
  ? ["--experimental-test-coverage", "--test-coverage-include=src/**/*.ts"]
  : [];
const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
const args =
  process.platform === "win32"
    ? ["/c", "pnpm", "exec", "tsx", "--test", "--test-force-exit", "--test-concurrency=1", ...coverageArgs, ...testArgs]
    : ["exec", "tsx", "--test", "--test-force-exit", "--test-concurrency=1", ...coverageArgs, ...testArgs];

const child = spawn(command, args, {
  cwd: packageRoot,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
