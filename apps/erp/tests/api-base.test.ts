import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveApiBase } from "@/lib/api/base";

describe("resolveApiBase", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers the internal API URL on the server", () => {
    expect(
      resolveApiBase({
        API_INTERNAL_URL: "http://api:4000",
        NEXT_PUBLIC_API_URL: "http://localhost:4000"
      } as unknown as NodeJS.ProcessEnv, { isServer: true })
    ).toBe("http://api:4000");
  });

  it("falls back to the public API URL in browser-like execution", () => {
    vi.stubGlobal("window", { location: { protocol: "http:", hostname: "localhost", port: "3001" } } as Window & typeof globalThis);

    expect(
      resolveApiBase({
        API_INTERNAL_URL: "http://api:4000",
        NEXT_PUBLIC_API_URL: "http://localhost:4000"
      } as unknown as NodeJS.ProcessEnv)
    ).toBe("http://localhost:4000");
  });

  it("derives the public API host from the ERP domain when no public env is present", () => {
    vi.stubGlobal("window", { location: { protocol: "https:", hostname: "erp.capellacares.com", port: "" } } as Window & typeof globalThis);

    expect(resolveApiBase({} as NodeJS.ProcessEnv)).toBe("https://api.capellacares.com");
  });
});
