import { build } from "esbuild";

// Bundle the API entrypoint into a single self-contained file.
// Everything — our source, the workspace packages (@capella/*), and pure-JS
// npm deps (express, drizzle-orm, zod, ...) — is inlined. Node builtins are
// external automatically under platform:node.
//
// `mysql2` is the only package kept external: it lazily `require()`s charset
// and auth-plugin files at runtime, which a static bundle cannot resolve.
// The runner installs just mysql2 (a few MB) instead of the whole workspace
// dependency closure, so React/Radix/Lucide from @capella/shared never ship.
await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/server.mjs",
  sourcemap: true,
  logLevel: "info",
  external: ["mysql2", "mysql2/*"],
  // CJS deps (express/body-parser/…) call require() internally; provide a real
  // require + __dirname/__filename so esbuild's shim resolves them in ESM output.
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
