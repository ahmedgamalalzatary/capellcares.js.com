# Phase 05A — Playwright Local E2E

> **Status:** NOT STARTED — repo has staging Playwright smoke only; no local browser suite boots the stack in development/CI yet.
> **Scope:** local real-browser critical-path coverage that sits between Vitest and staging smoke.
> **Depends on:** 01 for scripts/fixtures, 02 for API truth, 03–04 for lower-layer coverage.

## Goal
Add a separate local Playwright suite that runs against the repo's own apps and API,
so browser-only regressions are caught before deploy without inflating staging smoke
into a broad regression suite.

## Why this phase exists
- Vitest already covers most component/store/client logic well.
- API `node --test` already covers most business rules at the server layer.
- The current Playwright setup only targets staging, so local changes can still break:
  routing, hydration, browser storage, auth refresh, real form wiring, and cross-app
  integration without being caught until deployed.

This phase fills that gap. It does **not** replace Vitest or API integration tests,
and it does **not** turn staging smoke into a large regression suite.

## Current state (2026-05-31)
- Root `playwright.config.ts` points only at `tests/e2e/staging/critical`.
- There is no local Playwright config, no `webServer` boot orchestration, and no
  repo-level local browser suite under `tests/e2e/local`.
- No root script exists for local Playwright.

## Suite boundary

### What belongs here [T0/T1]
- Real browser flows that depend on:
  - client hydration
  - `localStorage` / `sessionStorage`
  - cookie refresh + access-token restoration
  - Next.js routing/navigation
  - storefront ↔ API wiring
  - ERP auth gating in a real browser

### What does **not** belong here
- Re-testing API business rules already proven in `apps/api/tests`.
- Large matrix coverage better handled in Vitest.
- Slow/destructive admin mutation scenarios unless they are uniquely browser-dependent.

## Config / setup tasks

### Local runner shape [T1]
- [ ] Add a separate Playwright config for local E2E (do not overload the staging config).
- [ ] Use `webServer` or equivalent orchestration to boot the required local processes:
      API, storefront, and ERP when needed.
- [ ] Add root scripts with clear entry points, e.g. `test:e2e:local`.
- [ ] Ensure local E2E uses test-safe env vars and test DB, never dev/prod data.

### Data / env strategy [T1]
- [ ] Decide whether local E2E targets seeded DB state, ephemeral test setup, or a dedicated bootstrap script.
- [ ] Fail early when required local env vars or services are missing; do not silently skip critical local flows.
- [ ] Keep local auth-state files/generated artifacts git-ignored.

### Reusable browser state [T1]
- [ ] Add project fixtures or setup projects for:
      anonymous storefront,
      authenticated customer storefront,
      authenticated ERP admin.
- [ ] Reuse `storageState` where it reduces login repetition without hiding auth bugs.

## Minimum local journeys

### Storefront critical path [T0]
- [ ] Product page loads from local stack.
- [ ] Add product to cart and see it in `/cart`.
- [ ] Cart persists after page reload via real browser storage.
- [ ] Guest checkout succeeds against local API and shows success state.

### Authenticated storefront path [T1]
- [ ] Customer login restores session correctly in browser.
- [ ] Wishlist add/remove works through real auth refresh/access-token flow.
- [ ] Authenticated customer can open `/orders` and view a created order.

### ERP path [T1]
- [ ] Admin login succeeds in browser.
- [ ] One safe protected read page loads after auth hydration.
- [ ] Logout clears protected access and stale page state does not remain usable.

## Rules
- Keep this suite small and critical, but broader than staging smoke.
- Prefer browser-only integration risks over pure UI permutations.
- When a bug can be proven reliably in API or Vitest, test it there first.
- Use local Playwright for cross-layer browser wiring, not as the default place for every regression.

## Definition of done
Repo has a separate local Playwright suite with its own config and scripts; it boots
the local stack safely, covers a small set of true browser-critical journeys, and
complements rather than duplicates Vitest, API tests, or staging smoke.
