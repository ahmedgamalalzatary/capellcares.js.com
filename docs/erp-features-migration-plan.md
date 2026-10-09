# ERP → `src/features/**` Migration Plan

Scope: `apps/erp` only. Audited against the working tree on 2026-10-09 (branch `main`, after `2375efe`).
Audience: the engineer/AI executing the migration. Read this whole file first, then `AGENTS.md` (repo root),
`apps/erp/DESIGN.md`, and `apps/erp/REDESIGN.md` (user rules: pages always full width, Arabic copy, tokens only).

> **Revision (2026-10-09, later):** route pages stay in `src/app/**`. Only each feature's `components/`, `hooks/`,
> `lib/` and `types.ts` move into `src/features/<feature>/`. Pages are not moved and are not turned into re-exports;
> they import their feature's building blocks by absolute path. Every `app/…/page.tsx → features/…` row below is
> therefore obsolete and the page is kept where it is.

---

## 0. Goals and non-goals

**Goals**

1. Every domain's components, hooks, helpers and types live under one folder `src/features/<feature>/`.
2. `src/app/**` keeps the route pages. A page is not moved; it imports its feature's `components/`, `hooks/`, `lib/`
   and `types.ts` by absolute path.
3. Code used by two or more features lives in the shared layer (`components/ui`, `components/admin`, `components/forms`,
   `hooks`, `lib`). Duplicated code is folded into that layer.
4. `tests/**` mirrors the source it exercises. Feature component/hook/lib tests live at
   `tests/features/<feature>/...` (e.g. `src/features/products/components/products-table.tsx` →
   `tests/features/products/components/products-table.test.tsx`). Page tests stay with their feature under
   `tests/features/<feature>/`.
5. Behaviour, Arabic copy, `data-testid`s, routes and permissions stay unchanged, except where §9 says otherwise.

**Non-goals (do NOT do)**

- No visual or redesign changes. The redesign is finished (see `REDESIGN.md`).
- No splitting of the global store (`lib/store/*`). It is one shared `ErpStore` instance used everywhere and stays in `lib/`.
- No barrel `index.ts` files per feature, no path aliases per feature, and no new libraries. Import files directly by path.
- No moving of route pages out of `src/app/**`. Pages stay where Next.js needs them.
- No API or `@capella/shared` changes.
- No commits unless the user explicitly asks (see `AGENTS.md`).

---



## 1. Pre-flight (Phase 0)

1. Establish the baseline. Run these from `apps/erp`, one at a time, never in parallel:
  ```
   pnpm typecheck      # = tsc --noEmit (this is also the package's "lint")
   pnpm test           # vitest run
   pnpm build          # next build --webpack
  ```
   From the repo root, also run `pnpm exec eslint apps/erp` (root `eslint.config.mjs`, rule: no unused vars).
   Everything must be green before you start. If something is red, report it to the user before changing anything.
2. Record the test count (`pnpm test` summary). Every later phase must end with the **same or a higher** count of passing
  tests. A lower count means a test was lost or silently skipped.

---



## 2. Rules for the new layout

```
src/
  app/                      routes only (Next App Router). Each page.tsx re-exports a feature page.
  features/<feature>/
    <feature>-page.tsx      route-level view(s) (list page, new page, edit page…)
    components/             components used only by this feature
    hooks/                  hooks used only by this feature
    lib/                    pure helpers / constants used only by this feature
    types.ts                types used only by this feature (one file; split only if > ~150 lines)
  components/
    ui/                     primitives (unchanged role)
    admin/                  cross-feature admin building blocks (list header, confirm modal, stepper, editor layout…)
    forms/                  cross-feature form parts & media fields (NOT entity forms)
    shell/, providers/      app chrome
  hooks/                    cross-feature hooks
  lib/                      cross-feature logic: api, store, format, permissions, errors, theme…
tests/                      mirrors src/ 1:1 (same folders, `<file>.test.ts(x)`)
```

Import rules:

- `features/A` must not import from `features/B`. **Only exception:** `features/offers` and `features/collections`
may import `features/bundles` (§5.4).
- The shared layer (`components/ui|admin|forms`, `hooks`, `lib`) must never import from `features/**`.
- `components/shell/admin-shell.tsx` is app composition. It may import `features/orders/components/order-review-flag-alerts`,
and this is the only shell→feature import.
- Use `@/…` absolute imports everywhere. Replace the existing relative ones (`app/trash/page.tsx` uses `../../components/...`).
Relative `./x` is fine inside the same folder.
- Promotion rule: code used by **one** feature goes in that feature. Code used by **two or more** features goes in the
shared layer. Do not create shared code "just in case".

Page rule: route pages stay in `src/app/**` (all are client components with `"use client"`). A page imports its
feature's building blocks by absolute path, e.g.:

```tsx
// src/app/products/page.tsx
import { ProductsTable } from "@/features/products/components/products-table";
```

`src/app/orders/[id]/page.tsx` is an async server component that unwraps `params`; it imports
`@/features/orders/components/order-details-view`. Keep `src/app/layout.tsx`, `src/app/page.tsx` (redirect),
`src/app/globals.css` and `src/app/api/health/route.ts` where they are.

---



## 3. Target features (14) and full file move map

`→` means move with `git mv`, which keeps the history. "NEW" means create the file. "DELETE" means remove it.
Paths are relative to `apps/erp/src/`. **Route pages are not moved** (see the Revision note): every
`app/…/page.tsx → features/…` row below is obsolete and the page stays in `src/app/`.

### 3.1 `features/auth`


Nothing moves for auth: the login view stays at `src/app/login/page.tsx`.




### 3.2 `features/dashboard`


| From                                        | To                                                   |
| ------------------------------------------- | ---------------------------------------------------- |
| `components/dashboard/attention-strip.tsx`  | `features/dashboard/components/attention-strip.tsx`  |
| `components/dashboard/catalog-health.tsx`   | `features/dashboard/components/catalog-health.tsx`   |
| `components/dashboard/ending-discounts.tsx` | `features/dashboard/components/ending-discounts.tsx` |
| `components/dashboard/new-menu.tsx`         | `features/dashboard/components/new-menu.tsx`         |
| `components/dashboard/sales-pulse.tsx`      | `features/dashboard/components/sales-pulse.tsx`      |
| `components/dashboard/stock-alerts.tsx`     | `features/dashboard/components/stock-alerts.tsx`     |
| `components/dashboard/top-sellers.tsx`      | `features/dashboard/components/top-sellers.tsx`      |
| `lib/dashboard.ts`                          | `features/dashboard/lib/metrics.ts`                  |




### 3.3 `features/products`


| From                                     | To                                                |
| ---------------------------------------- | ------------------------------------------------- |
| `components/products-table.tsx`          | `features/products/components/products-table.tsx` |
| `components/forms/product-form.tsx`      | `features/products/components/product-form.tsx`   |
| `hooks/use-products-page.ts`             | `features/products/hooks/use-products-page.ts`    |
| `hooks/forms/use-product-form.ts`        | `features/products/hooks/use-product-form.ts`     |
| `types/forms/product-form.types.ts`      | `features/products/types.ts`                      |


`ProductMediaUpload` is a 3-line wrapper inside `components/forms/entity-media-upload.tsx`. It stays in the shared
media file (see §3.15) because it is just `EntityMediaUpload` with a fixed label. Do not split it out.

### 3.4 `features/offers`


| From                                   | To                                            |
| -------------------------------------- | --------------------------------------------- |
| `components/offers-table.tsx`          | `features/offers/components/offers-table.tsx` |
| `components/forms/offer-form.tsx`      | `features/offers/components/offer-form.tsx`   |
| `hooks/forms/use-offer-form.ts`        | `features/offers/hooks/use-offer-form.ts`     |
| `types/forms/offer-form.types.ts`      | `features/offers/types.ts`                    |




### 3.5 `features/collections`

Same shape as offers:


| From                                        | To                                                      |
| ------------------------------------------- | ------------------------------------------------------- |
| `components/collections-table.tsx`          | `features/collections/components/collections-table.tsx` |
| `components/forms/collection-form.tsx`      | `features/collections/components/collection-form.tsx`   |
| `hooks/forms/use-collection-form.ts`        | `features/collections/hooks/use-collection-form.ts`     |
| `types/forms/collection-form.types.ts`      | `features/collections/types.ts`                         |




### 3.6 `features/bundles` (created in Phase 4, holds code shared by offers and collections)

See §5.4. It starts empty and is only created when that phase runs.

### 3.7 `features/categories`


| From                                                                          | To                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| `app/categories/page.tsx` ↳ inner `Tree`, `TreeSkeleton`, `CountPill`         | `features/categories/components/category-tree.tsx`      |
| `app/categories/page.tsx` ↳ `categoryParentKey`, `buildPersistedCategoryOrders` | `features/categories/lib/category-order.ts`           |
| `components/forms/category-form.tsx`                                          | `features/categories/components/category-form.tsx`      |
| `hooks/use-collapsed-categories.ts`                                           | `features/categories/hooks/use-collapsed-categories.ts` |


`components/forms/category-picker.tsx` is used by the product, offer and collection forms, so it **stays shared**.
`lib/category-tree.ts` also stays shared.

### 3.8 `features/advices`


| From                                                   | To                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `app/advices/page.tsx` ↳ inline table (lines ~126–210) | `features/advices/components/advices-table.tsx` (same shape as products/offers tables) |
| `components/forms/advice-form.tsx`                     | `features/advices/components/advice-form.tsx`                                          |




### 3.9 `features/staff`


| From                                                                          | To                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `app/staff/page.tsx` ↳ inline table                                           | `features/staff/components/staff-table.tsx`                                     |
| `app/staff/[id]/edit/page.tsx` ↳ `toFormState`                                | `features/staff/lib/staff-form-state.ts` (together with `createEmptyStaffForm`) |
| `components/admin/staff-editor-form.tsx`                                      | `features/staff/components/staff-editor-form.tsx`                               |
| `components/admin/staff-editor-form.tsx` ↳ types `StaffUser`, `StaffFormState` | `features/staff/types.ts`                                                      |




### 3.10 `features/orders`


| From                                             | To                                                          |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `app/orders/page.tsx` ↳ inline table             | `features/orders/components/orders-table.tsx`               |
| `components/orders/order-details-view.tsx`       | `features/orders/components/order-details-view.tsx`         |
| `components/orders/shipping-actions.tsx`         | `components/admin/shipping-actions.tsx` (shared, see §3.11) |
| `components/orders/order-review-flag-alerts.tsx` | `features/orders/components/order-review-flag-alerts.tsx`   |


`app/orders/[id]/page.tsx` stays a server wrapper and imports `@/features/orders/components/order-details-view`.

### 3.11 `features/shipping`


| From                                                      | To                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `app/shipping/page.tsx` ↳ inline shipments table          | `features/shipping/components/shipments-table.tsx`          |
| `app/shipping/page.tsx` ↳ `SECTIONS`, `AlertLine`         | stay in `app/shipping/page.tsx` unless the table needs them |


`ShippingActions` is used by `features/orders` (order details) **and** `features/shipping`. By the rule in §2 it is
shared, so it lives in `components/admin/shipping-actions.tsx`.

### 3.12 `features/sales`


Nothing moves for sales: the page and its `Metric` / `TableEmpty` helpers stay in `src/app/sales/page.tsx`.




### 3.13 `features/reviews`


| From                                                          | To                                              |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `app/reviews/page.tsx` ↳ inline table + `Stars`, `entityLabel` | `features/reviews/components/reviews-table.tsx` |




### 3.14 `features/discounts`, `features/shop-media`, `features/trash`


| From                                                                          | To                                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `app/discounts/page.tsx` ↳ `SelectionGroup`                                   | `features/discounts/components/selection-group.tsx`                                                |
| `app/discounts/page.tsx` ↳ `inCategory`, `toggleId`, `previewPrice`           | `features/discounts/lib/discount.ts` (`inCategory` is replaced, see §5.2)                          |
| `app/products/[id]/discount/page.tsx` ↳ `toDateTimeLocal`, `toIsoOrEmpty`, `buildDiscountState` | `features/discounts/lib/discount.ts`                                             |
| `app/shop-media/page.tsx` ↳ `toEditableSection`, `isDetailTargetType`, editable types | `features/shop-media/lib/editable-section.ts` + `features/shop-media/types.ts`             |
| `app/shop-media/page.tsx` ↳ section editor / announcement editor JSX blocks   | `features/shop-media/components/*.tsx` (split only where the page has clear self-contained blocks) |
| `hooks/use-collapsed-shop-media.ts`                                           | `features/shop-media/hooks/use-collapsed-shop-media.ts`                                            |
| `hooks/use-collapsed-shop-media-items.ts`                                     | `features/shop-media/hooks/use-collapsed-shop-media-items.ts`                                      |
| `components/trash/deleted-list.tsx`                                           | `features/trash/components/deleted-list.tsx`                                                       |
| `hooks/use-trash-page.ts`                                                     | `features/trash/hooks/use-trash-page.ts`                                                           |
| `types/trash-page.types.ts`                                                   | `features/trash/types.ts`                                                                          |


Why the product discount page goes in `discounts`: it shares the percentage/fixed and datetime-local logic with the bulk
page. Its route and its permission (`products.discount`) do not change.

### 3.15 Shared layer: what stays, what moves, what is new


| Path                                                                                                                                                                                          | Action                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui/*`                                                                                                                                                                             | stay. `card.tsx`: delete unused `CardFooter`. `thumb.tsx`: `resolveMediaSrc` moves to `lib/media.ts` (§5.3)                                                                                                                                                                              |
| `components/admin/admin-confirm-modal.tsx`, `admin-list-header.tsx`, `editor-layout.tsx`, `erp-forbidden-state.tsx`, `form-save-bar.tsx`, `stepper.tsx`                                       | stay                                                                                                                                                                                                                                                                                     |
| `components/admin/shipping-actions.tsx`                                                                                                                                                       | NEW location (from `components/orders/`, see §3.11)                                                                                                                                                                                                                                      |
| `components/admin/list-table.tsx`                                                                                                                                                             | NEW (§5.1)                                                                                                                                                                                                                                                                               |
| `components/admin/permission-gate.tsx`                                                                                                                                                        | NEW (§5.5)                                                                                                                                                                                                                                                                               |
| `components/admin/fold-button.tsx`                                                                                                                                                            | NEW (from `shop-media` `FoldButton`, also used by the categories tree)                                                                                                                                                                                                                   |
| `components/forms/editor-form-parts.tsx`, `category-picker.tsx`, `related-items-field.tsx`, `hover-image-upload.tsx`, `media-frame.tsx`, `entity-media-upload.tsx`, `single-image-field.tsx` | stay (shared by 2+ features)                                                                                                                                                                                                                                                             |
| `components/forms/product-media-upload.tsx`                                                                                                                                                   | DONE (Phase 1): deleted. Its `EntityMediaUpload` implementation was renamed into `entity-media-upload.tsx`, which keeps the `ProductMediaUpload` wrapper |
| `components/forms/form-slug.ts`                                                                                                                                                               | → `lib/slug.ts` (not a component)                                                                                                                                                                                                                                                        |
| `components/forms/related-options.ts`                                                                                                                                                         | → `lib/related-options.ts` (not a component; used by 6 pages)                                                                                                                                                                                                                            |
| `components/providers/*`, `components/shell/*`                                                                                                                                                | stay                                                                                                                                                                                                                                                                                     |
| `hooks/use-table-sort.ts`, `use-list-reorder.ts`, `use-collapsed-set.ts`, `use-media-query.ts`                                                                                                | stay                                                                                                                                                                                                                                                                                     |
| `hooks/forms/use-hover-image-fields.ts`                                                                                                                                                       | → `hooks/use-hover-image-fields.ts` (shared by 3 form hooks; the `hooks/forms/` folder is then empty → delete)                                                                                                                                                                           |
| `lib/theme.ts`                                                                                                                                                                                | stays (`useThemePreference` is tiny and tightly paired with `theme-script.ts`; moving it adds churn for nothing)                                                                                                                                                                         |
| `lib/payment-status.ts`                                                                                                                                                                       | stays (used by orders, shipping, sales, dashboard)                                                                                                                                                                                                                                       |
| `lib/format.ts`                                                                                                                                                                               | add date helpers (§5.2)                                                                                                                                                                                                                                                                  |
| `lib/category-tree.ts`                                                                                                                                                                        | add `isInCategoryTree` (§5.2)                                                                                                                                                                                                                                                            |
| `lib/media.ts`                                                                                                                                                                                | NEW: `resolveMediaSrc` (§5.3)                                                                                                                                                                                                                                                            |
| `lib/api`, `lib/store*`, `lib/errors.ts`, `lib/erp-permissions.ts`, `lib/utils.ts`, `lib/theme-script.ts`                                                                                     | stay                                                                                                                                                                                                                                                                                     |
| `types/`                                                                                                                                                                                      | DELETE folder once empty                                                                                                                                                                                                                                                                 |
| `styled-jsx.d.ts`                                                                                                                                                                             | DELETE (no file uses `<style jsx>`; approved, §9 D6)                                                                                                                                                                                                                                     |
| `lib/stock.ts`                                                                                                                                                                                | NEW: `LOW_STOCK_LIMIT = 5`, shared by products and dashboard (§9 D1)                                                                                                                                                                                                                     |




---



## 4. Test move map (`apps/erp/tests/` → mirrored)

Rule: one test file per source file it mainly exercises, at the mirrored path. Feature component/hook/lib tests live
under `tests/features/<feature>/...`. Page tests stay with their feature under `tests/features/<feature>/`
even though the page itself lives in `src/app/`; every page-test row's import is `@/app/<route>/page` (pages are not
moved), not `@/features/...`. `tests/setup.ts` stays where it is (`vitest.config.ts` → `setupFiles: ["./tests/setup.ts"]`).
Vitest's default `include` already picks up nested folders, so no config change is needed.


| Current test                                              | New path                                                                                                                                                                          | Also update                                                                                                                                                                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-list-header.test.tsx`                              | `tests/components/admin/admin-list-header.test.tsx`                                                                                                                               | —                                                                                                                                                                                                                                         |
| `admin-shell.test.tsx`                                    | `tests/components/shell/admin-shell.test.tsx`                                                                                                                                     | —                                                                                                                                                                                                                                         |
| `advices-page.test.tsx`                                   | `tests/features/advices/advices-page.test.tsx`                                                                                                                                    | import `@/features/advices/advices-page`                                                                                                                                                                                                  |
| `api-client-auth.test.ts`                                 | `tests/lib/api/client.test.ts`                                                                                                                                                    | —                                                                                                                                                                                                                                         |
| `bundle-form-hover-image.test.tsx`                        | `tests/features/bundles/bundle-form-hover-image.test.tsx` (before Phase 4: `tests/features/offers/`)                                                                              | form/hook import paths; remove stale mock `@/components/ui/icons`                                                                                                                                                                         |
| `bundle-form-item-reorder.test.tsx`                       | same folder as above                                                                                                                                                              | form import paths                                                                                                                                                                                                                         |
| `bundles-reorder.test.tsx`                                | split: `tests/features/offers/offers-page.reorder.test.tsx` + `tests/features/collections/collections-page.reorder.test.tsx`, or keep it as one file in `tests/features/bundles/` | page import paths                                                                                                                                                                                                                         |
| `categories-page.test.tsx`                                | `tests/features/categories/categories-page.test.tsx`                                                                                                                              | page import                                                                                                                                                                                                                               |
| `category-form-toast.test.tsx` + `category-form.test.tsx` | merge → `tests/features/categories/components/category-form.test.tsx` (two `describe` blocks)                                                                                     | form import                                                                                                                                                                                                                               |
| `collection-edit-page.test.tsx`                           | `tests/features/collections/edit-collection-page.test.tsx`                                                                                                                        | page + form import                                                                                                                                                                                                                        |
| `collection-form.test.tsx`                                | `tests/features/collections/components/collection-form.test.tsx`                                                                                                                  | form/hook/media imports; remove stale `@/components/ui/icons` mock                                                                                                                                                                        |
| `collections-page.test.tsx`                               | `tests/features/collections/collections-page.test.tsx`                                                                                                                            | imports `app/collections/new/page` too → `@/features/collections/new-collection-page`                                                                                                                                                     |
| `dashboard-metrics.test.ts`                               | `tests/features/dashboard/lib/metrics.test.ts`                                                                                                                                    | `@/features/dashboard/lib/metrics`                                                                                                                                                                                                        |
| `dashboard-page.test.tsx`                                 | `tests/features/dashboard/dashboard-page.test.tsx`                                                                                                                                | page import                                                                                                                                                                                                                               |
| `discounts-page.test.tsx`                                 | `tests/features/discounts/bulk-discounts-page.test.tsx`                                                                                                                           | page import                                                                                                                                                                                                                               |
| `editor-form-parts.test.tsx`                              | `tests/components/forms/editor-form-parts.test.tsx`                                                                                                                               | see §6 dead code (`ImageFieldCard`, `EditorActions` cases)                                                                                                                                                                                |
| `entity-media-upload.test.tsx`                            | `tests/components/forms/entity-media-upload.test.tsx`                                                                                                                             | import path; remove stale `icons` mock                                                                                                                                                                                                    |
| `error-messages.test.ts`                                  | `tests/lib/errors.test.ts`                                                                                                                                                        | —                                                                                                                                                                                                                                         |
| `form-slug.test.ts`                                       | `tests/lib/slug.test.ts`                                                                                                                                                          | `@/lib/slug`                                                                                                                                                                                                                              |
| `hover-image-upload.test.tsx`                             | `tests/components/forms/hover-image-upload.test.tsx`                                                                                                                              | remove stale `icons` mock                                                                                                                                                                                                                 |
| `offer-edit-page.test.tsx`                                | `tests/features/offers/edit-offer-page.test.tsx`                                                                                                                                  | page + form imports                                                                                                                                                                                                                       |
| `offer-form-category.test.tsx`                            | `tests/features/offers/components/offer-form.category.test.tsx`                                                                                                                   | imports; remove stale `icons` mock                                                                                                                                                                                                        |
| `offer-form-related.test.tsx`                             | `tests/features/offers/components/offer-form.related.test.tsx`                                                                                                                    | imports                                                                                                                                                                                                                                   |
| `offers-page.test.tsx`                                    | `tests/features/offers/offers-page.test.tsx`                                                                                                                                      | page import                                                                                                                                                                                                                               |
| `order-detail-page.test.tsx`                              | `tests/features/orders/components/order-details-view.test.tsx`                                                                                                                    | import                                                                                                                                                                                                                                    |
| `order-review-flag-alerts.test.tsx`                       | `tests/features/orders/components/order-review-flag-alerts.test.tsx`                                                                                                              | import                                                                                                                                                                                                                                    |
| `orders-page.test.tsx`                                    | `tests/features/orders/orders-page.test.tsx`                                                                                                                                      | page import                                                                                                                                                                                                                               |
| `paymob-reconciliation-page.test.tsx`                     | `tests/features/orders/reconciliation-page.test.tsx`                                                                                                                              | **Replace** the dynamic `import(modulePath).catch(() => ({ default: () => null }))` with a normal static import of `@/features/orders/reconciliation-page`. As written, a wrong path only turns into a confusing "text not found" failure |
| `product-discount-page.test.tsx`                          | `tests/features/discounts/product-discount-page.test.tsx`                                                                                                                         | page import                                                                                                                                                                                                                               |
| `product-edit-page.test.tsx`                              | `tests/features/products/edit-product-page.test.tsx`                                                                                                                              | page/form + `related-options` → `@/lib/related-options`                                                                                                                                                                                   |
| `product-form-keywords.test.tsx`                          | `tests/features/products/components/product-form.keywords.test.tsx`                                                                                                               | imports; remove stale mocks `@/components/forms/product-hover-image-upload` and `@/components/ui/icons` (those modules no longer exist)                                                                                                   |
| `product-hover-image.test.tsx`                            | `tests/features/products/hooks/use-product-form.test.tsx`                                                                                                                         | hook import                                                                                                                                                                                                                               |
| `products-page.test.tsx`                                  | `tests/features/products/products-page.test.tsx`                                                                                                                                  | page + form import                                                                                                                                                                                                                        |
| `products-reorder.test.tsx`                               | `tests/features/products/products-page.reorder.test.tsx`                                                                                                                          | page import                                                                                                                                                                                                                               |
| `reviews-page.test.tsx`                                   | `tests/features/reviews/reviews-page.test.tsx`                                                                                                                                    | page import                                                                                                                                                                                                                               |
| `sales-page.test.tsx`                                     | `tests/features/sales/sales-page.test.tsx`                                                                                                                                        | page import                                                                                                                                                                                                                               |
| `shared-ui.test.tsx`                                      | `tests/shared-ui.test.tsx` (stays at root: it tests `@capella/shared/ui`, not ERP src)                                                                                            | —                                                                                                                                                                                                                                         |
| `shipping-overview-page.test.tsx`                         | `tests/features/shipping/shipping-page.test.tsx`                                                                                                                                  | page import                                                                                                                                                                                                                               |
| `shop-media-page.test.tsx`                                | `tests/features/shop-media/shop-media-page.test.tsx`                                                                                                                              | page import                                                                                                                                                                                                                               |
| `staff-edit-page.test.tsx`                                | `tests/features/staff/edit-staff-page.test.tsx`                                                                                                                                   | page import                                                                                                                                                                                                                               |
| `staff-editor-form.test.tsx`                              | `tests/features/staff/components/staff-editor-form.test.tsx`                                                                                                                      | import                                                                                                                                                                                                                                    |
| `staff-management-page.test.tsx`                          | `tests/features/staff/staff-page.test.tsx`                                                                                                                                        | page import                                                                                                                                                                                                                               |
| `staff-new-page.test.tsx`                                 | `tests/features/staff/new-staff-page.test.tsx`                                                                                                                                    | page + form import                                                                                                                                                                                                                        |
| `store-normalizers.test.ts`                               | `tests/lib/store/normalizers.test.ts`                                                                                                                                             | —                                                                                                                                                                                                                                         |
| `store.test.ts`                                           | `tests/lib/store/core.test.ts`                                                                                                                                                    | —                                                                                                                                                                                                                                         |
| `theme-preference.test.ts`                                | `tests/lib/theme.test.ts`                                                                                                                                                         | —                                                                                                                                                                                                                                         |
| `trash-page.test.tsx`                                     | `tests/features/trash/trash-page.test.tsx`                                                                                                                                        | page import                                                                                                                                                                                                                               |
| `unit/health-route.test.ts`                               | `tests/app/api/health/route.test.ts`                                                                                                                                              | — (delete the empty `tests/unit/`)                                                                                                                                                                                                        |
| `upload-permissions.test.tsx`                             | `tests/features/products/components/product-form.upload-permissions.test.tsx`                                                                                                     | import                                                                                                                                                                                                                                    |
| `use-collapsed-categories.test.tsx`                       | `tests/features/categories/hooks/use-collapsed-categories.test.tsx`                                                                                                               | import                                                                                                                                                                                                                                    |




`vi.mock` **paths must be updated too.** `vi.mock("@/old/path")` does not fail when the path no longer exists; the mock
just stops applying and the test may then hit the real module. After each move, run
`grep -rn 'vi.mock("@/' tests` and check that every mocked path exists in `src/`.

**New tests to add (TDD: write first, red → green):**


| New source                                | Test                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `lib/format.ts` date helpers              | `tests/lib/format.test.ts` (create; also cover existing `formatMoney` / `formatNumber` / `formatMoneyRange` briefly) |
| `lib/category-tree.ts` `isInCategoryTree` | `tests/lib/category-tree.test.ts` (cycle guard, null id, deep descendant, non-descendant)                            |
| `lib/media.ts`                            | `tests/lib/media.test.ts` (http url, `/uploads/` prefix, other value, empty)                                         |
| `hooks/use-table-sort.ts`                 | `tests/hooks/use-table-sort.test.tsx` (it has no test today; 3-state cycle, empty values sink)                       |
| `hooks/use-list-reorder.ts`               | `tests/hooks/use-list-reorder.test.tsx` (it has no test today; move, bounds, dirty, save success/failure)            |
| `components/admin/list-table.tsx`         | `tests/components/admin/list-table.test.tsx`                                                                         |
| `components/admin/permission-gate.tsx`    | `tests/components/admin/permission-gate.test.tsx`                                                                    |
| `features/discounts/lib/discount.ts`      | `tests/features/discounts/lib/discount.test.ts`                                                                      |
| `features/bundles/*` (Phase 4)            | `tests/features/bundles/...`: the existing bundle tests move here. Add cases for each config difference (§5.4)       |


---



## 5. Shared extractions (the de-duplication work)

Each extraction is its own small slice: test first, then extract, then replace the call sites, then go green.

### 5.1 `components/admin/list-table.tsx`: list table scaffolding

Duplicated today in `products-table`, `offers-table`, `collections-table`, plus the inline tables in `advices`, `staff`,
`reviews`, `orders`, `shipping`, `sales` (×3), `orders/reconciliation` and `order-details-view`. The `Table/TR/TD`
primitives are already shared. What is copied is:

- **Skeleton rows:** `Array.from({length:5}, … <TR aria-hidden><TD><Skeleton …/>…)`.
- **Empty row:** `<TableState colSpan={n}><EmptyState icon title description/></TableState>`.
- **Reorder arrows:** two `Button variant="ghost" size="icon-sm"` with `ArrowUp`/`ArrowDown`, labels
`تحريك لأعلى`/`تحريك لأسفل`, disabled at the ends. These appear in the 3 tables, advices, categories tree and shop-media ×2.
- **Sort-select options:** `{ value: "", label: "ترتيب المتجر" }, …COLUMNS.flatMap(c => [asc, desc])` plus the `value`
and `onChange` parsing for `AdminListHeader.sort`, in advices, products, offers and collections.

Extract only these 4 pieces. Do not build a generic data-grid.

```tsx
export function TableSkeletonRows({ rows = 5, cells }: { rows?: number; cells: ReactNode[] }) // cells = one row's <TD>s
export function TableEmptyRow({ colSpan, icon, title, description }: …)
// ReorderButtons: NOT here. It lives in components/admin/reorder-buttons.tsx, shared with forms (§5.7 B6)
export function tableSortSelect<K extends string>(columns: {key:K;label:string}[], sort: SortState<K>|null, setSort): ListSort
```

`tableSortSelect` returns the object passed to `AdminListHeader`'s `sort` prop. It belongs in
`hooks/use-table-sort.ts` or next to `ListSort` in `admin-list-header.tsx`. Pick one and say which in the PR.
Keep the existing `aria-label`, `title` and `data-testid` values exactly. Tests query them.

### 5.2 Date and category helpers → `lib/`

- `lib/format.ts`: add
  - `formatDate(value)` → `toLocaleDateString("ar-EG-u-nu-latn", { day: "2-digit", month: "short", year: "numeric" })`.
  It replaces `formatOrderDate` (orders), `formatDate` (sales), and the inline calls in reviews (line ~189) and
  shipping (line ~352).
  - `formatDateShort(value)` → `toLocaleDateString("ar-EG-u-nu-latn")`: the 5 trash `meta` lines in `use-trash-page.ts`.
  - `formatDateTime(value)`: only if `order-details-view.tsx:48` and `ending-discounts.tsx:23` share the same options.
  If their options differ, leave them local.
  - `localDateKey(value)`: identical in `orders/page.tsx:35` and `shipping/page.tsx:55`.
  Leave the dashboard greeting (`weekday: "long"…`) local because it is used once.
- `lib/category-tree.ts`: add `isInCategoryTree(categories, categoryId, selectedCategoryId)`. It is byte-identical in
`app/offers/page.tsx:22` and `app/collections/page.tsx:22`. Move it as-is, without trying to merge it with
`getDescendantCategoryIds`, because the semantics differ (see §9 D3).
  - `discounts/page.tsx` `inCategory` (parents-map version) does the same ancestor walk against a *set* of selected ids.
  Keep it in `features/discounts/lib/discount.ts` unless it can be written as
  `[...selected].some(id => isInCategoryTree(…))` without a behaviour change. It can't if performance matters, so
  leave it unless that is clearly equivalent.
  - `use-products-page.ts` `isDescendantOf` / `isInCategoryBranch` behave **differently** (they match ancestors too).
  This is **intended** (§9 D3). Do not merge them.



### 5.3 `lib/media.ts`: media URL resolving

These are the same function written 3 times:

- `components/ui/thumb.tsx:11` `resolveMediaSrc` (no empty check)
- `components/forms/hover-image-upload.tsx:18` `resolvePreviewSrc` (returns `""` for empty)
- `app/shop-media/page.tsx:97` `resolvePreviewSrc` (returns `null` for empty)

Create `lib/media.ts` → `resolveMediaSrc(value: string): string` (with an empty check returning `""`). Callers that
need `null` do `value ? resolveMediaSrc(value) : null` at the call site. `single-image-field.tsx` already imports it
from `thumb`; repoint that import too.

### 5.4 `features/bundles`: offers and collections are ~95% the same code

Measured by diffing with entity names normalised:


| Pair                                                        | Lines that differ                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `offer-form.tsx` vs `collection-form.tsx` (410 / 410)       | 46, all Arabic copy except `originalTotal` vs `computed.originalTotal` |
| `use-offer-form.ts` vs `use-collection-form.ts` (255 / 251) | 72                                                                     |
| `offer-form.types.ts` vs `collection-form.types.ts`         | 12                                                                     |
| `offers/page.tsx` vs `collections/page.tsx`                 | ~40, copy plus 3 real differences                                      |
| `offers-table.tsx` vs `collections-table.tsx`               | 75 diff lines                                                          |
| `offers/[id]/edit` vs `collections/[id]/edit`               | copy only                                                              |


These are the **real behaviour differences** to keep and turn into config. Everything else is copy:

1. Row validation: a collection needs **≥2 rows with ≥2 distinct variants and no repeated variant**. An offer needs
  **≥1 valid row**. Error messages differ.
2. Offer's hook returns `computed: { originalTotal, breakdown }`, collection's returns `originalTotal`. `breakdown` is
  **not used anywhere** (only built in `use-offer-form.ts:59`). So unify on `originalTotal` and drop `breakdown`.
3. Save payload: an offer sends `deletedAt: null`, a collection sends `initial?.deletedAt ?? null`. **The API ignores this
  field on save** (`apps/api/src/modules/admin/offers/admin-offers.controller.ts` ~line 171 builds the record without
   reading `deletedAt`; collections do the same). It has no effect, so the merged form uses `initial?.deletedAt ?? null`
   for both. This is not a behaviour change.
4. List search: collections also match `slug`. **Decided (§9 D5): offers must match** `slug` **too.** This is fixed in
  Phase 1, so by Phase 4 there is no difference left here.
5. Offers page stores `pendingDelete` as an id, collections as the object. This is cosmetic; pick one.

Target:

```
features/bundles/
  bundle-config.ts           type BundleConfig = { kind: "offer"|"collection"; copy: {...}; minRows; requireDistinctVariants; storeApi: {...} }
  components/bundle-form.tsx
  components/bundles-table.tsx
  hooks/use-bundle-form.ts
  hooks/use-bundles-list.ts  (filter/search/reorder/toggle/delete state shared by both list pages)
  types.ts
features/offers/offer-config.ts         → BundleConfig for offers (all Arabic strings)
features/collections/collection-config.ts
features/offers/*-page.tsx              → thin: <BundleForm config={offerConfig} …/>
```

Keep `OfferForm` and `CollectionForm` as thin named wrappers (`(props) => <BundleForm config={offerConfig} {...props} />`)
so tests and pages can keep their imports, and keep `testIdPrefix` / `data-testid` per kind.
**This is the largest and riskiest slice. Do it last (Phase 4), after everything else is green.**

### 5.5 `components/admin/permission-gate.tsx`: the forbidden guard

This block appears **32 times** across 27 files:

```tsx
if (!canXErpModule(user, "module")) {
  return (<AdminShell title=… crumbs=…><ErpForbiddenState message=… /></AdminShell>);
}
```

Extract only the render part:

```tsx
export function ForbiddenPage({ title, crumbs, message }: {...}) // = AdminShell + ErpForbiddenState
```

Keep the `if (!can…)` check in each page, because the checks vary (read/create/update/hasErpPermission) and a
wrapper component would change hook ordering. This is a plain swap of the JSX for `<ForbiddenPage …/>`.

### 5.6 Smaller shared bits

- `FoldButton` (`shop-media/page.tsx:104`) and the chevron toggle in `categories/page.tsx:~405` →
`components/admin/fold-button.tsx`.
- `use-products-page.ts` (lines ~93–140) re-implements `useListReorder` (draft order, dirty check, move, save+toast).
Switch it to `useListReorder` **only if** `products-reorder.test.tsx` stays green unchanged. The difference: products
reset the draft when filters change, and reorder is per category scope. If that doesn't fit cleanly, leave it and
note it.
- Toggle/delete confirm state (`pendingToggle`, `pendingDelete`, `isToggling`, `toggleError` + two `AdminConfirmModal`s)
is repeated in advices, offers, collections and products (`use-products-page`). Phase 4's `use-bundles-list` covers
offers and collections. **Do not** build a generic hook for the other two. That would be over-engineering for 2 users.

### 5.7 Shared-layer code consolidation (`components/`, `hooks/`, `lib/` after Phase 1)

Audit of every file left in the shared layer on 2026-10-09 (~4.5k lines), plus their copies inside `app/**` and
`features/**`. Moving files is not enough here: each item below is duplicated **code** that must be merged into one
shared implementation, with call sites switched to it. Keep every `aria-label`, `data-testid` and Arabic string as it
is today unless the row says otherwise. Each row is one TDD slice: write or adjust the test first, then merge, then
go green. Ordered by value.

#### A. Likely bugs found while auditing (fix first, test first)

| # | Where | Problem | Fix |
|---|---|---|---|
| A1 | `components/providers/admin-auth.tsx:30-60` vs `lib/api/client.ts` `refreshAdminSession()` | The provider does its own `fetch(…/auth/refresh)` on mount, bypassing the shared `adminRefreshPromise`. The API **rotates** refresh tokens (`apps/api/src/modules/admin/auth/admin-auth.service.ts:113` `rotateRefreshSession`). If any request returns 401 while the provider's refresh is in flight (for example `OrderReviewFlagAlerts` or a page calling `api` directly before hydration), two refreshes race with the same token. The loser fails and `invalidateAdminSession()` logs the user out. Likely seen as random logouts on page load. | Export `refreshAdminSession` from `client.ts` and have the provider call it (one in-flight refresh for the whole app). Keep the provider's `setHydrated` / `setAdminAuthHydrated(true)` in `finally`. Test: start a provider refresh and an `api.get` 401 at the same time; assert `fetch(…/auth/refresh)` is called **once** and the user stays logged in. |
| A2 | 11 places do `error instanceof Error ? error.message : "…"`: `app/{collections,offers,products}/[id]/edit/page.tsx`, `app/products/[id]/discount/page.tsx`, `components/forms/{entity-media-upload,hover-image-upload,single-image-field}.tsx`, `features/categories/components/category-form.tsx`, `lib/store/core.ts` | `api.request` throws `new Error("API 409 /api/erp/…")`, so these alerts show raw English technical text to staff instead of the Arabic message. `lib/errors.ts` `getErrorMessage(error, fallback)` already maps API reasons and bodies to Arabic. | Replace each with `getErrorMessage(error, "<same Arabic fallback>")`. `core.ts` `this.error` is internal; switch it too for consistency. Test one upload field: a rejected upload with body `{ message: "…" }` shows that message, not `API 4xx`. |

#### B. Duplicated logic → one shared implementation

| # | Duplicates (file:line) | Shared target | Notes |
|---|---|---|---|
| B1 | **Wizard step engine** copied 6×: `step`/`reached` state, `goTo` (set step, raise `reached`, `window.scrollTo`), `next` (check the current step's requirements, then advance), `stepIndex`, `stepItems` (done/missing/todo) in `features/{advices,categories,collections,offers,products}/components/*-form.tsx` (e.g. `offer-form.tsx:75-110`) and `app/discounts/page.tsx:122-132` | `hooks/use-wizard-steps.ts` → `useWizardSteps({ steps, requirements, editing, checkRequirements })` returning `{ step, current, goTo, next, back, stepIndex, stepItems, reached }` | Differences to keep as options: discounts' `next` always validates (`editing` false); forms skip validation when `editing`. `Stepper` / `StepCount` UI stays in `components/admin/stepper.tsx`. Tests: `tests/hooks/use-wizard-steps.test.tsx` (next blocked by an unmet requirement, allowed when editing, `reached` never decreases, `stepItems` states). |
| B2 | **Single-image upload flow** (type check PNG/JPG/WEBP, 4 MB limit, busy, error, `api.uploadImage`): `components/forms/single-image-field.tsx:28-50`, `features/categories/components/category-form.tsx:52-75`, and without the checks in `components/forms/hover-image-upload.tsx:31-48` | `hooks/use-image-upload.ts` → `useImageUpload(uploadContext)` returning `{ busy, error, upload(files): Promise<string \| null> }`; validation in `lib/media.ts` `validateImageFile(file): string \| null` | Hover image currently skips the type/size check, so a bad file only fails server-side. Adding the same check is intended (same messages as single-image-field). `entity-media-upload` uploads multiple files and videos; it reuses only `validateImageFile` + `IMAGE_ACCEPT`, not the hook. |
| B3 | **Image-accept constant** 3×: `media-frame.tsx:8` `IMAGE_ACCEPT`, `single-image-field.tsx:10` `ACCEPT`, `category-form.tsx:55,92` inline | `lib/media.ts` → `IMAGE_ACCEPT`, `VIDEO_ACCEPT` (move from `entity-media-upload.tsx:21`), `MAX_IMAGE_BYTES` | |
| B4 | **Upload / replace / remove button group** (`FileButton` with `RefreshCw`/`Upload` + "استبدال"/"رفع صورة", then a `danger-ghost` trash button): `media-frame.tsx:66-77` (`LangSlotRow`), `single-image-field.tsx:62-75`, `category-form.tsx:89-100` | `components/forms/image-actions.tsx` → `<ImageActions hasImage busy canUpload onFiles onRemove removeLabel inputTestId replaceLabel? />` | category-form says "استبدال الصورة"; keep it via `replaceLabel`. |
| B5 | **Array move by index**, 9 copies in two styles (swap and splice; same result for ±1): `hooks/use-list-reorder.ts:38-46`, `features/products/hooks/use-products-page.ts:116-125`, `features/{offers,collections}/hooks/use-*-form.ts:~68-81`, `components/forms/entity-media-upload.tsx:44-53`, `components/forms/related-items-field.tsx:130-137`, `app/categories/page.tsx:126-134`, `app/shop-media/page.tsx:259-262,343-355` | `lib/array.ts` → `moveItem<T>(items: readonly T[], index: number, delta: -1 \| 1): T[]` (returns the same array when out of bounds) | Tests: `tests/lib/array.test.ts` (first/last bounds, both directions, does not mutate). |
| B6 | **Up/Down reorder buttons** (two `ghost icon-sm` buttons, `ArrowUp`/`ArrowDown`, "تحريك لأعلى/لأسفل", disabled at the ends) in 10 files: 3 tables, `category-tree.tsx`, `collection-form.tsx`, `offer-form.tsx`, `entity-media-upload.tsx`, `related-items-field.tsx`, `app/advices/page.tsx`, `app/shop-media/page.tsx` ×2 | `components/admin/reorder-buttons.tsx` → `<ReorderButtons index count onMove disabled? orientation?: "row" \| "column" />` | This **replaces** §5.1's `ReorderButtons` inside `list-table.tsx`: one component for tables and forms, so it lives in its own file. `entity-media-upload` stacks them vertically at `@2xl`, hence `orientation`. Keep each `title` attribute where it exists today. |
| B7 | **Permission check** 3×: `lib/erp-permissions.ts` `hasErpPermission`, `components/shell/admin-shell.tsx:69` `canAccess`, `lib/store/core.ts:205` `canRead` inside `getPreloadRequests` | `hasErpPermission` (already shared) | `canAccess` has one extra rule (an item without `permission` is admin-only): keep it as `!item.permission ? user.role === "admin" : hasErpPermission(user, item.permission)`. `erp-permissions.ts` has a needless `"use client"` (pure functions); remove it so `core.ts` can import it cleanly. |
| B8 | **Active/inactive status badge** `<Badge tone={active ? "success" : "neutral"}>{active ? "نشط" : "غير نشط"}</Badge>`, 9×: 3 tables, `app/{advices,reviews,staff}/page.tsx`, `app/shop-media/page.tsx:339,420,428` | `components/admin/status-badge.tsx` → `<StatusBadge active />` | Pairs with `ACTIVE_STATUS_FILTER_OPTIONS` (same labels): move that constant next to it and re-export from `admin-list-header.tsx`, or import from the new file. |
| B9 | **Draft/active status radio cards** (`STATUS_OPTIONS` + the identical `<fieldset>` of styled radio labels with `Swatch`): `features/{advices,products,offers,collections}/components/*-form.tsx` (e.g. `offer-form.tsx:33-36` and `316-345`) | `components/forms/status-choice.tsx` → `<StatusChoice name value onChange legend options />`. `options` stays per entity because the hint wording is gendered ("مخفي" vs "مخفية"). | |
| B10 | **Store "call API, then refetch"**: about 30 methods in `lib/store/core.ts:279-470` are `await api.X(…); await this.refetch();`, and 4 `hardDelete*` methods are the same "delete → filter local list → emit → background refetch" | Two private helpers in `ErpStore`: `private async mutate(call: () => Promise<unknown>)` and `private async hardDelete<K extends "products" \| "categories" \| "offers" \| "collections">(key: K, path: string, id: number)` | **Keep every public method name and signature** (pages and `tests/lib/store/core.test.ts` call them); only their bodies shrink. Also: the `sales` field initializer (`core.ts:35-40`) duplicates `createEmptySales()`, so use it there, and reset all fields in `refetch` via one `resetData()` helper used by both. |
| B11 | **`api.uploadMedia` and `api.uploadImage` are byte-identical** (`lib/api/client.ts:205-228`) | One private `upload(file, context)`; keep both public names pointing at it | Callers use both names, so keep the names to avoid churn. |
| B13 | **Language tag chip** ("ع" / "EN", `rounded-sm bg-sand-150 px-1.5 text-xs leading-5 text-text-muted`): `components/forms/editor-form-parts.tsx:9,41-50` and `components/forms/media-frame.tsx:63` | `components/forms/lang-tag.tsx` → `<LangTag lang />` | The positioning classes stay at the call site. |

#### C. Layering and stale-API cleanups in the shared layer

| # | Where | Fix |
|---|---|---|
| C1 | `lib/related-options.ts` imports the `RelatedOption` type from `@/components/forms/related-items-field` (lib depending on a component) | Move `RelatedOption` into `lib/related-options.ts` and have `related-items-field.tsx` import it from there. |
| C2 | `components/shell/admin-shell.tsx` `width?: "full" \| "form" \| "narrow"` + `WIDTH_CLASS`: no page passes `width`, so only `"full"` is ever used. The `editor-layout.tsx:9-10` comment still tells callers to use `width="form"`, which contradicts the user rule "ERP pages are always full width" (`apps/erp/DESIGN.md`). | Delete the prop, `WIDTH_CLASS` and the stale comment lines. |
| C3 | `components/admin/admin-confirm-modal.tsx` `confirmClassName` (`@deprecated`): no caller passes it any more | Delete the prop and the fallback; `variant = tone ?? "primary"`. |
| C4 | `lib/store.ts` sits next to the `lib/store/` folder | Move it to `lib/store/index.ts`. `@/lib/store` imports keep resolving, so no call-site changes. |
| C5 | `paymentStatusTone` (`lib/payment-status.ts:10`) and `orderPaymentBadge` re-declare the badge tone union by hand | Type them as `NonNullable<BadgeProps["tone"]>` (export `BadgeTone` from `components/ui/badge.tsx`), so a new tone can't drift. |

**Leave alone (checked, not worth merging):** `lib/theme.ts` + `theme-script.ts` (the script must stay server-safe;
§3.15). The localStorage try/catch in `use-collapsed-set.ts` vs `theme.ts` (2 tiny users, and their fallbacks differ).
`CategoryPicker`'s own parent→children map (it builds chained selects, a different shape from
`buildCategoryTreeOptions`' flat list). The close (X) buttons in `ui/modal.tsx:41-46`, the `admin-list-header.tsx:221`
popover and the `admin-shell.tsx:~218` drawer: they differ in radius and icon size (`rounded-control`/18px,
`rounded-md`/16px, 20px), so they are not true duplicates. `ui/*` primitives (no duplication found). `use-media-query`, `use-table-sort`,
`format.ts`, `slug.ts`, `stock.ts`, `media.ts`, `category-tree.ts` (already single-source after Phase 1).

**New/updated tests for §5.7:** `tests/hooks/use-wizard-steps.test.tsx`, `tests/hooks/use-image-upload.test.tsx`,
`tests/lib/array.test.ts`, `tests/lib/media.test.ts` (+ `validateImageFile`),
`tests/components/admin/reorder-buttons.test.tsx`, `tests/components/admin/status-badge.test.tsx`,
`tests/components/forms/status-choice.test.tsx`, `tests/components/providers/admin-auth.test.tsx` (A1),
plus extra cases in `tests/lib/store/core.test.ts` (B10: a mutation still refetches; `hardDelete` removes locally
before the refetch) and `tests/lib/api/client.test.ts` (A1 single in-flight refresh; B11 both upload names hit
`/api/erp/uploads`).

---



## 6. Dead and stale code to remove (during the matching phase)


| Item                                                                                                                                                                  | Evidence                                                                                                                                                                        | Action                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReadinessStatus`, `scrollToSection` (`components/admin/editor-layout.tsx`)                                                                                           | 0 references outside the file                                                                                                                                                   | delete                                                                                                                                                                           |
| `CardFooter` (`components/ui/card.tsx`)                                                                                                                               | 0 references                                                                                                                                                                    | delete                                                                                                                                                                           |
| `ImageFieldCard`, `EditorActions` (`components/forms/editor-form-parts.tsx`)                                                                                          | only referenced by `tests/editor-form-parts.test.tsx`                                                                                                                           | delete them and their 2 test cases                                                                                                                                               |
| `paymentStatusChip` + `orderPaymentDisplay` (`lib/payment-status.ts`)                                                                                                 | `paymentStatusChip` returns `"status status--draft"`-style classes from the legacy stylesheet that was removed in `db487cb`. `orderPaymentDisplay` is only used inside the file | Fold the label logic into `orderPaymentBadge`, then delete both. Check `orderMatchesPaymentStatusFilter` still reads the same label source (the comment at line 30 refers to it) |
| `PaymobReconciliationItem` / `PaymobCallbackProblem` duplicates                                                                                                       | `reconciliation/page.tsx:19-21` derives its own types although `lib/store/types.ts` exports them                                                                                | use the exported types                                                                                                                                                           |
| `components/forms/product-media-upload.tsx` | 1-line re-export | DONE (Phase 1): renamed to `entity-media-upload.tsx`, which holds the implementation |
| stale `vi.mock("@/components/ui/icons")` (5 tests) and `vi.mock("@/components/forms/product-hover-image-upload")`                                                     | the modules don't exist                                                                                                                                                         | delete the mocks                                                                                                                                                                 |
| `tests/unit/`                                                                                                                                                         | single file                                                                                                                                                                     | move it, then delete the folder                                                                                                                                                  |
| `src/types/`, `src/hooks/forms/`, `src/components/{dashboard,orders,trash}/`, root `components/*-table.tsx`                                                           | emptied by the moves                                                                                                                                                            | delete the empty folders                                                                                                                                                         |
| Exported-but-local `export`s: `ListFilterOption`, `ListFilter`, `ListSort`, `CategoryTreeOption`, `SortDirection`, `CATEGORIES_COLLAPSED_STORAGE_KEY`, `controlClass` | only used in their own file                                                                                                                                                     | harmless; leave them (removing `export` adds churn for no gain)                                                                                                                  |


---



## 7. Phases (execute in order, small slices, green after each)

Each phase ends with: `pnpm typecheck && pnpm test` in `apps/erp` (sequential), the test count ≥ baseline, and
`grep -rn 'vi.mock("@/' tests` paths all existing. Run `pnpm build` at the end of Phases 2, 3 and 5.

**Phase 0: Pre-flight.** §1. Stop if the working tree is dirty or the baseline is red.

**Phase 1: Shared-layer cleanup (no features yet).**

1. `form-slug.ts` → `lib/slug.ts`; `related-options.ts` → `lib/related-options.ts`; `hooks/forms/use-hover-image-fields.ts`
  → `hooks/use-hover-image-fields.ts`; `entity-media-upload` consolidation (§3.15). Update all imports, including
   tests and `vi.mock`.
2. Remove dead code and stale mocks (§6).
3. New helpers with tests first: `lib/media.ts`, `lib/format.ts` dates + `localDateKey`, `lib/category-tree.ts`
  `isInCategoryTree`. Replace the duplicates at their current call sites.
4. Add the missing tests for `use-table-sort` and `use-list-reorder` (they cover behaviour, so they guard the later moves).
5. Apply the approved behaviour fixes (§9 D1, D2, D5, D6, D7). Each is a small TDD slice: write a failing test,
  fix, go green.
6. Move the shared tests to mirrored paths (`tests/lib/**`, `tests/hooks/**`, `tests/components/**`,
  `tests/app/api/health/route.test.ts`).

**Phase 2: Move each feature's building blocks, one per slice, with no logic changes.** For each feature, in this
order: `trash → staff → advices → categories → shop-media → discounts → dashboard → shipping → orders → products →
offers → collections` (pages never move; `auth`/`sales` have nothing to move besides the page).
For each feature:

1. `git mv` the components/hooks/lib/types per §3. Pages stay in `src/app/**` and keep importing `@/…` (including
   `@/features/<feature>/…` for anything that moved).
2. Fix imports (absolute `@/…`).
3. `git mv` its tests per §4 and update the imports and `vi.mock` paths.
4. `pnpm typecheck && pnpm test` → green before the next feature.

Do **not** extract components out of pages yet, except the moves §3 lists as "↳" that are pure cut and paste
(helpers and inner components already defined at file top level). Inline tables are Phase 3.

**Phase 3: Shared UI extractions.** §5.1 (list-table pieces), §5.5 (`ForbiddenPage`), §5.6 (`FoldButton`, maybe
products reorder). Then pull the inline tables out into `features/<f>/components/*-table.tsx` (advices, staff, reviews,
orders, shipping) using the new pieces. One feature per slice, tests green after each.

**Phase 3B: Shared-layer code consolidation (§5.7).** Order: A1, A2 (bugs) → B7, B11, C1–C5 (small, isolated) →
B5, B6 (array move + reorder buttons) → B3, B2, B4, B13 (media) → B8, B9 (status UI) → B1 (wizard) → B10 (store). One row per slice, `pnpm typecheck && pnpm test` green after each. Do B1 and B9 **before**
Phase 4 so the bundle merge starts from forms that already use the shared wizard and status pieces. Do **not** change
copy, test ids, or the user-facing behaviour beyond what A1/A2/B2 state.

**Phase 4:** `features/bundles` **merge (§5.4).**

1. Make sure the existing offer and collection form, edit page and list tests are green, and add a test for each of the
  5 differences listed in §5.4 if none exists yet (red first where behaviour isn't covered).
2. Build `bundle-config` + `use-bundle-form`, switch `use-offer-form` and `use-collection-form` to it (keep their exports
  as wrappers), green.
3. `bundle-form`, `bundles-table`, `use-bundles-list`, green after each.
4. Move the bundle tests to `tests/features/bundles/`.

**Phase 5: Docs and full verification.**

1. Update `docs/folder-structure.md`. Its ERP tree (lines ~228–330) is already out of date: it lists
  `admin-list-toolbar.tsx`, `admin-status-badge.tsx`, `ui/icons.tsx`, `image-upload.tsx` and
   `product-hover-image-upload.tsx`, none of which exist. Line ~896 also says ERP `components/ui` "only holds icons/modal",
   which is no longer true. Rewrite the ERP subtree to the new layout and state the import rules from §2.
2. Update `apps/erp/DESIGN.md` §4/§7 (component locations) and `apps/erp/REDESIGN.md` references
  (`src/lib/dashboard.ts`, `src/components/dashboard/`, `editor-layout (+ ReadinessStatus, scrollToSection)`, the
   `src/styles/legacy.css` mention).
3. Full green, sequential: `pnpm typecheck`, `pnpm test`, `pnpm build` in `apps/erp`; `pnpm exec eslint apps/erp` at the
  root. This touches many areas, so per `AGENTS.md` also run the root `pnpm typecheck:web` and `pnpm lint:web`.
4. Manual smoke run (`pnpm dev` in `apps/erp`, port 3001; check first whether a dev server is already running): open
  every route in §8 once, light and dark theme.

---



## 8. Route checklist (must render identically after migration)

`/` (redirect), `/login`, `/dashboard`, `/products`, `/products/new`, `/products/[id]/edit`, `/products/[id]/discount`,
`/offers`, `/offers/new`, `/offers/[id]/edit`, `/collections`, `/collections/new`, `/collections/[id]/edit`,
`/categories`, `/categories/new`, `/categories/[id]/edit`, `/advices`, `/advices/new`, `/advices/[id]/edit`,
`/discounts`, `/orders`, `/orders/[id]`, `/orders/reconciliation`, `/shipping`, `/sales`, `/reviews`, `/shop-media`,
`/staff`, `/staff/new`, `/staff/[id]/edit`, `/trash`, `/api/health`.

---



## 9. User decisions (2026-10-09) — apply exactly as written

Everything not listed here must keep its current behaviour.


| #   | Finding                                                                                                                                                                                          | Decision → what to do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Low-stock limits disagreed: products table `LOW_STOCK = 10`, `stock < 10` (`components/products-table.tsx:19,47`) vs dashboard `LOW_STOCK_LIMIT = 5`, `stock <= 5` (`lib/dashboard.ts:105,118`). | **Limit is 5.** Create `lib/stock.ts` with `export const LOW_STOCK_LIMIT = 5;`. The dashboard metrics import it (remove the local constant). In the products table `StockCell`, `0` stays "نفد المخزون" and `1…5` (`stock <= LOW_STOCK_LIMIT`) shows "منخفض". Test: stock 5 → "منخفض", stock 6 → plain number. No existing test asserts the old threshold.                                                                                                                                                                                                                                                 |
| D2  | `/sales` had no permission guard, although the nav item requires `sales.read` (`admin-shell.tsx:54`).                                                                                            | **Add the guard**: `if (!canReadErpModule(user, "sales"))` → `<AdminShell …><ErpForbiddenState …/></AdminShell>` (the current pattern; Phase 3 swaps it to `ForbiddenPage`, §5.5) with title "المبيعات", crumbs `[{ label: "المبيعات" }]`, message "لا تملكين صلاحية الوصول إلى المبيعات.". Call all store hooks before the early return, or split into `SalesPage` (guard) + `SalesPageContent` the way `orders/page.tsx` does, so hook order stays valid. `tests/sales-page.test.tsx` currently doesn't mock `admin-auth`: add the mock (an allowed user) and add a "forbidden without sales.read" case. |
| D3  | Products category filter (`use-products-page.ts:31` `isInCategoryBranch`) also matches ancestor categories, unlike offers/collections.                                                           | **Intended. Leave as-is.** Do not merge it with `isInCategoryTree` / `getDescendantCategoryIds`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D4  | Offer save sends `deletedAt: null`, collection sends `initial?.deletedAt ?? null`.                                                                                                               | **No decision needed:** the API ignores `deletedAt` on save (§5.4 item 3). The merged bundle form uses `initial?.deletedAt ?? null`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D5  | Collections list search matches `slug`; offers didn't.                                                                                                                                           | **Offers = collections.** Offers list search matches `name.ar`, `name.en` and `slug`, exactly like `collections/page.tsx`. Add a test in `offers-page.test.tsx`: searching by an offer's slug shows it.                                                                                                                                                                                                                                                                                                                                                                                                    |
| D6  | `src/styled-jsx.d.ts` is unused.                                                                                                                                                                 | **Delete it.** Then confirm typecheck and build stay green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D7  | Collections delete modal copy says "سيُنقل المجموعة إلى المحذوفات…".                                                                                                                             | **Fix** it to "ستُنقل المجموعة إلى المحذوفات. يمكنك استعادتها لاحقًا من قسم المحذوفات." Update any test that asserts the old text (`grep -rn "سيُنقل" tests`). Leave the other entities' messages alone unless they have the same masculine/feminine mismatch. Check them with the same grep in `src` and fix only real mismatches (`المجموعة` and `المنتجات` are feminine, `العرض` and `المنتج` are masculine).                                                                                                                                                                                           |


---



## 10. Done checklist

- [ ] `src/app/**/page.tsx` stay in place (only `orders/[id]` is a server wrapper; `page.tsx` redirect, `layout.tsx`, `api/health/route.ts` untouched) and import their feature's building blocks from `@/features/<feature>/…`.
- [ ] No files left in `src/types/`, `src/hooks/forms/`, `src/components/{dashboard,orders,trash}/`, or `src/components/*.tsx` at root.
- [ ] `grep -rn "@/features/" src/components src/hooks src/lib` → only `components/shell/admin-shell.tsx` (order-review-flag-alerts).
- [ ] `grep -rnE "@/features/(\w+)" src/features` → each file imports only its own feature (or `bundles` from offers/collections).
- [ ] No relative `../` imports that leave a feature folder.
- [ ] Feature component/hook/lib tests sit at the mirror path under `tests/features/<feature>/`; page tests stay with their feature there too. `tests/` root holds only `setup.ts` and `shared-ui.test.tsx`.
- [ ] Every `vi.mock("@/…")` path exists.
- [ ] Test count ≥ baseline, and new tests from §4 are added.
- [ ] typecheck, test, build, eslint green, plus root `typecheck:web` / `lint:web`.
- [ ] `docs/folder-structure.md`, `apps/erp/DESIGN.md`, `apps/erp/REDESIGN.md` updated.
- [ ] §9 decisions D1–D7 applied, each with a test.
- [ ] §5.7 A1–A2, B1–B11, B13, C1–C5 done, each with its test; no remaining copies (re-run the greps in §5.7 B5/B6/B8).