# Phase 03 — Storefront Vitest

> **Status:** PARTIAL — ~24 Vitest files already exist; this phase is gap-filling, not greenfield.
> **Scope:** "Storefront Happy Paths", "Storefront Edge Cases", relevant A11y/Error sections.
> **Depends on:** 01.

## Goal
Cover storefront component behavior, the cart store, and the API client — the
risky client logic the API layer can't prove.

## Current state (2026-05-30)
- `vitest.config.ts` present (jsdom, `tests/setup.ts` wired). Existing suites include:
  `tests/unit/cart.test.ts`, `api-client.test.ts`, `api-base.test.ts`, `seo.test.ts`,
  `revalidate-route.test.ts`, `next-config.test.ts`, `storefront-static-data.test.ts`,
  `use-product-grid-filters.test.tsx`; `tests/components/*` for product-card, product-detail,
  offer-detail, orders-view, order-page, mobile-filter-drawer, auth-provider, etc.;
  `tests/contracts/storefront-client.contract.test.ts`.
- **Audit task:** treat the checklist below as a gap list — mark already-covered boxes and only
  write tests for the genuinely missing edge cases.

## Cart store [T0]
- [ ] Add product/offer lines; merge same variant; keep distinct variants and product-vs-offer lines separate.
- [ ] Quantity cannot be zero/negative/NaN/fractional/above stock; totals update on change.
- [ ] Persist across refresh; survive route nav and auth changes.
- [ ] Handle stale/missing/invalid localStorage and storage-version changes without crashing.
- [ ] Clears only after successful checkout; not on validation/network/server error.
- [ ] Handle localStorage unavailable/throwing (privacy mode).

## API client [T0/T1]
- [ ] [T0] Define how fetch is mocked; verify URL, method, headers, body, fallback behavior.
- [ ] [T1] Product/offer/category API failures return safe fallback values, not crashes.
- [ ] [T1] Reset modules when testing persisted store init or env-dependent API base resolution.

## Component happy paths [T1]
- [ ] Product listing: products, categories, filters, sort, empty state.
- [ ] Product detail: media, variants, price/range, related items, add-to-cart.
- [ ] Offer listing/detail; cart add/update/remove; checkout success state info.
- [ ] Login/signup forms submit valid payloads and route to expected next state.
- [ ] Breadcrumbs, header/footer links point to valid localized routes.

## Component edge cases [T2]
- [ ] Out-of-stock variant disables add-to-cart; visible OOS offer cannot be purchased.
- [ ] Add-to-cart blocked when no/invalid/inactive/deleted variant selected.
- [ ] Cart handles catalog changes after add (product/variant deleted, offer expired, price/stock changed).
- [ ] Invalid checkout phone/email/address blocks submission; Egyptian phone format enforced.
- [ ] Checkout disables submit in-flight; no duplicate orders on double submit.
- [ ] Product cards show correct price range (one/many/discounted/unavailable variants).
- [ ] Media fallbacks: missing hover/gallery, broken URL, unsupported video — no crash.
- [ ] Mobile filter drawer opens/closes/locks scroll/applies without losing state.
- [ ] Long Arabic/English/mixed LTR-RTL content renders safely.
- [ ] Never renders buying price or admin-only fields.

## A11y / resilience [T2]
- [ ] Critical buttons/links reachable by role/name; required fields have accessible names.
- [ ] Disabled purchase buttons communicate why; loading states recover after failure.
- [ ] Errors are testable (not purely visual); empty states explain next action.

## Definition of done
Cart store [T0] fully covered; API client mock pattern fixed; happy paths green;
no test leaks localStorage/module state between cases.
