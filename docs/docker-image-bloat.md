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

---

## Problem 6 — `.dockerignore` does not exclude `.env.docker` / `.env.production`

**Where:** `.dockerignore:13–15`

```
.env
.env.local
.env.*.local
```

Only `.env`, `.env.local`, and `.env.*.local` are excluded. `.env.docker` and `.env.production` match none of those patterns, so every `COPY . .` in the runner stages bakes the env files — including secrets (`JWT_*_SECRET`, `MYSQL_PASSWORD`, `ADMIN_PASSWORD`, `HOSTINGER_PASSWORD`) — into the final images.

**Recommended fix:** broaden the ignore to cover all dotenv variants:

```
.env
.env.*
!.env.example
```

This excludes every `.env.*` file (including `.env.docker`, `.env.production`) while keeping `.env.example` as the in-repo template. Pair with removing `COPY . .` from runner stages (Problem 2) for defense in depth.

---

## Problem 7 — `.env.example` still advertises removed dev-fallback variables

**Where:** `.env.example:26–31`

```env
ALLOW_DEV_ADMIN_FALLBACK=true
DEV_ADMIN_EMAIL=admin@capella.eg
DEV_ADMIN_PASSWORD=admin1234
NEXT_PUBLIC_DEV_ADMIN_EMAIL=admin@capella.eg
NEXT_PUBLIC_DEV_ADMIN_PASSWORD=admin1234
```

`docs/deploy.md` explicitly instructs operators to **remove** these variables from production and Docker env files, but the template that new contributors copy from still lists them. Result: every fresh checkout reintroduces deprecated auth fallbacks.

**Recommended fix:** delete those lines from `.env.example` and add the required server-only admin bootstrap block instead:

```env
ADMIN_NAME=Capella Admin
ADMIN_EMAIL=replace-with-admin-email
ADMIN_PASSWORD=replace-with-strong-admin-password
```

---

## Problem 8 — Storefront revalidation env vars not wired into Compose

**Where:** `docker-compose.yml` (`api` service environment block, lines 31–45)

`.env.docker` defines `STOREFRONT_BASE_URL` and `STOREFRONT_REVALIDATE_SECRET`, which the API needs to trigger on-demand ISR revalidation in the storefront (see commit `3d5c7b0` — "on-demand storefront revalidation"). Neither variable is forwarded to the `api` container in `docker-compose.yml`, so inside Docker the API has no way to reach the storefront's revalidate endpoint.

**Recommended fix:** add the variables to the `api` service environment block, defaulting `STOREFRONT_BASE_URL` to the internal service name:

```yaml
STOREFRONT_BASE_URL: ${STOREFRONT_BASE_URL:-http://storefront:3000}
STOREFRONT_REVALIDATE_SECRET: ${STOREFRONT_REVALIDATE_SECRET:?set STOREFRONT_REVALIDATE_SECRET in env file}
```

Note: in Docker, the API should talk to the storefront via the service hostname `http://storefront:3000`, not `localhost:3000` as `.env.docker` currently implies.

---

## Problem 9 — `drizzle-kit push` leaves `__drizzle_migrations` empty, breaking later `db:migrate`

**Where:** the Fresh DB Flow in `docs/deploy.md` (lines 78–83 production, 204–208 local) uses:

```bash
drizzle-kit push --config=drizzle.config.ts
```

`push` syncs the schema diff directly against the live DB but **does not record anything in the `__drizzle_migrations` tracking table**. If the same DB is later reused with the Existing DB Flow (`db:migrate`), drizzle replays migration `0000` from scratch, hits `CREATE TABLE ... already exists`, and the migrate command exits non-zero with the error swallowed by drizzle-kit's spinner (only `[⣷] applying migrations...` is visible).

Symptom observed locally:

```
$ drizzle-kit migrate
[⣯] applying migrations...
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] Exit status 1
```

**Why it matters:** the documented Fresh → Existing handoff is broken. Any DB ever bootstrapped with `push` is permanently locked out of `db:migrate` until `__drizzle_migrations` is backfilled or the volume is wiped.

**Recommended fix (pick one):**

1. **Stop using `push` for any DB you intend to keep.** Use `db:migrate` even for the first apply against a fresh DB — drizzle-kit will apply `0000` cleanly and populate the tracking table.
2. **If a `push`-bootstrapped DB must keep its data,** backfill `__drizzle_migrations` by computing each migration file's drizzle hash (sha256 of normalized SQL per drizzle-kit's algorithm) and inserting one row per applied file. This is fragile and only viable when the live schema exactly matches the latest migration's final state.
3. **Document the lock-in:** if `push` remains the Fresh-DB tool, update `docs/deploy.md` to state that such DBs cannot later be migrated and must continue using `push` for their entire lifetime.
