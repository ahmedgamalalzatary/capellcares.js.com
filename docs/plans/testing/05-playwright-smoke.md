# Phase 05B — Playwright Staging Smoke

> **Status:** PARTIAL — `smoke.spec.ts` already covers most minimal/core cases; setup & ERP gaps remain.
> **Scope:** "Playwright Smoke", "Staging Smoke Data Decision", "What Not To Do".
> **Depends on:** 01 (staging fixture script).

## Goal
A small, stable, release-blocking set of critical deployed-user journeys. Not a
regression suite — keep it minimal.

Local browser regression coverage belongs in **Phase 05A**, not here. This phase is
only for deployed-environment confidence.

## Current state (2026-05-30)
- Root `playwright.config.ts` (clean): `testDir: tests/e2e/staging/critical`, `baseURL` from
  `STAGING_BASE_URL`, `trace: retain-on-failure`, serial, no retries.
- `test:staging-smoke` runs that dir. **`smoke.spec.ts` already exists** and covers:
  guest wishlist warning, `/en` + `x-lang` sanity, OOS variant/offer blocked, guest checkout with
  existing email, **COD order starts pending (API signal)**, and **cart persists after refresh**.
  All gated by `test.skip` on missing `STAGING_*` env vars.
- **Missing:** projects/fixtures, reusable auth-state (no `storageState` yet), ERP admin smoke,
  pre-flight health check, screenshot/video config.

## Config / setup tasks [T1]
- [ ] Define projects/fixtures: anonymous storefront, customer-authenticated storefront, admin-authenticated ERP.
- [ ] `globalSetup` or project dependencies create reusable auth-state files for admin + customer smoke accounts.
- [ ] Auth-state files generated during the smoke run, git-ignored, scoped to staging/test accounts only.
- [ ] Auth-state setup fails clearly when creds missing or login UI/API broken.
- [ ] Pre-flight: staging API health + one public catalog endpoint respond before browser flows run.
- [ ] Add `screenshot`/`video` on failure to config (currently only `trace`).

## Minimal smoke [T0]
- [x] Storefront product page → add to cart → cart persists after refresh. *(exists)*
- [~] Guest COD checkout succeeds; success state appears. *(guest checkout exists; COD-pending verified via API)*
- [x] Verify a backend signal for the created order. *(COD-pending API check exists)*

## Core smoke [T1]
- [x] Guest wishlist click shows login warning/link. *(exists)*
- [x] Out-of-stock product/offer purchase is blocked. *(exists)*
- [x] `/en` language path and API `x-lang` behavior are sane. *(exists)*
- [ ] ERP login succeeds and one safe admin read path loads (reuse admin `storageState`).
- [ ] Storefront listing/offer/cart/checkout/login/orders pages load without client-side crashes.
- [ ] Authenticated customer can view the new order after checkout (smoke account).

## Optional / later [T2]
- [ ] After stable staging data: ERP create/edit one disposable, clearly-named product or advice.
- [ ] ERP orders page shows the smoke order after checkout.
- [ ] Smoke-created disposable data is safely cleanup-able; no destructive hard-delete on staging.

## Rules
- Fail on real broken critical journeys; skip **only** when explicit required env vars are missing
  (never let smoke "pass" because core env vars are absent).
- Prefer stable seeded slugs/accounts over creating random production-like data.

## Definition of done
Minimal smoke ([T0]) runs green against staging with auth-state reuse and a
backend signal for order creation; missing-env produces a clear skip, not a false pass.
