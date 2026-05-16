# Capella Long-Term Testing Program Design

Date: 2026-05-16
Last updated: 2026-05-16 (v3)
Scope decision: **Option 2 (Balanced)**
Program shape: **API-first (A) + Selective Contract Testing (C)**
Release gate strategy: **Minimal required staging smoke + broad PR-required automated checks**

## 1. Purpose

This document defines the long-term testing strategy for Capella across:

- `apps/api` (Express + Drizzle + MySQL)
- `apps/storefront` (Next.js customer app)
- `apps/erp` (Next.js Arabic ERP)
- `packages/shared` (DTOs, schemas, constants, i18n)
- `packages/database` (schema, migrations, seeds, DB access)

The goal is to reduce escaped defects and integration drift while keeping CI fast and maintainable.

## 2. Context and constraints

1. Current maturity is strongest in API tests (`node:test` + `tsx --test` already established in `apps/api/tests`).
2. Six test files already exist as of 2026-05-16:
   - `admin-auth.middleware.test.ts`
   - `admin-auth.service.test.ts`
   - `checkout.schemas.test.ts`
   - `load-workspace-env.test.ts`
   - `uploads.test.ts`
   - `admin-products.repository.test.ts`
3. Frontend test infrastructure does not exist yet and must be introduced incrementally, with a required minimum set committed before v1 ships (see Section 13).
4. `apps/erp` has no `test` script in its `package.json` yet. A placeholder must be added before Stage C or the CI gate for ERP is silently bypassed.
5. `packages/shared` and `packages/database` also lack `test` scripts. Placeholders must be added in Stage A1 so `turbo run test` can reach them.
6. `packages/database` currently contains a local `.env` file that duplicates the workspace root `.env`. The test DB strategy must ensure `.env.test` at workspace root takes precedence, and the local `packages/database/.env` should be removed or explicitly overridden during test runs.
7. Product rules in `docs/storefront-erp-spec.md` include critical behavior that must be protected with regression tests.
8. Option 2 release policy is selected: PR checks are mandatory; staging smoke is mandatory before production; full staging regression is not required at this time.

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

```text
apps/
  api/
    tests/
      unit/
      services/
      repositories/
      routes/
      contracts/
      fixtures/
      helpers/
  storefront/
    tests/
      unit/
      components/
      contracts/
  erp/
    tests/
      unit/
      components/
      contracts/
packages/
  shared/
    tests/
      schemas/
      dto/
      i18n/
      contracts/        # shared contract harness — see Section 14
  database/
    tests/
      repositories/
      migrations/
      seeds/
tests/
  e2e/
    staging/
      critical/
      fixtures/
      helpers/
```

## 6. Tooling and framework decisions

1. Keep `apps/api` on **`node:test` + `assert`**, executed via **`tsx --test`** (already established).
2. Add **Vitest + Testing Library** for `apps/storefront` and `apps/erp` unit/component coverage.
3. Use **Playwright** for staging smoke E2E across storefront + API + ERP.
4. Keep contract source of truth in `packages/shared` schemas/DTOs. Shared contract harness lives in `packages/shared/tests/contracts/` and is called into by both API tests (assert API produces correct shape) and storefront/ERP tests (assert apps consume correct shape and do not render forbidden fields such as `buyingPrice`).
5. Fix `turbo.json` `"test"` task to include `"dependsOn": ["^build"]` before any cross-package tests are added. Without this, `packages/shared` and `packages/database` TypeScript may not be compiled when tests in consuming packages run.
6. Avoid multiple overlapping tools per test layer.
7. For API route integration tests in `apps/api`, use a lightweight HTTP test client. Prefer Node.js native `fetch` wrapped in a small helper (e.g. `tests/helpers/request.ts`) rather than adding `supertest` as a dependency, since Node.js 20+ includes a stable native `fetch` implementation. The helper should accept an Express app instance, send requests, and return parsed JSON responses with status codes.

## 7. Environment strategy and required gates

| Environment | Required checks | Blocking |
|---|---|---|
| Local | targeted tests by changed scope | No |
| PR CI | typecheck, build, API tests, shared/database tests, selective frontend tests | Yes |
| Staging | minimal critical smoke E2E suite | Yes |
| Production | post-deploy smoke (small) | No initially (can be upgraded later) |

## 7.5. CI pipeline

PR-required checks and staging smoke gates (Sections 8 and 9) depend on a CI pipeline. Before Stage A2 test writing begins:

1. **CI provider:** GitHub Actions is the default provider. A `.github/workflows/ci.yml` workflow must be created.
2. **PR workflow:** the workflow triggers on `pull_request` and `push` to `main`. It installs dependencies via `pnpm install --frozen-lockfile`, runs typecheck (`pnpm lint`), build (`pnpm build`), and tests (`pnpm test`).
3. **Test DB in CI:** the workflow starts a MySQL service container using the same image as `docker-compose.test.yml`, sets `TEST_DATABASE_URL` to point to it, and runs the test suite against it.
4. **Staging smoke workflow:** a separate `.github/workflows/staging-smoke.yml` workflow triggers on `workflow_dispatch` or on pushes to a release/staging branch. It runs Playwright against the staging URL and reports results.
5. **Secrets:** CI secrets store `TEST_DATABASE_URL`, JWT secrets, and any cloud credentials required for staging smoke runs.

## 8. PR-required checks

All PRs must pass:

1. Workspace typecheck/lint/build as defined in repo scripts.
2. `apps/api/tests`:
   - unit
   - services
   - repositories
   - routes
   - contracts
3. `packages/shared/tests`:
   - schema and DTO compatibility checks
4. `packages/database/tests`:
   - repository + migration/seed sanity checks
5. `apps/storefront/tests` and `apps/erp/tests`:
   - required minimum component suite (see Section 13) must pass before v1 ships; introduced incrementally until then
   - `apps/erp` must have a `test` placeholder script before Stage C so CI does not silently skip it

## 9. Minimal staging smoke suite (release blocking)

Only critical business flows are mandatory in staging. Each item below is cross-referenced to its matrix row in Section 10.

1. Guest wishlist click shows warning and login redirect link. *(Section 10: guest wishlist warning)*
2. Active-language behavior sends and reflects correct localization path (`x-lang` flow). *(Section 10: x-lang header)*
3. Out-of-stock variant is disabled for add-to-cart. *(Section 10: out-of-stock variant)*
4. Visible out-of-stock offer is visible but purchase is blocked. *(Section 10: visible out-of-stock offer)*
5. Guest checkout is allowed even when email belongs to an existing account. *(Section 10: guest checkout with existing email)*
6. COD order is created with `paymentStatus = pending`. *(Section 10: COD pending status)*
7. Cart persists across page refresh. *(Section 10: cart localStorage persistence)*

## 10. Spec-critical business rule matrix

The following rules are mandatory test coverage. Rows marked **PR + Staging** also appear in the Section 9 smoke suite.

| Rule | Primary test location | Gate |
|---|---|---|
| Egyptian phone number validation | `apps/api/tests/services`, `apps/api/tests/routes` | PR only |
| Offer multi-quantity stock deduction (`2x` same variant) | `apps/api/tests/services`, `apps/api/tests/repositories` | PR only |
| Slug generated once and never mutated | `apps/api/tests/services` | PR only |
| Price range display for multi-variant product | `apps/storefront/tests/components` | PR only |
| Multi-variant price range DTO shape (API produces all variant prices) | `apps/api/tests/contracts` | PR only |
| PDP offer badge when variant is in visible offer | `apps/api/tests/contracts` + `apps/storefront/tests/components` | PR only |
| Guest wishlist warning + redirect link | `apps/storefront/tests/components` + E2E smoke | PR + Staging |
| Wishlist API rejects unauthenticated requests | `apps/api/tests/routes` | PR only |
| `x-lang` header follows active language | `apps/storefront/tests/unit` + `apps/api/tests/routes` + E2E smoke | PR + Staging |
| Out-of-stock variant disables add-to-cart | `apps/storefront/tests/components` + E2E smoke | PR + Staging |
| Visible out-of-stock offer shown, purchase blocked | API + storefront tests + E2E smoke | PR + Staging |
| Visible-but-out-of-stock offer carries explicit stock field in API response | `apps/api/tests/contracts` | PR only |
| Category descendant resolution (e.g., Body Care => all descendants) | `apps/api/tests/routes` | PR only |
| Guest checkout allowed if email already exists | `apps/api/tests/services`, `apps/api/tests/routes` + E2E smoke | PR + Staging |
| Cart localStorage persistence across refresh | `apps/storefront/tests/unit` + E2E smoke | PR + Staging |
| COD starts with `pending` payment status | `apps/api/tests/repositories`, `apps/api/tests/services` + E2E smoke | PR + Staging |
| Order snapshot preserved after later catalog changes | `apps/api/tests/repositories` | PR only |
| Product activation rules enforced server-side (required fields gate) | `apps/api/tests/routes` (ERP routes) | PR only |
| Category delete protection (has products, has active children) | `apps/api/tests/routes` + `apps/erp/tests/components` | PR only |
| Buying price absent from storefront-facing product DTO | `apps/api/tests/contracts` | PR only |
| Soft delete hides records from default lists; trash filter reveals them | `apps/api/tests/routes` | PR only |
| Negative stock blocked at API and DB validation level | `apps/api/tests/services`, `apps/api/tests/repositories` | PR only |
| `isNew` compound logic (manual flag AND created-date threshold) | `apps/api/tests/services` | PR only |
| Image upload rejects wrong type or oversized file (>4MB, non PNG/JPG/WEBP) | `apps/api/tests/services` | PR only |
| Search returns results by query language regardless of active `x-lang` | `apps/api/tests/routes` | PR only |

## 11. Data and fixture strategy

### Test database setup

A dedicated test database is required. The following strategy must be in place before Stage A2 test writing begins:

1. **Separate credentials:** a `.env.test` file at workspace root defines `TEST_DATABASE_URL` pointing to a separate MySQL database (never the dev DB). CI uses its own test DB credentials via environment secrets.
2. **Dockerized MySQL for CI:** `docker-compose.test.yml` spins up a throwaway MySQL instance for CI runs. Local developers may use a local MySQL instance with a dedicated test schema.
3. **Migration before suite:** add a `"pretest": "tsx -e \"require('dotenv').config({ path: '../../.env.test' })\" && drizzle-kit migrate --config=drizzle.config.ts --env TEST_DATABASE_URL` script to `packages/database/package.json`. The `pretest` hook explicitly loads `.env.test` from the workspace root **before** `drizzle-kit migrate` runs, overriding any local `packages/database/.env`. The local `packages/database/.env` should be deleted once `.env.test` is wired, to prevent accidental dev-DB use during test runs. The `apps/api` test script (`tsx --test tests/**/*.test.ts`) does not directly call `pretest`; instead, turbo's `dependsOn: ["^build"]` on the `test` task ensures `packages/database` builds first, and the API test suite loads the test DB URL via its own env setup.
4. **Seed per suite:** deterministic baseline seed data (categories, products, variants, offers, one admin user, one customer) is inserted before the suite and torn down after. Seed data is defined in `packages/database/src/seeds/test.seed.ts`.
5. **Transaction isolation:** where practical, each test wraps DB operations in a transaction that is rolled back after the test. For tests that cannot use transaction isolation (e.g., multi-step checkout flows), explicit setup/teardown deletes are used.
6. **Note on current state:** `admin-products.repository.test.ts` currently hits the real dev DB directly. This must be migrated to the test DB strategy before Stage A2.

### General fixture rules

- Use test factories for readable, minimal setup.
- For external boundaries (upload storage, image service), mock at the service boundary for PR tests.
- Never share fixture state across unrelated test files.

## 12. Naming and test-writing conventions

1. Use behavior-first names, e.g. `should_block_offer_purchase_when_visible_but_out_of_stock`.
2. Follow Arrange/Act/Assert structure.
3. One core behavior per test.
4. Use stable selectors for UI tests (`data-testid`, semantic roles).
5. Keep snapshots minimal and intentional (mainly DTO/schema where useful).

## 13. Required minimum frontend component tests (v1 ship gate)

The following storefront components must have passing tests before v1 ships. This is the non-negotiable minimum; additional coverage is welcome but not required.

| Component | What must be tested |
|---|---|
| `VariantSelector` | Out-of-stock variant renders disabled, add-to-cart blocked |
| `WishlistButton` | Guest click shows warning and renders login redirect link |
| `ProductCard` | Price range displayed correctly when product has multiple variant prices |
| `OfferCard` | Purchase action blocked and out-of-stock state shown when offer is out of stock |
| `CheckoutForm` | Egyptian phone number validation rejects invalid input; required fields block submission |
| Cart (localStorage unit) | Cart state persists across page refresh (matches Section 9 smoke item 7). Tests the `lib/cart.ts` (or equivalent) localStorage wrapper — not a React component. Verifies set/get/clear operations and that serialized state survives a simulated page reload. |

These map directly to spec-critical guards. Absence of any of these tests is a v1 release blocker.

Contract tests must also exist in `apps/storefront/tests/contracts` and `apps/erp/tests/contracts` verifying that each app's DTO consumption matches the shapes produced by the API — one test per entity (product, offer, category) is sufficient. These call into the shared harness in `packages/shared/tests/contracts/`.

## 14. Contract test interface

The shared contract harness in `packages/shared/tests/contracts/` defines the expected DTO shapes for each entity and exports assertion helpers that both the API and frontend test suites import.

Structure:

```text
packages/shared/tests/contracts/
  product.contract.ts      # StorefrontProductDTO shape + forbidden fields (buyingPrice)
  offer.contract.ts        # StorefrontOfferDTO shape + stock field required
  category.contract.ts     # CategoryDTO shape
  index.ts                 # re-exports all contracts
```

Each contract file exports:

1. A Zod schema (or plain shape definition) representing the expected DTO.
2. An `assertConformsTo(dto, contract)` helper that throws on mismatch.
3. A `assertForbiddenFieldsAbsent(dto, forbiddenFields)` helper for leak checks.

**API tests** (`apps/api/tests/contracts/`) call `assertConformsTo` on actual API responses to verify the API produces the right shape.

**Frontend tests** (`apps/storefront/tests/contracts/`, `apps/erp/tests/contracts/`) call `assertForbiddenFieldsAbsent` on the mapped/rendered data to verify apps do not expose forbidden fields.

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

1. Add `.env.test` with `TEST_DATABASE_URL` pointing to a dedicated test MySQL database.
2. Add `docker-compose.test.yml` for CI MySQL instance.
3. Wire `drizzle-kit migrate` into `pretest` script in `packages/database` (see Section 11, item 3 for exact script).
4. Add `packages/database/src/seeds/test.seed.ts` with deterministic baseline data.
5. Fix `turbo.json` `"test"` task to include `"dependsOn": ["^build"]`.
6. Add placeholder `"test"` script to `apps/erp/package.json`.
7. Add placeholder `"test"` scripts to `packages/shared/package.json` and `packages/database/package.json` so `turbo run test` reaches them.
8. Migrate `admin-products.repository.test.ts` off the dev DB onto the test DB strategy.
9. Reorganize existing flat test files into the Section 5 subdirectory layout:
   - `admin-auth.middleware.test.ts` → `tests/unit/`
   - `admin-auth.service.test.ts` → `tests/services/`
   - `checkout.schemas.test.ts` → `tests/unit/`
   - `load-workspace-env.test.ts` → `tests/unit/`
   - `uploads.test.ts` → `tests/services/`
   - `admin-products.repository.test.ts` → `tests/repositories/`
10. Delete `packages/database/.env` once `.env.test` is wired (prevents dev-DB collision during test runs).
11. Set up GitHub Actions CI pipeline: create `.github/workflows/ci.yml` and `.github/workflows/staging-smoke.yml` per Section 7.5.
12. Install frontend test dependencies: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom` in `apps/storefront` and `apps/erp`.

### Stage A2 — Close Phase 14 API gaps

The following 6 test files exist already and are not gaps:
- `admin-auth.middleware.test.ts`
- `admin-auth.service.test.ts`
- `checkout.schemas.test.ts`
- `load-workspace-env.test.ts`
- `uploads.test.ts`
- `admin-products.repository.test.ts`

Remaining gaps to close:

1. Add API tests for customer auth (signup / login / refresh token).
2. Add API tests for category delete protection (has-products, has-active-children).
3. Add API tests for product activation validation (server-side enforcement).
4. Add API tests for wishlist persistence (add / list / remove, auth required) — includes wishlist API auth rejection row from Section 10.
5. Add API tests for checkout stock deduction — variant stock deduction for regular cart items, and offer stock deduction (including multi-quantity variants, e.g. 2x same variant) when an offer is purchased.

### Stage A3 — Verify and stabilize

1. Run full `pnpm lint`, `pnpm test`, `pnpm build` across workspace.
2. Confirm all PR-required checks pass cleanly.
3. Update `docs/bugs/bugs.md` after all remaining fixes.

### Stage B — Contract suites and remaining matrix rows

1. Implement shared contract harness in `packages/shared/tests/contracts/` (see Section 14).
2. Add `apps/api/tests/contracts/` conformance tests for product, offer, category DTOs.
3. Add remaining matrix rows from Section 10 not yet covered (buying price leak, soft delete, negative stock, isNew logic, image upload validation, search language).
4. Add `packages/shared/tests/` schema and DTO compatibility checks.
5. Add `packages/database/tests/` repository + migration sanity checks.

### Stage C — Frontend minimum component tests

1. Confirm `apps/erp/package.json` has a working `test` script (placeholder added in A1, now wire Vitest).
2. Add the 6 required storefront component tests from Section 13.
3. Add `apps/storefront/tests/contracts/` and `apps/erp/tests/contracts/` calling shared harness.
4. Wire storefront and ERP test scripts into PR CI gate.

### Stage D — Staging smoke suite

1. Implement Playwright project targeting staging environment.
2. Implement the 7 smoke flows from Section 9.
3. Make staging smoke a blocking gate before production deploys.

### Stage E — Harden and extend

1. Progressively add non-functional checks (response time thresholds, etc.).
2. Promote post-deploy smoke to blocking once baseline stability is confirmed.
3. Extend matrix and component coverage beyond the required minimum as the codebase grows.

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