# Duplication Reduction Plan

## Goal

Reduce real code duplication across `apps/` and `packages/` without changing product behavior.

This file is the current resume point. It records:

1. what is already done
2. the latest measured duplication state
3. what still remains
4. what I was about to do when interrupted

---

## Current Status

Latest confirmed duplication check:

```powershell
npx jscpd apps/ packages/ --threshold 5
```

Latest result:

- Total duplication: `5.74%`
- Clones found: `115`
- Duplicated lines: `1485`

Baseline before this plan work started:

- Total duplication: `10.22%`
- Clones found: `147`
- Duplicated lines: `2672`

Measured progression during this cleanup:

- `10.22%`
- `6.37%`
- `6.26%`
- `6.05%`
- `5.99%`
- `5.92%`
- `5.90%`
- `5.89%`
- `5.81%`
- `5.74%`

So the plan is materially working, but the repo is still above the `5%` target.

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
- `pnpm-lock.yaml`

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

### Wave 3: Shared types, DTOs, and domain shapes

Completed for the order / checkout / payment duplication that was previously identified.

Updated:

- `packages/shared/src/dto/order.dto.ts`
- `packages/shared/src/types/index.ts`
- `apps/api/src/types/domain.ts`

Added compile-time drift checks:

- `packages/shared/src/dto/order.dto.contract.ts`
- `apps/api/src/types/domain.contract.ts`
- `packages/shared/src/types/assert-type-equal.ts`

Important note:

- API runtime tests for this area could not be fully executed in one earlier shell because `DATABASE_URL` was missing there
- compile-time verification for the affected packages did pass

---

### Wave 4 partial: ERP repeated list pages and forms

Partially completed.

Shared admin list-page building blocks created:

- `apps/erp/src/components/admin/admin-list-toolbar.tsx`
- `apps/erp/src/components/admin/admin-status-badge.tsx`
- `apps/erp/src/components/admin/admin-confirm-modal.tsx`

ERP pages already moved onto those shared pieces:

- `apps/erp/src/app/products/page.tsx`
- `apps/erp/src/app/offers/page.tsx`
- `apps/erp/src/app/advices/page.tsx`

Tests already added:

- `apps/erp/tests/admin-list-toolbar.test.tsx`

Existing ERP page tests already updated by behavior-preserving refactor:

- `apps/erp/tests/products-page.test.tsx`
- `apps/erp/tests/offers-page.test.tsx`
- `apps/erp/tests/advices-page.test.tsx`

ERP form work also progressed further:

- `apps/erp/src/components/forms/editor-form-parts.tsx`
  - `BilingualEditorField`
  - `BilingualNameFields`
  - `ImageFieldCard`
  - `EditorActions`

- `apps/erp/src/components/forms/form-slug.ts`
  - `slugifyFormName`

Forms already moved onto those shared pieces:

- `apps/erp/src/components/forms/product-form.tsx`
- `apps/erp/src/components/forms/offer-form.tsx`
- `apps/erp/src/components/forms/category-form.tsx`

Tests already added:

- `apps/erp/tests/editor-form-parts.test.tsx`

---

### Wave 5 partial: Storefront page bootstrapping helpers

Partially completed.

Helpers created:

- `apps/storefront/src/lib/storefront-page-context.ts`
- `apps/storefront/src/components/layout/storefront-page-shell.tsx`
- `apps/storefront/src/lib/storefront-detail-page.tsx`

These already centralize:

- `lang` validation
- dictionary loading
- slug-page context resolution
- repeated breadcrumb/json-ld plumbing
- repeated page shell structure

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
- `apps/storefront/tests/unit/storefront-detail-page.test.tsx`
- `apps/storefront/tests/components/storefront-page-shell.test.tsx`

---

### Wave 6 partial: Product filter duplication cleanup

Partially completed.

Extracted:

- `apps/storefront/src/components/products/product-filter-category-list.tsx`

Updated:

- `apps/storefront/src/components/products/product-filters-content.tsx`
- `apps/storefront/src/components/products/mobile-filter-drawer.tsx`
- `apps/storefront/src/components/products/product-grid-empty-state.tsx`

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

1. ERP form duplication
2. Remaining storefront slug/detail page overlap
3. Remaining product-filter overlap
4. API offer mapper duplication
5. Lower-value support-file duplicates that still inflate the score

---

## Current Hotspots

These are the most relevant remaining hotspots from the latest work and latest `jscpd` output.

### 1. ERP form duplication

Primary files:

- `apps/erp/src/components/forms/product-form.tsx`
- `apps/erp/src/components/forms/offer-form.tsx`
- some overlap with `apps/erp/src/components/forms/category-form.tsx`

Why this matters:

- these are smaller than before, but still among the larger remaining app-level duplicated UI blocks
- the stable name-field and action-footer seams are already extracted
- the shared image-upload side card and shared slug helper are also extracted
- the remaining duplication is now in the offer/product body sections, helper functions like `slugify`, and a few card/table structures

### 2. Remaining storefront detail-page overlap

Primary files:

- `apps/storefront/src/app/[lang]/products/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/offers/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/category/[slug]/page.tsx`

Why this matters:

- helper extraction already reduced these, but there is still overlapping structure left

### 3. Remaining product-filter overlap

Primary files:

- `apps/storefront/src/components/products/mobile-filter-drawer.tsx`
- `apps/storefront/src/components/products/product-filters-content.tsx`

Why this matters:

- still explicitly flagged by `jscpd`

### 4. API offer mapper duplication

Primary files:

- `apps/api/src/modules/admin/offers/admin-offers.mapper.ts`
- `apps/api/src/modules/catalog/offers/offers.mapper.ts`

Why this matters:

- good low-risk extraction candidate after the ERP forms

### 5. Lower-value / noise still inflating the score

Examples:

- `packages/database/drizzle/migrations/meta/0000_snapshot.json`
- repeated tests
- `components.json`
- duplicated icons
- config-file duplication

These should still be treated as lower priority than production-code duplication.

---

## Ignore For Now

These should not drive refactor work:

1. Generated / metadata duplication
   - `packages/database/drizzle/migrations/meta/0000_snapshot.json`
2. Expected test repetition
3. Very small same-file repetition that does not hurt maintainability
4. Config duplication unless the main product-code hotspots are already addressed

---

## Interrupted Next Step

This section records what I was about to do when you stopped me.

### Area I was investigating

ERP form duplication.

Files inspected:

- `apps/erp/src/components/forms/product-form.tsx`
- `apps/erp/src/components/forms/offer-form.tsx`
- `apps/erp/src/components/forms/category-form.tsx`
- related ERP tests:
  - `apps/erp/tests/category-form.test.tsx`
  - `apps/erp/tests/category-form-toast.test.tsx`
  - page tests already in `apps/erp/tests/*`

### What I had confirmed

The safest extraction seam is not a giant generic form abstraction.

The stable repeated pieces appear to be:

1. bilingual content fields
   - Arabic / English paired inputs or textareas
2. bilingual name fields
   - Arabic / English name inputs with inline errors
2. shared form action footer
   - cancel button + save button
3. repeated side-card sections
   - image card
   - summary / helper cards
4. some field wrapper patterns
   - label + input + error blocks

### What has already been done from that interrupted step

1. added a failing ERP test for the shared name-field extraction
2. extracted `BilingualNameFields` into `editor-form-parts.tsx`
3. switched `product-form.tsx`, `offer-form.tsx`, and `category-form.tsx` to it
4. reran targeted ERP tests and `tsc`
5. reran `jscpd`

### What I was planning to do next after that

1. continue reducing the remaining `offer-form.tsx` / `product-form.tsx` overlap
2. likely extract one more stable seam only, such as:
   - shared table/card wrappers if they remain truly identical
   - shared row/summary sections if they remain behaviorally aligned
3. rerun targeted ERP tests and `tsc`
4. rerun `jscpd`

### Important note

The original interrupted step is no longer just investigative.

It has now been partially implemented and verified, but the ERP-form cleanup is still not complete.

---

## Suggested Execution Order From Here

Resume with this order:

1. ERP form duplication
2. API offer mapper duplication
3. remaining storefront detail-page overlap
4. remaining product-filter overlap
5. optional final cleanup for smaller support-file duplicates if still needed

This order is based on the current remaining `jscpd` hotspots, not the original earlier ordering.

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
   - `apps/erp/src/components/forms/product-form.tsx`
   - `apps/erp/src/components/forms/offer-form.tsx`
   - `apps/erp/src/components/forms/category-form.tsx`
3. read nearest existing tests:
   - `apps/erp/tests/category-form.test.tsx`
   - `apps/erp/tests/category-form-toast.test.tsx`
   - `apps/erp/tests/products-page.test.tsx`
   - `apps/erp/tests/offers-page.test.tsx`
4. add the failing test first
5. extract only stable ERP form pieces
6. rerun targeted ERP verification and `jscpd`

---

## Success Criteria

This cleanup is successful if:

1. real duplication is materially reduced again from `5.74%`
2. the repo reaches `5%` or lower, unless the remaining overage is clearly mostly low-value noise
3. shared contracts stop drifting across `packages/shared` and `apps/api`
4. ERP repeated page and form structure is reduced without hurting readability
5. storefront repeated page and filter structure is reduced further where it is actually worth it
