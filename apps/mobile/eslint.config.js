const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// Jest/Node globals that ESLint's `no-undef` rule would otherwise flag inside
// test files. `eslint-config-expo/flat` ships no jest environment, so these are
// declared explicitly rather than pulled from the `globals` package (which is
// not a direct dependency of @capella/mobile and is not resolvable here).
const testGlobals = {
  afterAll: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  fdescribe: "readonly",
  fit: "readonly",
  it: "readonly",
  jest: "readonly",
  pending: "readonly",
  spyOn: "readonly",
  test: "readonly",
  xdescribe: "readonly",
  xit: "readonly",
  xtest: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
  exports: "readonly",
  global: "readonly",
  module: "readonly",
  require: "readonly"
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**", "dist-web/**", "test-results/**", "playwright-report/**", ".expo/**"]
  },
  // NOTE: `pnpm lint` runs `expo lint`, which only lints the `/src`, `/app` and
  // `/components` directories — it never sees `__tests__`, so the project lint
  // task was already green before this block existed. This override only takes
  // effect when ESLint is pointed at the test files directly (e.g. `eslint .`
  // or `expo lint __tests__`). Keep it if you want the test files to lint
  // cleanly too; it is safe to remove if you prefer to leave tests uncovered.
  {
    files: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: testGlobals
    },
    rules: {
      // Test harnesses deliberately mutate module-scope mock state (e.g.
      // `mockAuthState.user = ...`) during render to drive account-switch cases.
      "react-hooks/immutability": "off"
    }
  }
]);
