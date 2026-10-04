import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const storefrontDir = process.cwd();
const configPath = resolve(storefrontDir, "next.config.ts");
const originalCwd = process.cwd();
const originalNextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalNodeEnv = process.env.NODE_ENV;
let importSequence = 0;

async function importConfig() {
  importSequence += 1;
  return import(`${pathToFileURL(configPath).href}?t=${importSequence}`);
}

function setEnv(name: "NEXT_PUBLIC_API_URL" | "NODE_ENV", value: string | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
    return;
  }
  Object.assign(process.env, { [name]: value });
}

describe("storefront next config", () => {
  afterEach(() => {
    process.chdir(originalCwd);
    setEnv("NEXT_PUBLIC_API_URL", originalNextPublicApiUrl);
    setEnv("NODE_ENV", originalNodeEnv);
  });

  it("exposes the API URL through the Next env block", async () => {
    setEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000");
    process.chdir(storefrontDir);

    const mod = await importConfig();

    expect(mod.default.env?.NEXT_PUBLIC_API_URL).toBe("http://localhost:4000");
  });

  it("passes through whatever API URL the environment resolved, inventing none", async () => {
    // loadWorkspaceEnv() reads the untracked workspace-root .env, so the exact value is not knowable from a clean checkout; the contract worth locking is that the config forwards the resolved value verbatim and never substitutes one of its own.
    setEnv("NEXT_PUBLIC_API_URL", undefined);
    process.chdir(storefrontDir);

    const mod = await importConfig();
    const resolved = process.env.NEXT_PUBLIC_API_URL;

    expect(mod.default.env?.NEXT_PUBLIC_API_URL).toBe(resolved);
  });

  it("leaves the env API URL undefined when the environment provides none", async () => {
    // Runs from a directory with no workspace-root .env two levels up, so the loader has nothing to load. The variable is deleted explicitly because Vitest shares one process.env across cases in a worker.
    setEnv("NEXT_PUBLIC_API_URL", undefined);
    const emptyDir = mkdtempSync(join(tmpdir(), "capella-next-config-"));
    process.chdir(emptyDir);

    try {
      const mod = await importConfig();

      expect(process.env.NEXT_PUBLIC_API_URL).toBeUndefined();
      expect(mod.default.env?.NEXT_PUBLIC_API_URL).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("allows remote image optimization for the API uploads host", async () => {
    process.chdir(storefrontDir);

    const mod = await importConfig();
    const patterns = mod.default.images?.remotePatterns ?? [];

    expect(patterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: "http",
          hostname: "localhost",
          port: "4000",
          pathname: "/uploads/**"
        })
      ])
    );
  });

  it("allows the image optimizer to fetch local API uploads during development", async () => {
    setEnv("NODE_ENV", "development");
    process.chdir(storefrontDir);

    const mod = await importConfig();

    expect(mod.default.images?.dangerouslyAllowLocalIP).toBe(true);
  });

  it("does not enable localhost image optimization behavior in production", async () => {
    setEnv("NODE_ENV", "production");
    process.chdir(storefrontDir);

    const mod = await importConfig();
    const patterns = mod.default.images?.remotePatterns ?? [];

    expect(patterns).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: "http",
          hostname: "localhost",
          port: "4000",
          pathname: "/uploads/**"
        })
      ])
    );
    expect(mod.default.images?.dangerouslyAllowLocalIP).toBe(false);
  });
});
