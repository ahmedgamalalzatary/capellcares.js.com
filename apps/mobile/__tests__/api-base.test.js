describe("mobile API base", () => {
  test("keeps Expo's statically inlinable environment expression", () => {
    const { readFileSync } = require("node:fs");
    const path = require("node:path");
    const source = readFileSync(
      path.resolve(__dirname, "../src/lib/api/base.ts"),
      "utf8"
    );

    expect(source).toContain("process.env.EXPO_PUBLIC_API_URL");
  });

  test("uses a trimmed explicit Expo public API URL", () => {
    const api = require("../src/lib/api/base");

    expect(typeof api.resolveMobileApiBase).toBe("function");
    expect(
      api.resolveMobileApiBase(
        "  https://api.example.com/  ",
        "android",
        false
      )
    ).toBe("https://api.example.com");
  });

  test.each([
    ["android", "http://10.0.2.2:4000"],
    ["ios", "http://localhost:4000"]
  ])("uses the %s development fallback only in development", (platform, expected) => {
    const { resolveMobileApiBase } = require("../src/lib/api/base");

    expect(resolveMobileApiBase(undefined, platform, true)).toBe(expected);
  });

  test("rejects a missing production API URL", () => {
    const { resolveMobileApiBase } = require("../src/lib/api/base");

    expect(() => resolveMobileApiBase(undefined, "android", false)).toThrow(
      "EXPO_PUBLIC_API_URL is required outside development"
    );
  });
});
