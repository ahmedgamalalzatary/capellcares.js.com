const { existsSync } = require("node:fs");
const path = require("node:path");

jest.mock("expo/metro-config", () => ({
  getDefaultConfig: () => ({ resolver: {} })
}));

describe("Metro configuration", () => {
  test("exists at the mobile workspace root", () => {
    expect(existsSync(path.resolve(__dirname, "../metro.config.js"))).toBe(true);
  });

  test("provides a custom resolver for shared TypeScript sources", () => {
    const config = require("../metro.config.js");

    expect(typeof config.resolver.resolveRequest).toBe("function");
  });

  test("strips .js from relative imports originating in @capella/shared", () => {
    const config = require("../metro.config.js");
    const defaultResolver = jest.fn((_context, moduleName) => ({ filePath: moduleName }));
    const context = {
      originModulePath: path.resolve(
        __dirname,
        "../../../packages/shared/src/i18n/index.ts"
      ),
      resolveRequest: defaultResolver
    };

    const result = config.resolver.resolveRequest(context, "./ar.js", "ios");

    expect(defaultResolver).toHaveBeenCalledWith(context, "./ar", "ios");
    expect(result).toEqual({ filePath: "./ar" });
  });

  test("falls back to a real .js file when no TypeScript source matches", () => {
    const config = require("../metro.config.js");
    const defaultResolver = jest.fn((_context, moduleName) => {
      if (moduleName === "./runtime") {
        throw new Error("not found");
      }
      return { filePath: moduleName };
    });
    const context = {
      originModulePath: path.resolve(
        __dirname,
        "../../../packages/shared/src/index.ts"
      ),
      resolveRequest: defaultResolver
    };

    const result = config.resolver.resolveRequest(context, "./runtime.js", "android");

    expect(defaultResolver).toHaveBeenNthCalledWith(1, context, "./runtime", "android");
    expect(defaultResolver).toHaveBeenNthCalledWith(2, context, "./runtime.js", "android");
    expect(result).toEqual({ filePath: "./runtime.js" });
  });

  test("does not rewrite .js imports originating outside @capella/shared", () => {
    const config = require("../metro.config.js");
    const defaultResolver = jest.fn((_context, moduleName) => ({ filePath: moduleName }));
    const context = {
      originModulePath: path.resolve(__dirname, "../app/index.tsx"),
      resolveRequest: defaultResolver
    };

    const result = config.resolver.resolveRequest(context, "./runtime.js", "android");

    expect(defaultResolver).toHaveBeenCalledTimes(1);
    expect(defaultResolver).toHaveBeenCalledWith(context, "./runtime.js", "android");
    expect(result).toEqual({ filePath: "./runtime.js" });
  });
});
