# Docker Image Bloat & Production Hygiene

Current image sizes:

| Image | Current | Target |
| --- | --- | --- |
| `capellcaresjscom-api` | 528 MB | ~180–220 MB |
| `capellcaresjscom-storefront` | 1.27 GB | ~300–350 MB |
| `capellcaresjscom-erp` | 1.27 GB | ~300–350 MB |
| **Total** | **~4.2 GB** | **~1.5 GB** |

---

## Problem 1 — `tsx` runs TypeScript directly in production

**Where:** `Dockerfile.api:24`

```dockerfile
CMD ["pnpm", "--dir", "apps/api", "exec", "tsx", "src/server.ts"]
```

No compile step. `tsx`, `typescript`, and all `@types/*` devDependencies ship to the final image. Slower cold start and ~200 MB of unnecessary tooling at runtime.

Note: `apps/api/package.json` already defines `build` (`tsc -p tsconfig.json`) and `start` (`node dist/server.js`). The build target exists; the Dockerfile just doesn't use it.

**Recommended fix:** add a `builder` stage that runs `pnpm --filter @capella/api build`, then a runner stage that installs prod-only deps and copies only `apps/api/dist` plus required `packages/*` build output. Final `CMD ["node", "apps/api/dist/server.js"]`.

> Caveat: `@capella/database` and `@capella/shared` are workspace packages. Verify their `main`/`exports` resolve to compiled JS (not TS source) — if not, they must be built too, otherwise `node dist/server.js` will fail to resolve them at runtime.

---

## Problem 2 — `COPY . .` dumps the full monorepo into the runner

**Where:**
- `Dockerfile.storefront:31`
- `Dockerfile.erp:31`

```dockerfile
COPY . .
```

The runner stage copies the entire repo (all apps, packages, configs, test files, and any `.env*` not blocked by `.dockerignore`) into the production image. Security risk + major size bloat.

**Recommended fix:** stop copying source into the runner. After enabling standalone output (Problem 3), the runner only needs:
- `.next/standalone`
- `.next/static`
- `public/`

---

## Problem 3 — Next.js apps don't emit `output: 'standalone'`

**Where:**
- `apps/storefront/next.config.ts` (lines 3–14)
- `apps/erp/next.config.ts` (lines 42–55)

Neither config sets `output: 'standalone'`, so Next.js doesn't emit a self-contained server bundle. This forces the Dockerfile to ship full `node_modules` and source instead of just the runtime bundle.

**Recommended fix:** add `output: 'standalone'` to both configs:

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ...rest
};
```

---

## Problem 4 — Full `node_modules` (incl. devDependencies) ship to the Next.js runners

**Where:**
- `Dockerfile.storefront:28–30`
- `Dockerfile.erp:28–30`

```dockerfile
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/storefront/node_modules ./apps/storefront/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
```

The `deps` stage installs without `--prod`, so the runner inherits the entire dev toolchain (Next build deps, TypeScript, ESLint, etc.). This is the direct cause of the 1.27 GB images.

**Recommended fix:** delete these `COPY` lines. Once standalone output is enabled, replace the runner body with:

```dockerfile
COPY --from=builder /app/apps/storefront/.next/standalone ./
COPY --from=builder /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder /app/apps/storefront/public ./apps/storefront/public
CMD ["node", "apps/storefront/server.js"]
```

Same pattern for `erp` on port 3001.

---

## Problem 5 — Redundant `node_modules` copies in the API runner

**Where:** `Dockerfile.api:17–20`

```dockerfile
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
```

Four separate node_modules trees, all installed with devDependencies (`tsx`, `typescript`, `@types/*`). Combined with Problem 1 (no build step), this is why the API image is 528 MB instead of ~200 MB.

**Recommended fix:** in the new runner stage, run `pnpm install --frozen-lockfile --prod` against only the workspace manifests needed for runtime, then `COPY --from=builder` only the compiled `dist/` outputs.
