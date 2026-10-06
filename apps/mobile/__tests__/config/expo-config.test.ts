import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

describe("Expo project configuration", () => {
  test("ships Expo's generated TypeScript references", () => {
    const declarationPath = path.resolve(__dirname, "../../expo-env.d.ts");

    expect(existsSync(declarationPath)).toBe(true);
    expect(readFileSync(declarationPath, "utf8")).toContain(
      '/// <reference types="expo/types" />'
    );
    const tsconfig = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../tsconfig.json"), "utf8")
    );
    expect(tsconfig.include).toEqual(
      expect.arrayContaining(["expo-env.d.ts", ".expo/types/**/*.ts"])
    );
  });
});
