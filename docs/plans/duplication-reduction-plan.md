# Duplication Reduction Plan

## Goal

Reduce real code duplication across `apps/` and `packages/` without changing product behavior.

This file is the resume point for the next compacted session. It records:

1. what was already completed
2. what still remains
3. the exact next recommended move

---

## Current Status

Latest confirmed duplication check:

```powershell
npx jscpd apps/ packages/ --threshold 5
```

Latest result:

- Total duplication: `6.37%`
- Clones found: `128`
- Duplicated lines: `1630`

Baseline before this plan work started:

- Total duplication: `10.22%`
- Clones found: `147`
- Duplicated lines: `2672`

So the plan is working, but the repo is still above the `5%` target.

---

## What Is Already Done

### Wave 1: Shared UI primitives

Completed.

Shared UI now lives in:

- `packages/shared/src/ui/index.ts`
- `packages/shared/src/ui/utils.ts`
- `packages/shared/src/ui/button.tsx`
- `packages/shared/src/ui/input.tsx`
- `packages/shared/src/ui/label.tsx`
- `packages/shared/src/ui/separator.tsx`
- `packages/shared/src/ui/textarea.tsx`
- `packages/shared/src/ui/badge.tsx`
- `packages/shared/src/ui/card.tsx`
- `packages/shared/src/ui/table.tsx`
- `packages/shared/src/ui/select.tsx`

Duplicated local copies were removed from:

- `apps/erp/src/components/ui/*`
- `apps/storefront/src/components/ui/*`

Related package wiring already done:

- `packages/shared/package.json`
- `packages/shared/tsconfig.json`

Tests already added:

- `apps/storefront/tests/unit/shared-ui.test.tsx`
- `apps/erp/tests/shared-ui.test.tsx`

---

### Wave 2: Shared API base logic

Completed.

Shared API base now lives in:

- `packages/shared/src/api/base.ts`

App clients were updated:

- `apps/erp/src/lib/api/client.ts`
- `apps/storefront/src/lib/api/client.ts`

Deleted duplicated files:

- `apps/erp/src/lib/api/base.ts`
- `apps/storefront/src/lib/api/base.ts`

Tests already updated:

- `apps/erp/tests/api-base.test.ts`
- `apps/storefront/tests/unit/api-base.test.ts`

---

### Wave 5 partial: Storefront page bootstrapping helpers

Partially completed.

Helpers created:

- `apps/storefront/src/lib/storefront-page-context.ts`
- `apps/storefront/src/components/layout/storefront-page-shell.tsx`

These already centralize:

- `lang` validation
- dictionary loading
- repeated breadcrumb/page-shell structure

Pages already moved to these helpers:

- `apps/storefront/src/app/[lang]/layout.tsx`
- `apps/storefront/src/app/[lang]/shop/page.tsx`
- `apps/storefront/src/app/[lang]/products/page.tsx`
- `apps/storefront/src/app/[lang]/offers/page.tsx`
- `apps/storefront/src/app/[lang]/orders/[id]/page.tsx`
- `apps/storefront/src/app/[lang]/products/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/offers/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/category/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/wishlist/page.tsx`
- `apps/storefront/src/app/[lang]/orders/page.tsx`
- `apps/storefront/src/app/[lang]/cart/page.tsx`
- `apps/storefront/src/app/[lang]/checkout/page.tsx`
- `apps/storefront/src/app/[lang]/login/page.tsx`
- `apps/storefront/src/app/[lang]/signup/page.tsx`

Tests already added:

- `apps/storefront/tests/unit/storefront-page-context.test.ts`
- `apps/storefront/tests/components/storefront-page-shell.test.tsx`

---

### Wave 6 partial: Product filter duplication cleanup

Partially completed.

Extracted:

- `apps/storefront/src/components/products/product-filter-category-list.tsx`

Updated:

- `apps/storefront/src/components/products/product-filters-content.tsx`

Related quality fixes already made:

- fallback accessible labels in `mobile-filter-drawer.tsx`
- fallback empty description in `product-grid-empty-state.tsx`

Tests already added or updated:

- `apps/storefront/tests/components/product-filter-category-list.test.tsx`
- `apps/storefront/tests/components/mobile-filter-drawer.test.tsx`
- `apps/storefront/tests/components/product-grid-empty-state.test.tsx`
- existing `ProductGrid` tests remain relevant

---

## What Still Remains

### Remaining high-value duplication

1. Shared contract, DTO, and domain shape duplication
2. ERP repeated list-page structure
3. Storefront slug/detail page pattern duplication that still remains after helper extraction
4. Internal self-duplication in recently split storefront product-filter components
5. A few cross-app duplicated support files like icon sets

---

## Ignore For Now

These should not drive refactor work:

1. Generated / metadata duplication
   - `packages/database/drizzle/migrations/meta/0000_snapshot.json`
2. Expected test repetition
3. Very small same-file repetition that does not hurt maintainability

---

## Remaining Waves

### Wave 3: Shared Types, DTOs, and Domain Shapes

This is the next recommended move.

Current hotspots already identified:

- `packages/shared/src/types/index.ts`
- `packages/shared/src/dto/order.dto.ts`
- `apps/api/src/types/domain.ts`
- `apps/api/src/modules/checkout/checkout.service.ts`
- `apps/api/src/modules/orders/orders.service.ts`

Why this is next:

- it is a real source of drift risk
- it is showing up in duplication results
- the exact files are already investigated

Recommended approach:

1. inventory duplicated order / checkout / payment-related shapes
2. choose one canonical definition in `packages/shared`
3. replace API-local duplicate types with imports where possible
4. keep only truly API-internal types in `apps/api/src/types/domain.ts`

Important:

- do this with TDD first
- preserve runtime behavior
- verify API tests and typechecks before moving on

Suggested first files to touch:

- `packages/shared/src/dto/order.dto.ts`
- `packages/shared/src/types/index.ts`
- `apps/api/src/types/domain.ts`

Likely affected consumers:

- `apps/api/src/modules/checkout/checkout.service.ts`
- `apps/api/src/modules/orders/orders.service.ts`

Targeted verification:

```powershell
pnpm --filter @capella/api test -- tests/services/checkout.service.test.ts
pnpm --filter @capella/api test -- tests/routes/checkout.routes.test.ts
pnpm --filter @capella/api exec tsc --noEmit
pnpm --filter @capella/shared exec tsc -p tsconfig.json --noEmit
npx jscpd apps/ packages/ --threshold 5
```

---

### Wave 4: ERP repeated list pages

Still not started.

Primary hotspots:

- `apps/erp/src/app/products/page.tsx`
- `apps/erp/src/app/offers/page.tsx`
- `apps/erp/src/app/advices/page.tsx`

Likely extraction targets:

- shared list-page header
- shared action blocks
- shared status rendering
- repeated row-action helpers

Constraint:

- do not force a giant generic admin-table abstraction

---

### Wave 5: Remaining storefront page duplication

Partially done, but not finished.

Still worth checking for repeated patterns in:

- `apps/storefront/src/app/[lang]/products/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/offers/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/category/[slug]/page.tsx`

Focus on:

- repeated metadata/data-loading plumbing
- repeated shell setup that can still be shared cleanly

Constraint:

- keep page intent readable

---

### Wave 6: Remaining internal duplication in product-filter components

Partially done, but not finished.

Primary hotspots now:

- `apps/storefront/src/components/products/product-filter-category-list.tsx`
- `apps/storefront/src/components/products/product-filters-content.tsx`

Goal:

- share repeated rendering logic further
- keep mobile/desktop differences limited to layout wrappers

---

## Suggested Execution Order From Here

Resume with this order:

1. Wave 3: shared types / DTOs / domain shapes
2. Wave 4: ERP repeated list pages
3. Wave 5: remaining storefront page duplication
4. Wave 6: remaining internal product-filter duplication
5. optional final cleanup for smaller duplicated support files like icons

---

## Verification Standard Per Wave

At minimum after each wave:

1. run the most targeted tests for the touched area
2. run the relevant app/package typechecks
3. rerun `jscpd`
4. record whether the duplication percentage moved

Use targeted verification first, not full-repo verification after every small edit.

---

## Exact Resume Point For Next Session

Start here:

1. read this file
2. inspect:
   - `packages/shared/src/types/index.ts`
   - `packages/shared/src/dto/order.dto.ts`
   - `apps/api/src/types/domain.ts`
   - `apps/api/src/modules/checkout/checkout.service.ts`
   - `apps/api/src/modules/orders/orders.service.ts`
3. read nearest existing API tests:
   - `apps/api/tests/services/checkout.service.test.ts`
   - `apps/api/tests/routes/checkout.routes.test.ts`
4. add the failing test first
5. implement Wave 3
6. rerun targeted verification and `jscpd`

---

## Success Criteria

This cleanup is successful if:

1. real duplication is materially reduced again from `6.37%`
2. shared contracts stop drifting across `packages/shared` and `apps/api`
3. ERP repeated page structure is reduced without hurting readability
4. storefront repeated page bootstrapping is reduced further where it is actually worth it
5. the repo gets to `5%` or below, unless the remaining overage is mostly low-value noise
