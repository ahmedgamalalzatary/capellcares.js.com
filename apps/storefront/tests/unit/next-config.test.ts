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
});
