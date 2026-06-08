# Phase 04 — ERP Vitest

> **Status:** PARTIAL — ~17 Vitest files already exist; this phase is gap-filling, not greenfield.
> **Scope:** "ERP Happy Paths", "ERP Edge Cases", relevant A11y/Error sections.
> **Depends on:** 01.

## Goal
Cover ERP forms, store hydration/auth gating, and the admin API client — the
admin-side logic where validation, payload mapping, and failed-save recovery live.

## Current state (2026-05-30)
- `vitest.config.ts` present (jsdom, `maxWorkers: 1`, `tests/setup.ts` wired). Existing suites include:
  `admin-shell`, `admin-list-toolbar`, `category-form`, `category-form-toast`, `offer-form-related`,
  `offers-page`, `products-page`, `product-edit-page`, `order-detail-page`, `orders-page`,
  `sales-page`, `advices-page`, `editor-form-parts`, `form-slug`, `api-base`, `error-messages`.
- **Audit task:** treat the checklist below as a gap list — mark already-covered boxes and only
  write tests for the genuinely missing cases (likely auth-hydration gating, refetch-on-focus, failed-save recovery).

## Repo-state note (2026-06-09)

- This phase still matches the repo directionally.
- The ERP suite exists and has meaningful coverage, but the checklist remains primarily a planned expansion
  and gap-filling list, not a statement that those behaviors are already covered.

## Auth & hydration [T0]
- [ ] Store hydration waits for auth restoration before fetching protected data.
- [ ] Protected pages don't fetch admin data before auth hydration completes.
- [ ] Logout clears protected state; stale data not used after logout.
- [ ] Refetch-on-focus does not overwrite unsaved form edits.

## Admin API client [T0/T1]
- [ ] [T0] Verify admin headers/cookies behavior and API base resolution (server vs browser-like).
- [ ] [T1] Map API validation errors to readable field/toast messages.

## Forms — shared rules [T1]
- [ ] Show validation errors; never submit invalid payloads.
- [ ] Keep user-entered data when a save request fails.
- [ ] Reject whitespace-only bilingual names; handle Arabic-only/English-only/mixed per rules.
- [ ] Prevent double submit while a request is in flight.
- [ ] Slug generated once; does not mutate after edit.

## Product form [T1]
- [ ] Saves bilingual names/desc, variants, prices, stock, status, media, hover image, related items.
- [ ] Variant add/remove/reorder doesn't corrupt remaining rows; stable variant identity on edit.
- [ ] Activation blocked when required fields/variants missing (and usable media if required).
- [ ] Edit preserves existing media + related links when unrelated fields change.

## Offer form [T1]
- [ ] Saves bilingual content, included products/variants, quantities, pricing, stock, media, related items.
- [ ] Reject offer with no items; reject duplicate same-variant lines unless supported.
- [ ] Edit preserves offer item ids; no duplicate items on save (regression: commit `dd81ce1`).
- [ ] Recalculate/validate stock when item quantities change; preserve related rank after reorder.

## Category form [T1]
- [ ] Parent picker shows hierarchy clearly; saves parent/child path.
- [ ] Conflict/validation errors readable; handles parent deleted before save; updates leaf state.

## Lists, trash, advice [T2]
- [ ] Lists search/filter/sort without losing latest store state; filters reset cleanly; Arabic/English/case-insensitive search.
- [ ] Trash restores/permanently-deletes only entities that support the action; modal identifies the entity.
- [ ] Advice form rejects missing title/content and invalid image media.
- [ ] Destructive actions use ids, not array indexes.
- [ ] API failures show recoverable states, not blank pages.

## Definition of done
Auth-gating [T0] covered; admin client base/headers proven; product/offer/category
form happy paths + failed-save recovery green; offer-item-id preservation enforced.
