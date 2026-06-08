# Phase 05B — Playwright Staging Smoke

> **Status:** NOT CURRENTLY PRESENT — Playwright config/script remain, but the staging smoke suite
> referenced by them is missing from the current working tree.
> **Scope:** "Playwright Smoke", "Staging Smoke Data Decision", "What Not To Do".
> **Depends on:** 01 (staging fixture script).

## Goal
A small, stable, release-blocking set of critical deployed-user journeys. Not a
regression suite — keep it minimal.

Local browser regression coverage belongs in **Phase 05A**, not here. This phase is
only for deployed-environment confidence.

## Current state (2026-06-09)
- Root `playwright.config.ts` still points at `tests/e2e/staging/critical`, with `baseURL` from
  `STAGING_BASE_URL` and `trace: retain-on-failure`.
- Root `package.json` still exposes `test:staging-smoke`.
- The referenced `tests/e2e/staging/critical` directory is currently missing from the repo.
- That means the earlier smoke-spec inventory should be treated as stale historical planning context,
  not as current executable coverage.
- **Missing:** the smoke suite itself, reusable auth-state, ERP admin smoke, pre-flight health checks,
  and screenshot/video config.

## Config / setup tasks [T1]
- [ ] Define projects/fixtures: anonymous storefront, customer-authenticated storefront, admin-authenticated ERP.
- [ ] `globalSetup` or project dependencies create reusable auth-state files for admin + customer smoke accounts.
- [ ] Auth-state files generated during the smoke run, git-ignored, scoped to staging/test accounts only.
- [ ] Auth-state setup fails clearly when creds missing or login UI/API broken.
- [ ] Pre-flight: staging API health + one public catalog endpoint respond before browser flows run.
- [ ] Add `screenshot`/`video` on failure to config (currently only `trace`).

## Minimal smoke [T0]
- [ ] Storefront product page → add to cart → cart persists after refresh.
- [ ] Guest COD checkout succeeds; success state appears.
- [ ] Verify a backend signal for the created order.

## Core smoke [T1]
- [ ] Guest wishlist click shows login warning/link.
- [ ] Out-of-stock product/offer purchase is blocked.
- [ ] `/en` language path and API `x-lang` behavior are sane.
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
