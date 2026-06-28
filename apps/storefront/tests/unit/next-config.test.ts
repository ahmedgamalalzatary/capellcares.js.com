import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const storefrontDir = process.cwd();
const configPath = resolve(storefrontDir, "next.config.ts");
const originalCwd = process.cwd();
const originalNextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;

async function importConfig() {
  return import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
}

describe("storefront next config", () => {
  afterEach(() => {
    process.chdir(originalCwd);
    if (originalNextPublicApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalNextPublicApiUrl;
    }
  });

  it("loads NEXT_PUBLIC_API_URL from the workspace root env file", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
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
    process.chdir(storefrontDir);

    const mod = await importConfig();

    expect(mod.default.images?.dangerouslyAllowLocalIP).toBe(true);
  });
});
