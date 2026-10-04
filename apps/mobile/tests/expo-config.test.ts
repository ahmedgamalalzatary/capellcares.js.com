const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

describe("Expo project configuration", () => {
  test("ships Expo's generated TypeScript references", () => {
    const declarationPath = path.resolve(__dirname, "../expo-env.d.ts");

    expect(existsSync(declarationPath)).toBe(true);
    expect(readFileSync(declarationPath, "utf8")).toContain(
      '/// <reference types="expo/types" />'
    );
    const tsconfig = require("../tsconfig.json");
    expect(tsconfig.include).toEqual(
      expect.arrayContaining(["expo-env.d.ts", ".expo/types/**/*.ts"])
    );
  });
});
