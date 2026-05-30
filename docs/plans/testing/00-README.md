# Testing Plan — Phase Index

This is the only live entry point for the testing plan in this directory.
Use the numbered phase files below as the active source of truth for scope,
order, layer, and definition of done.

## How to read these files

Each phase file has: **Status**, **Goal**, **Current state** (what already exists
in the repo as of 2026-05-30), **Scope** (which master-plan section it covers),
**Tasks** (tagged by tier), and **Definition of done**.

The older `playwright-vitest-implementation.md` file is archival only and
should not be used for planning or status tracking.

> **Audit note (2026-05-30):** Phases 01 + 02 were verified against actual test *contents* — all 25
> API test files + the seed + DB helpers were read in full. `[x]` = a real assertion exists, `[ ]` =
> genuine gap, `[~]` = partial. Phases 03/04 (Vitest, ~41 files) and 05 (Playwright) statuses are still
> derived from test *file inventory* + configs + the (fully-read) smoke spec; their per-item checkboxes
> are not yet content-audited.

## Tier tags

Every task is tagged so we protect money/data-integrity paths first and never
chase coverage before critical behavior is safe.

- **[T0]** — Critical. A bug here costs money, leaks data, or corrupts orders.
  Build these first, across all phases, before broadening.
- **[T1]** — Important. Core happy paths and common edge cases.
- **[T2]** — Hardening. Long-tail edge cases, a11y, resilience polish.

## Testing posture: characterization vs TDD

Most of this work writes tests against **already-shipped code**. Those are
**characterization tests** — they document "what it does" and act as a regression
net. Do not pretend they are TDD; they pass on first run by design.

**For all new features and bug fixes from now on, use real TDD** (write the test,
watch it fail, then implement). See the regression rule in Phase 06 and the
`test-driven-development` skill.

## Layer rules

- **API / service / repository / DB** (`node --test` in `apps/api`): most business
  rules and edge cases. Fastest, closest to truth. Do **not** migrate to Vitest.
- **Vitest** (`apps/storefront`, `apps/erp`): component behavior, stores, API
  clients, payload mapping, validation states, UI fallbacks.
- **Playwright local** (repo root, separate local config/suite): a small local real-browser
  integration layer for hydration, routing, storage, auth restoration, and cross-app wiring.
- **Playwright staging** (`tests/e2e/staging/critical`): only critical deployed
  journeys. Small, stable, release-blocking.

## Phase order

| Phase | File | Layer | Depends on |
|-------|------|-------|-----------|
| 01 | [foundation](01-foundation.md) | infra | — |
| 02 | [api](02-api.md) (auth · catalog · checkout · platform · shared contracts) | API | 01 |
| 03 | [storefront-vitest](03-storefront-vitest.md) | Vitest | 01 |
| 04 | [erp-vitest](04-erp-vitest.md) | Vitest | 01 |
| 05A | [playwright-local](05a-playwright-local.md) | E2E local | 01–04 |
| 05B | [playwright-smoke](05-playwright-smoke.md) | E2E staging | 01 |
| 06 | [ci-and-regression](06-ci-and-regression.md) | CI + regression | 02–05A, 05B |

## Tier-0 cut — status after audit (2026-05-30)

Verified by reading actual test contents. Most of the money/data-integrity slice is
**already covered**; the remaining real [T0] gaps are items 3 and 5.

1. ✅ Admin auth protects all `/api/erp`; customer tokens rejected (Phase 02-A).
2. ✅ Checkout recomputes total server-side; ignores spoofed `customerId` (Phase 02-C).
   ⚠️ Minor gap: no negative test feeding a bogus client `total`/`paymentStatus`.
3. ❌ **GAP** — transactional rollback on partial failure + concurrent last-item oversell
   are **not tested** (Phase 02-C). Highest-priority work.
4. ✅ COD orders start `paymentStatus = pending`, verified against DB row (Phase 02-C).
5. ❌ **GAP** — order item snapshots survive later catalog **edits/deletes** is not tested
   (create-time snapshot is) (Phase 02-C).
6. ✅ Public `/api/v1` hides `buyingPrice` (Phase 02-D). ⚠️ product detail 404-on-inactive gap.
7. ✅ Orders cross-customer rejected (Phase 02-C). ⚠️ wishlist cross-customer not tested (Phase 02-A).
8. ✅ Playwright guest-COD smoke exists incl. COD-pending API signal (Phase 05).
