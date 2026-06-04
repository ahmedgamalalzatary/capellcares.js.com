import { describe, expect, it } from "vitest";

import { resolveRevalidateSecret } from "../../src/lib/api/revalidate-secret";

describe("resolveRevalidateSecret", () => {
  it("returns the configured value when present", () => {
    expect(
      resolveRevalidateSecret({ STOREFRONT_REVALIDATE_SECRET: "real", NODE_ENV: "production" })
    ).toBe("real");
  });

  it("falls back to the dev value outside production", () => {
    expect(resolveRevalidateSecret({ NODE_ENV: "development" })).toBe("dev-revalidate-secret");
  });

  it("throws when missing in production", () => {
    expect(() => resolveRevalidateSecret({ NODE_ENV: "production" })).toThrow(
      /STOREFRONT_REVALIDATE_SECRET/
    );
  });
});
