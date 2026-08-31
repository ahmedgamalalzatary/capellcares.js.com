import { rewriteSharedJsSpecifier } from "../metro-js-specifier";

describe("rewriteSharedJsSpecifier", () => {
  const sharedOrigin = "/repo/packages/shared/src/i18n/index.ts";

  it("strips .js from relative imports that originate in @capella/shared", () => {
    expect(rewriteSharedJsSpecifier("./ar.js", sharedOrigin)).toBe("./ar");
    expect(rewriteSharedJsSpecifier("../constants/languages.js", sharedOrigin)).toBe(
      "../constants/languages"
    );
  });

  it("leaves real .js requests from outside shared unchanged", () => {
    expect(rewriteSharedJsSpecifier("./metro.config.js", "/repo/apps/mobile/app/index.tsx")).toBe(
      null
    );
  });

  it("does not rewrite bare or node_modules specifiers", () => {
    expect(rewriteSharedJsSpecifier("zod", sharedOrigin)).toBe(null);
    expect(rewriteSharedJsSpecifier("some-pkg/index.js", sharedOrigin)).toBe(null);
  });
});
