# Phase 01 — Foundation: Scripts & Fixtures

> **Status:** PARTIAL (content-verified) — DB harness + safety solid; baseline seed is happy-path only;
> root scripts and the full fixture matrix are the real gaps.
> **Scope:** "Tooling Decisions", "Staging Smoke Data Decision", "Pipeline Ordering",
> "Test Data And Fixture Requirements".
> **Depends on:** nothing. **Blocks:** every other phase.

## Goal

Make the test database deterministic and the test commands discoverable, so every
later phase has a stable, isolated DB and a single seed source of truth.

## Current state (2026-05-30)

- Test DB migrations run via **`packages/database` `pretest`** → `scripts/run-test-migrations.mjs`.
  API tests run via `apps/api` `scripts/run-tests.mjs`; `packages/database` has its own `run-tests.mjs`.
- Seed lives in **`packages/database/src/seeds/`**: `test.seed.ts`, `categories.seed.ts`
  (`pnpm --filter @capella/database db:seed`). **Verified: baseline is happy-path only** — 1 root + 1 leaf
  category, 2 active products (1 variant each), 1 active visible offer, 1 customer. `clearTestSeed` throws
  unless `NODE_ENV=test` or `ALLOW_DB_WIPE=true`. The full fixture matrix below is NOT yet seeded.
- API test helpers: `apps/api/tests/helpers/{admin-auth,database,request}.ts`
  (note: leaner than the master plan assumed — no per-domain checkout/cart/wishlist helper files).
- Root `package.json` has only `test` (turbo) and `test:staging-smoke`. **No targeted root scripts.**
- `apps/storefront` (~24) and `apps/erp` (~17) **already have Vitest suites**; `vitest` 4.x, jsdom, `tests/setup.ts` present.
- `packages/shared/tests/contracts/` has **7 real contract files** (product/offer/category/advice/related-item
  + helpers + index), consumed by API + storefront contract tests via `assertConformsTo`. No standalone runner.
- Env: **verified** — `load-workspace-env.test.ts` covers `.env.test` loading, `TEST_DATABASE_URL` →
  `DATABASE_URL` mapping under `NODE_ENV=test`, and skip-when-already-set.

## Repo-state note (2026-06-09)

- This phase still mostly matches the repo.
- The biggest confirmed gaps remain:
  - no targeted root test scripts beyond `test` and `test:staging-smoke`
  - no staging fixture bootstrap/check script
  - no expanded fixture matrix in the seed
- `test:staging-smoke` currently points at a missing Playwright suite, so it should not be treated as a
  working baseline until Phase 05 is restored.

## Tasks

### Test DB safety [T0]
- [x] Tests refuse to run against production DB when `NODE_ENV=test`. *(clearTestSeed throws unless NODE_ENV=test or ALLOW_DB_WIPE=true; load-workspace-env maps TEST_DATABASE_URL)*
- [x] `clearTestSeed`/`resetApiTestDatabase` leave the DB isolated and repeatable; never touch dev data.
- [ ] Explicit "migrate from genuinely empty DB → schema compatible with repositories" test (harness assumes pretest already migrated).

### Deterministic seed/fixture matrix [T1]
Extend `seed.ts` to cover the master "Test Data And Fixture Requirements":
- [ ] Products: active, inactive, draft, soft-deleted, in-stock, low-stock, out-of-stock.
- [ ] Variants: one, many, none-active, mixed/equal prices, hidden buying price.
- [ ] Offers: visible, inactive, out-of-stock-but-visible, one item, multi item, shared variant.
- [ ] Categories: root, child, grandchild, leaf, non-leaf, deleted, with linked products.
- [ ] Accounts: customer, admin, existing-email-for-guest-checkout, customer with wishlist/order history.
- [ ] Bilingual fixtures: Arabic and English text distinct enough to catch localization mixups.

### Root scripts [T1]
Add discoverable targeted scripts to root `package.json`:
- [ ] `test:api` → `pnpm --filter api test`
- [ ] `test:db` (if a DB-only suite is split out later)
- [ ] `test:shared` → `pnpm --filter @capella/shared test` (after Phase 06)
- [ ] `test:storefront` → `pnpm --filter storefront test`
- [ ] `test:erp` → `pnpm --filter erp test`
- [ ] `test:smoke` already exists as `test:staging-smoke`; keep naming consistent.

### Staging fixture script [T1]
- [ ] Add a staging seed/check script that ensures smoke fixtures exist before
      Playwright runs (active product, out-of-stock product, visible OOS offer,
      customer, admin, required category).
- [ ] Missing fixtures **fail early** with a clear error; never silently skip core smoke.

## Out of scope
Actual API/Vitest/Playwright test bodies — those live in their own phases.

## Definition of done
Seed matrix covers the fixture checklist; targeted root scripts run green;
DB-backed tests cannot touch dev/prod data; staging fixture script fails loudly on gaps.
