import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads the monorepo-root `.env` into `process.env` for Next apps.
 *
 * Apps live two levels below the repo root (`apps/<app>`), so the shared
 * `.env` is resolved relative to `process.cwd()`. Existing `process.env`
 * values always win, so nothing already set is overwritten.
 */
export function loadWorkspaceEnv() {
  const envPath = resolve(process.cwd(), "..", "..", ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
