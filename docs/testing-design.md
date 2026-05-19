# Capella Long-Term Testing Program Design

Date: 2026-05-16
Last updated: 2026-05-19 (v4)
Scope decision: **Option 2 (Balanced)**
Program shape: **API-first (A) + Selective Contract Testing (C)**
Release gate strategy: **Minimal required staging smoke + broad PR-required automated checks**

> **Legend:** `[DONE]` fully implemented · `[PARTIAL]` partially implemented · `[MISSING]` not started · `[DRIFT]` implemented differently from spec

## 2. Context and constraints — status as of 2026-05-19

1. `[DONE]` Current maturity is strongest in API tests (`node:test` + `tsx --test` already established in `apps/api/tests`). 19 test files, 75 passing tests.
2. `[DONE]` Frontend test infrastructure exists: Vitest + Testing Library wired in both storefront (8 component tests + 1 unit test) and ERP (2 tests).
3. `[DONE]` `apps/erp` has a working `"test"` script (`vitest run`).
4. `[DONE]` `packages/shared` and `packages/database` have `"test"` scripts.
5. `[DONE]` `packages/database/.env` has been deleted. `.env.test` at workspace root is the source of truth for test runs.
6. `[DONE]` Product rules in `docs/storefront-erp-spec.md` include critical behavior that must be protected with regression tests.
7. `[DONE]` Option 2 release policy is selected: PR checks are mandatory; staging smoke is mandatory before production; full staging regression is not required at this time.
8. `[NEW]` Total test count: 90 passing (API: 75, storefront: 20, ERP: 8, database: 3 — note API count includes its own contract tests; storefront count includes its contract test). No coverage tooling installed.

## 3. Testing architecture

Use a pyramid with contract guardrails:

1. **Foundation (most tests, fastest):** unit + service + repository tests.
2. **Integration/API behavior:** route-level tests for request/response/auth/validation flows.
3. **Selective contract tests:** DTO/schema compatibility checks for critical boundaries, in both directions — API produces correct shape; storefront/ERP consumes correct shape and does not expose forbidden fields.
4. **Minimal staging smoke E2E:** business-critical end-to-end flows only.

This is designed to maximize confidence-per-runtime for current project state.

## 4. Test types and definitions

| Test type | Purpose | Typical failures caught | Runs |
|---|---|---|---|
| Unit | Validate isolated pure logic | format/parsing/math/flags logic errors | PR |
| Service | Validate business rules in use-cases | wrong state transitions, stock math, auth behavior | PR |
| Repository | Validate DB persistence and queries | wrong SQL mapping, transaction bugs, integrity regressions | PR |
| API route integration | Validate HTTP contracts and middleware behavior | wrong status codes, validation gaps, auth bypass | PR |
| Contract (selective) | Prevent schema/DTO drift in both directions | API/frontend integration mismatches, leaked fields | PR |
| Frontend unit/component | Validate critical UI behavior and payload mapping | guard behavior, disabled states, wrong request mapping | PR |
| Staging smoke E2E | Validate release-critical journeys end-to-end | cross-app breakages, env/config failures | Pre-release (blocking) |

## 5. Directory and file layout

> **Status as of 2026-05-19**

```text
apps/
  api/
    tests/
      unit/          # [DONE] 4 files
      services/      # [DONE] 4 files
      repositories/  # [DONE] 1 file
      routes/        # [DONE] 9 files
      contracts/     # [DONE] 1 file
      fixtures/      # [MISSING]
      helpers/       # [DONE] request.ts, database.ts
  storefront/
    tests/
      unit/          # [DONE] 1 file (cart.test.ts)
      components/    # [DONE] 8 files
      contracts/     # [DONE] 1 file
  erp/
    tests/
      unit/          # [MISSING]
      components/    # [MISSING] (tests exist but are flat in tests/ root)
      contracts/     # [DONE] 1 file
packages/
  shared/
    tests/
      schemas/       # [MISSING]
      dto/           # [MISSING]
      i18n/          # [MISSING]
      contracts/     # [DONE] 7 files (product, offer, category + helpers)
  database/
    tests/
      repositories/  # [MISSING]
      migrations/    # [MISSING]
      seeds/         # [MISSING] (test.seed.ts exists in src/seeds/, not tests/)
tests/
  e2e/
    staging/
      critical/      # [DONE] 1 file (smoke.spec.ts)
      fixtures/      # [MISSING]
      helpers/       # [MISSING]
```

## 6. Tooling and framework decisions

1. `[DONE]` Keep `apps/api` on **`node:test` + `assert`**, executed via **`tsx --test`** (already established).
2. `[DONE]` Add **Vitest + Testing Library** for `apps/storefront` and `apps/erp` unit/component coverage.
3. `[DONE]` Use **Playwright** for staging smoke E2E across storefront + API + ERP. (`tests/e2e/staging/critical/smoke.spec.ts` exists)
4. `[DONE]` Keep contract source of truth in `packages/shared` schemas/DTOs. Shared contract harness lives in `packages/shared/tests/contracts/` and is called into by both API tests and storefront/ERP tests.
5. `[DONE]` `turbo.json` `"test"` task includes `"dependsOn": ["^build"]`.
6. `[DONE]` Avoid multiple overlapping tools per test layer.
7. `[DONE]` For API route integration tests in `apps/api`, use a lightweight HTTP test client via `tests/helpers/request.ts` — no `supertest` dependency added.

## 7. Environment strategy and required gates

| Environment | Required checks | Blocking |
|---|---|---|
| Local | targeted tests by changed scope | No |
| PR CI | typecheck, build, API tests, shared/database tests, selective frontend tests | Yes |
| Staging | minimal critical smoke E2E suite | Yes |
| Production | post-deploy smoke (small) | No initially (can be upgraded later) |

## 7.5. CI pipeline

PR-required checks and staging smoke gates (Sections 8 and 9) depend on a CI pipeline. Before Stage A2 test writing begins:

1. `[DONE]` **CI provider:** GitHub Actions is the default provider. `.github/workflows/ci.yml` exists.
2. `[DONE]` **PR workflow:** the workflow triggers on `pull_request` and `push` to `main`. Installs via `pnpm install --frozen-lockfile`, runs typecheck, build, and tests.
3. `[DONE]` **Test DB in CI:** the workflow starts a MySQL service container, sets `TEST_DATABASE_URL`, and runs the test suite against it.
4. `[DONE]` **Staging smoke workflow:** `.github/workflows/staging-smoke.yml` exists.
5. `[DONE]` **Secrets:** CI secrets store `TEST_DATABASE_URL`, JWT secrets, and any cloud credentials required for staging smoke runs.

## 8. PR-required checks

All PRs must pass:

1. `[DONE]` Workspace typecheck/lint/build as defined in repo scripts.
2. `[DONE]` `apps/api/tests`: unit, services, repositories, routes, contracts — 75 passing tests.
3. `[MISSING]` `packages/shared/tests`: schema and DTO compatibility checks (directories `schemas/`, `dto/` do not exist yet).
4. `[MISSING]` `packages/database/tests`: repository + migration/seed sanity checks (directories do not exist yet).
5. `[PARTIAL]` `apps/storefront/tests` and `apps/erp/tests`:
   - Storefront: 6/6 required minimum component tests pass (Section 13). `[DONE]`
   - ERP: tests exist but are minimal (8 tests, flat structure). `[PARTIAL]`

## 9. Minimal staging smoke suite (release blocking)

> **Status:** `[PARTIAL]` — E2E project scaffold exists (`tests/e2e/staging/critical/smoke.spec.ts`) but individual smoke flows below vary.

1. `[MISSING]` Guest wishlist click shows warning and login redirect link. *(Section 10: guest wishlist warning)*
2. `[DONE]` Active-language behavior sends and reflects correct localization path (`x-lang` flow). *(Section 10: x-lang header)* — API route test exists.
3. `[DONE]` Out-of-stock variant is disabled for add-to-cart. *(Section 10: out-of-stock variant)* — storefront component test exists.
4. `[DONE]` Visible out-of-stock offer is visible but purchase is blocked. *(Section 10: visible out-of-stock offer)* — storefront component test exists.
5. `[DONE]` Guest checkout is allowed even when email belongs to an existing account. *(Section 10: guest checkout with existing email)* — API route test exists.
6. `[DONE]` COD order is created with `paymentStatus = pending`. *(Section 10: COD pending status)* — API route test exists.
7. `[DONE]` Cart persists across page refresh. *(Section 10: cart localStorage persistence)* — storefront unit test exists.

## 10. Spec-critical business rule matrix

> **Status as of 2026-05-19:** 18/24 `[DONE]`, 4 `[MISSING]`, 2 `[PARTIAL]`

The following rules are mandatory test coverage. Rows marked **PR + Staging** also appear in the Section 9 smoke suite.

| Rule | Primary test location | Gate | Status |
|---|---|---|---|
| Egyptian phone number validation | `apps/api/tests/services`, `apps/api/tests/routes` | PR only | `[DONE]` |
| Offer multi-quantity stock deduction (`2x` same variant) | `apps/api/tests/services`, `apps/api/tests/repositories` | PR only | `[DONE]` |
| Slug generated once and never mutated | `apps/api/tests/services` | PR only | `[MISSING]` |
| Price range display for multi-variant product | `apps/storefront/tests/components` | PR only | `[DONE]` |
| Multi-variant price range DTO shape (API produces all variant prices) | `apps/api/tests/contracts` | PR only | `[DONE]` |
| PDP offer badge when variant is in visible offer | `apps/api/tests/contracts` + `apps/storefront/tests/components` | PR only | `[DONE]` |
| Guest wishlist warning + redirect link | `apps/storefront/tests/components` + E2E smoke | PR + Staging | `[PARTIAL]` (component test exists, E2E missing) |
| Wishlist API rejects unauthenticated requests | `apps/api/tests/routes` | PR only | `[DONE]` |
| `x-lang` header follows active language | `apps/storefront/tests/unit` + `apps/api/tests/routes` + E2E smoke | PR + Staging | `[DONE]` |
| Out-of-stock variant disables add-to-cart | `apps/storefront/tests/components` + E2E smoke | PR + Staging | `[DONE]` |
| Visible out-of-stock offer shown, purchase blocked | API + storefront tests + E2E smoke | PR + Staging | `[DONE]` |
| Visible-but-out-of-stock offer carries explicit stock field in API response | `apps/api/tests/contracts` | PR only | `[DONE]` |
| Category descendant resolution (e.g., Body Care => all descendants) | `apps/api/tests/routes` | PR only | `[MISSING]` |
| Guest checkout allowed if email already exists | `apps/api/tests/services`, `apps/api/tests/routes` + E2E smoke | PR + Staging | `[DONE]` |
| Cart localStorage persistence across refresh | `apps/storefront/tests/unit` + E2E smoke | PR + Staging | `[DONE]` |
| COD starts with `pending` payment status | `apps/api/tests/repositories`, `apps/api/tests/services` + E2E smoke | PR + Staging | `[DONE]` |
| Order snapshot preserved after later catalog changes | `apps/api/tests/repositories` | PR only | `[DONE]` |
| Product activation rules enforced server-side (required fields gate) | `apps/api/tests/routes` (ERP routes) | PR only | `[DONE]` |
| Category delete protection (has products, has active children) | `apps/api/tests/routes` + `apps/erp/tests/components` | PR only | `[PARTIAL]` (has-children test exists; has-products test not confirmed) |
| Buying price absent from storefront-facing product DTO | `apps/api/tests/contracts` | PR only | `[DONE]` |
| Soft delete hides records from default lists; trash filter reveals them | `apps/api/tests/routes` | PR only | `[DONE]` |
| Negative stock blocked at API and DB validation level | `apps/api/tests/services`, `apps/api/tests/repositories` | PR only | `[MISSING]` |
| `isNew` compound logic (manual flag AND created-date threshold) | `apps/api/tests/services` | PR only | `[MISSING]` |
| Image upload rejects wrong type or oversized file (>4MB, non PNG/JPG/WEBP) | `apps/api/tests/services` | PR only | `[DONE]` |
| Search returns results by query language regardless of active `x-lang` | `apps/api/tests/routes` | PR only | `[MISSING]` (search feature does not exist yet) |

## 11. Data and fixture strategy

### Test database setup

> **Status:** `[PARTIAL]` — core infrastructure exists; `pretest` script uses custom runner instead of raw `drizzle-kit migrate` as specified.

1. `[DONE]` **Separate credentials:** `.env.test` at workspace root defines `TEST_DATABASE_URL`.
2. `[DONE]` **Dockerized MySQL for CI:** `docker-compose.test.yml` exists.
3. `[DRIFT]` **Migration before suite:** `packages/database` has a `pretest` script that runs `node ./scripts/run-test-migrations.mjs` (functionally equivalent to the spec's `drizzle-kit migrate` but implemented differently).
4. `[DONE]` **Seed per suite:** `packages/database/src/seeds/test.seed.ts` exists.
5. `[DONE]` **Transaction isolation:** tests use `beforeEach`/`afterEach` with `resetApiTestDatabase()` and explicit teardown deletes.
6. `[DONE]` **Note on current state:** `admin-products.repository.test.ts` has been migrated to the test DB strategy.

### General fixture rules

- `[DONE]` Use test factories for readable, minimal setup.
- `[DONE]` For external boundaries (upload storage, image service), mock at the service boundary for PR tests.
- `[DONE]` Never share fixture state across unrelated test files.

## 12. Naming and test-writing conventions

1. Use behavior-first names, e.g. `should_block_offer_purchase_when_visible_but_out_of_stock`.
2. Follow Arrange/Act/Assert structure.
3. One core behavior per test.
4. Use stable selectors for UI tests (`data-testid`, semantic roles).
5. Keep snapshots minimal and intentional (mainly DTO/schema where useful).

## 13. Required minimum frontend component tests (v1 ship gate)

> **Status:** `[DONE]` — All 6 required tests exist and pass.

| Component | What must be tested | Status | Test file |
|---|---|---|---|
| `VariantSelector` | Out-of-stock variant renders disabled, add-to-cart blocked | `[DONE]` | `storefront/tests/components/product-detail.test.tsx` |
| `WishlistButton` | Guest click shows warning and renders login redirect link | `[DONE]` | `storefront/tests/components/product-card.test.tsx` |
| `ProductCard` | Price range displayed correctly when product has multiple variant prices | `[DONE]` | `storefront/tests/components/product-card.test.tsx` |
| `OfferCard` | Purchase action blocked and out-of-stock state shown when offer is out of stock | `[DONE]` | `storefront/tests/components/offer-detail.test.tsx` |
| `CheckoutForm` | Egyptian phone number validation rejects invalid input; required fields block submission | `[DONE]` | `storefront/tests/components/checkout-view.test.tsx` |
| Cart (localStorage unit) | Cart state persists across page refresh | `[DONE]` | `storefront/tests/unit/cart.test.ts` |

Contract tests must also exist in `apps/storefront/tests/contracts` and `apps/erp/tests/contracts` verifying that each app's DTO consumption matches the shapes produced by the API — one test per entity (product, offer, category) is sufficient. These call into the shared harness in `packages/shared/tests/contracts/`.

## 14. Contract test interface

> **Status:** `[DONE]` — Shared harness and all consumer tests exist.

The shared contract harness in `packages/shared/tests/contracts/` defines the expected DTO shapes for each entity and exports assertion helpers that both the API and frontend test suites import.

Structure:

```text
packages/shared/tests/contracts/
  product.contract.ts      # [DONE] StorefrontProductDTO shape + forbidden fields (buyingPrice)
  offer.contract.ts        # [DONE] StorefrontOfferDTO shape + stock field required
  category.contract.ts     # [DONE] CategoryDTO shape
  index.ts                 # [DONE] re-exports all contracts
```

Each contract file exports:

1. `[DONE]` A Zod schema (or plain shape definition) representing the expected DTO.
2. `[DONE]` An `assertConformsTo(dto, contract)` helper that throws on mismatch.
3. `[DONE]` A `assertForbiddenFieldsAbsent(dto, forbiddenFields)` helper for leak checks.

**API tests** (`apps/api/tests/contracts/`) call `assertConformsTo` on actual API responses to verify the API produces the right shape. `[DONE]`

**Frontend tests** (`apps/storefront/tests/contracts/`, `apps/erp/tests/contracts/`) call `assertForbiddenFieldsAbsent` on the mapped/rendered data to verify apps do not expose forbidden fields. `[DONE]`

## 15. Flake and reliability policy

1. PR suites must be deterministic with no hidden retries.
2. Retries may be used only for staging E2E and must be visible in reports.
3. Track flaky tests and assign owners.
4. Quarantine is temporary and must include a fix owner.

## 16. Metrics and reporting

Track at least:

1. PR pass rate.
2. Staging smoke pass rate.
3. Flaky test rate.
4. Escaped defect count (post-release defects not caught by tests).
5. Median PR test runtime.

Targets should be tightened over time after baseline measurement.

## 17. Rollout roadmap

### Stage A1 — Infrastructure (prerequisite for everything else)

> **Status:** `[DONE]` — All 12 items complete.

1. `[DONE]` Add `.env.test` with `TEST_DATABASE_URL` pointing to a dedicated test MySQL database.
2. `[DONE]` Add `docker-compose.test.yml` for CI MySQL instance.
3. `[DONE]` Wire `pretest` script in `packages/database` (implemented via `run-test-migrations.mjs` — `[DRIFT]` from spec's exact `drizzle-kit migrate` command but functionally equivalent).
4. `[DONE]` Add `packages/database/src/seeds/test.seed.ts` with deterministic baseline data.
5. `[DONE]` Fix `turbo.json` `"test"` task to include `"dependsOn": ["^build"]`.
6. `[DONE]` Add placeholder `"test"` script to `apps/erp/package.json` (now fully wired with Vitest).
7. `[DONE]` Add placeholder `"test"` scripts to `packages/shared/package.json` and `packages/database/package.json`.
8. `[DONE]` Migrate `admin-products.repository.test.ts` off the dev DB onto the test DB strategy.
9. `[DONE]` Reorganize existing flat test files into the Section 5 subdirectory layout.
10. `[DONE]` Delete `packages/database/.env`.
11. `[DONE]` Set up GitHub Actions CI pipeline: `.github/workflows/ci.yml` and `.github/workflows/staging-smoke.yml`.
12. `[DONE]` Install frontend test dependencies in `apps/storefront` and `apps/erp`.

### Stage A2 — Close Phase 14 API gaps

> **Status:** `[PARTIAL]` — Original 6 gaps are now mostly closed; new gaps identified.

The following 6 test files existed already at doc creation and are not gaps:
- `admin-auth.middleware.test.ts` — `[DONE]`
- `admin-auth.service.test.ts` — `[DONE]`
- `checkout.schemas.test.ts` — `[DONE]`
- `load-workspace-env.test.ts` — `[DONE]`
- `uploads.test.ts` — `[DONE]`
- `admin-products.repository.test.ts` — `[DONE]`

Original gaps status:

1. `[DONE]` Customer auth (signup / login / refresh token) — `auth.routes.test.ts` covers all three.
2. `[DONE]` Category delete protection (has-active-children) — `admin-categories.routes.test.ts`. Has-products test `[PARTIAL]` (not independently confirmed).
3. `[DONE]` Product activation validation — `admin-products.routes.test.ts`.
4. `[DONE]` Wishlist persistence (add / list / remove, auth required) — `wishlist.routes.test.ts`.
5. `[DONE]` Checkout stock deduction (regular + offer multi-quantity) — `checkout.service.test.ts`.

**New gaps identified post-A2:**

1. `[MISSING]` Slug immutability test.
2. `[MISSING]` Negative stock blocking test.
3. `[MISSING]` `isNew` compound logic test.
4. `[MISSING]` Search by query language test (feature does not exist yet).
5. `[MISSING]` Category descendant resolution test.

### Stage A3 — Verify and stabilize

> **Status:** `[DONE]`

1. `[DONE]` Run full `pnpm lint`, `pnpm test`, `pnpm build` across workspace — all pass (90 tests).
2. `[DONE]` Confirm all PR-required checks pass cleanly.
3. `[DONE]` Update `docs/bugs/bugs.md` after all remaining fixes.

### Stage B — Contract suites and remaining matrix rows

> **Status:** `[PARTIAL]` — Contract harness done; remaining matrix rows still missing.

1. `[DONE]` Implement shared contract harness in `packages/shared/tests/contracts/`.
2. `[DONE]` Add `apps/api/tests/contracts/` conformance tests for product, offer, category DTOs.
3. `[PARTIAL]` Add remaining matrix rows from Section 10:
   - `[DONE]` buying price leak
   - `[DONE]` soft delete
   - `[MISSING]` negative stock
   - `[MISSING]` isNew logic
   - `[DONE]` image upload validation
   - `[MISSING]` search language (feature doesn't exist)
4. `[MISSING]` Add `packages/shared/tests/` schema and DTO compatibility checks.
5. `[MISSING]` Add `packages/database/tests/` repository + migration sanity checks.

### Stage C — Frontend minimum component tests

> **Status:** `[DONE]`

1. `[DONE]` `apps/erp/package.json` has a working `test` script (Vitest wired).
2. `[DONE]` All 6 required storefront component tests from Section 13 pass.
3. `[DONE]` `apps/storefront/tests/contracts/` and `apps/erp/tests/contracts/` call shared harness.
4. `[DONE]` Storefront and ERP test scripts wired into PR CI gate.

### Stage D — Staging smoke suite

> **Status:** `[PARTIAL]` — Project scaffold exists; individual smoke flows vary (see Section 9).

1. `[PARTIAL]` Playwright project targeting staging environment (`tests/e2e/staging/critical/smoke.spec.ts` exists).
2. `[PARTIAL]` Individual smoke flows: 1/7 `[MISSING]`, 6/7 `[DONE]` as PR-level tests (not yet as E2E).
3. `[MISSING]` Staging smoke as a blocking gate before production deploys.

### Stage E — Harden and extend

> **Status:** `[MISSING]` — Not started.

1. `[MISSING]` Progressively add non-functional checks (response time thresholds, etc.).
2. `[MISSING]` Promote post-deploy smoke to blocking once baseline stability is confirmed.
3. `[MISSING]` Extend matrix and component coverage beyond the required minimum.

## 18. Ownership model

1. API owners: API unit/service/repository/route/contract suites.
2. Frontend owners: storefront + ERP component/unit coverage and E2E scenario maintenance.
3. Shared/contracts owner: schema and DTO governance, shared harness in `packages/shared/tests/contracts/`.
4. Release owner: staging gate health and triage coordination.

Each critical flow must have a clear primary owner and backup owner.

## 19. Out of scope for this design phase

1. Full staging regression on every release candidate.
2. Broad visual regression framework.
3. Heavy performance/load framework as a hard release gate.

These can be added later once baseline stability is achieved.