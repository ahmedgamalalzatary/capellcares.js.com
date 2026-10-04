import { build } from "esbuild";

// Bundle the API and read-only shipping-config CLI into self-contained files: everything (our source, @capella/*, pure-JS npm deps) is inlined, Node builtins external under platform:node.
// `mysql2` stays external because it lazily `require()`s charset/auth-plugin files at runtime that a static bundle cannot resolve, so the runner installs just mysql2 instead of the whole workspace closure.
await build({
  entryPoints: ["src/server.ts", "src/scripts/check-shipping.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  sourcemap: true,
  logLevel: "info",
  external: ["mysql2", "mysql2/*"],
  // CJS deps (express/body-parser/…) call require() internally; provide a real require + __dirname/__filename so esbuild's shim resolves them in ESM output.
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __f } from 'node:url';",
      "import { dirname as __d } from 'node:path';",
      "const require = __cr(import.meta.url);",
      "const __filename = __f(import.meta.url);",
      "const __dirname = __d(__filename);"
    ].join("\n")
  }
});
