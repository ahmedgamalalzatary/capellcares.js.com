import { resolve } from "node:path";
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

  it("loads NEXT_PUBLIC_API_URL from the workspace root env file", async () => {
    setEnv("NEXT_PUBLIC_API_URL", undefined);
    process.chdir(storefrontDir);

    const mod = await importConfig();

    expect(process.env.NEXT_PUBLIC_API_URL).toBe("http://localhost:4000");
    expect(mod.default.env?.NEXT_PUBLIC_API_URL).toBe("http://localhost:4000");
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
