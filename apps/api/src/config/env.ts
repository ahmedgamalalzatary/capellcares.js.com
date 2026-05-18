import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type LoadWorkspaceEnvOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  envPath?: string;
  fileExists?: (path: string) => boolean;
  loadFile?: (path: string) => void;
};

const DEFAULT_ENV_FILE_NAME = ".env";
const TEST_ENV_FILE_NAME = ".env.test";

export function resolveWorkspaceEnvPath(
  cwd = process.cwd(),
  envFileName = DEFAULT_ENV_FILE_NAME
): string {
  return resolve(cwd, "..", "..", envFileName);
}

function parseAndAssignEnvFile(path: string, env: NodeJS.ProcessEnv): void {
  const content = readFileSync(path, "utf8");
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
    if (!key || env[key] !== undefined) {
      continue;
    }

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
}

export function loadWorkspaceEnv(
  options: LoadWorkspaceEnvOptions = {}
): void {
  const env = options.env ?? process.env;
  const isTestEnv = env.NODE_ENV === "test";

  if (!env.DATABASE_URL && isTestEnv && env.TEST_DATABASE_URL) {
    env.DATABASE_URL = env.TEST_DATABASE_URL;
  }

  if (env.DATABASE_URL) {
    return;
  }

  const cwd = options.cwd ?? process.cwd();
  const envPath =
    options.envPath ??
    resolveWorkspaceEnvPath(cwd, isTestEnv ? TEST_ENV_FILE_NAME : DEFAULT_ENV_FILE_NAME);
  const fileExists = options.fileExists ?? existsSync;
  if (!fileExists(envPath)) {
    return;
  }

  if (options.loadFile) {
    options.loadFile(envPath);
  } else {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envPath);
    } else {
      parseAndAssignEnvFile(envPath, env);
    }
  }

  if (!env.DATABASE_URL && env.TEST_DATABASE_URL) {
    env.DATABASE_URL = env.TEST_DATABASE_URL;
  }
}
