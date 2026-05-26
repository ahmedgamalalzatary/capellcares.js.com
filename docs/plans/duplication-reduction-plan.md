# Duplication Reduction Plan

## Goal

Reduce real code duplication across `apps/` and `packages/` in a controlled way without changing product behavior.

This plan is based on:

- `npx jscpd apps/ packages/ --threshold 5`
- current repo structure
- recent `ProductGrid` refactor work

The current duplication report is above threshold:

- Total duplication: `10.22%`
- Clones found: `147`

This plan focuses on high-value duplicates first and explicitly ignores noise that is not worth refactoring.

---

## Scope Rules

### Ignore for now

These should not drive refactor work:

1. Generated / metadata duplication
   - `packages/database/drizzle/migrations/meta/0000_snapshot.json`

2. Expected test repetition
   - route test setup repetition
   - repetitive fixture declarations in tests
   - local repeated assertions unless the file is already hard to maintain

3. Small same-file repeats that do not affect maintainability
   - trivial markup repetition
   - repeated constant objects under a few lines

### Treat as real duplication

These are the actual refactor targets:

1. Cross-app duplicated UI primitives
2. Cross-app duplicated API base helpers
3. Shared contract / DTO / domain shape duplication
4. Repeated storefront page bootstrapping patterns
5. Repeated ERP list page/table patterns
6. Internal duplication inside large components that were already split once

---

## Refactor Strategy

Do this in waves. Do not try to “fix jscpd” in one large PR.

Each wave should:

1. move only one duplication category
2. keep behavior unchanged
3. run targeted verification
4. rerun `jscpd` after the wave

This avoids turning a maintainability cleanup into a regression project.

---

## Wave 1: Shared UI Primitives

### Why first

This is the cleanest and highest-volume duplication in the repo:

- `apps/erp/src/components/ui/*`
- `apps/storefront/src/components/ui/*`

These files are effectively duplicated copies.

### Primary targets

Move first:

- `button.tsx`
- `input.tsx`
- `label.tsx`
- `separator.tsx`
- `textarea.tsx`
- `badge.tsx`

Move second:

- `card.tsx`
- `table.tsx`
- `select.tsx`

### Recommended destination

Create a shared UI package or shared component area, for example:

- `packages/shared/src/ui/...`

If that becomes too heavy for this repo right now, use an intermediate shared location with a later package extraction plan.

### Steps

1. Compare ERP and storefront versions of each primitive.
2. Confirm whether they are identical or differ slightly.
3. Create one canonical shared version.
4. Update both apps to import that shared version.
5. Remove duplicated local copies only after imports are switched.

### Verification

- `pnpm --filter @capella/storefront exec tsc --noEmit`
- `pnpm --filter @capella/erp exec tsc --noEmit`
- storefront tests
- ERP tests most affected by moved primitives

---

## Wave 2: Shared API Base Logic

### Why second

These are obvious duplicates and low-risk to unify:

- `apps/erp/src/lib/api/base.ts`
- `apps/storefront/src/lib/api/base.ts`

### Goal

Have one shared base implementation for:

- base URL resolution
- request wrapper behavior
- common error handling
- JSON parsing behavior

Then keep only thin app-specific wrappers if each app needs different exported helpers.

### Recommended destination

One of:

- `packages/shared/src/api/base.ts`
- or `packages/shared/src/lib/api/base.ts`

### Steps

1. Diff the ERP and storefront files carefully.
2. Extract the common behavior into one shared base.
3. Keep app-level wrappers only if app-specific export names or config differ.
4. Replace direct duplicated logic with imports.

### Verification

- API base unit tests in storefront and ERP
- app typecheck for both apps

---

## Wave 3: Shared Types, DTOs, and Domain Shapes

### Why third

This is more important than it looks. Duplicated type shapes can silently drift and break contract safety.

### Current hotspots

- `packages/shared/src/types/index.ts`
- `packages/shared/src/dto/*.ts`
- `apps/api/src/types/domain.ts`

### Goal

Every business shape should have one canonical home.

Examples:

- request/response DTOs live in `packages/shared/src/dto`
- shared frontend/backend types live in `packages/shared/src/types`
- API-only internal mapping types stay in API only if they truly are internal

### Steps

1. Inventory duplicated business entities:
   - order
   - product
   - offer
   - category
   - advice
2. Decide the canonical file for each shape.
3. Replace duplicated local definitions with imports.
4. Delete leftover duplicate definitions after compile passes.

### Verification

- API typecheck
- shared package typecheck
- contract tests

---

## Wave 4: ERP Repeated List Pages

### Why fourth

ERP has repeated CRUD list/table patterns across pages like:

- `apps/erp/src/app/products/page.tsx`
- `apps/erp/src/app/offers/page.tsx`
- `apps/erp/src/app/advices/page.tsx`

These pages repeat:

- list header sections
- action button groups
- row action menus/buttons
- status rendering
- empty/loading-like structural markup

### Goal

Extract page-level reusable building blocks without forcing all entities into one generic abstraction.

### Recommended approach

Prefer shared sections, not one huge “admin table engine”.

Good candidates:

- `AdminListPageHeader`
- `AdminListActions`
- `AdminStatusBadge`
- row action renderer helpers

### Steps

1. Read all ERP list pages together.
2. Identify repeated layout and control blocks.
3. Extract only the stable repeats.
4. Keep entity-specific columns and behavior local.

### Verification

- `pnpm --filter @capella/erp test`
- ERP typecheck

---

## Wave 5: Storefront Page Bootstrapping Helpers

### Why fifth

Storefront pages repeat page bootstrapping patterns:

- validate `lang`
- load dictionary
- fetch one or more datasets
- build breadcrumb or metadata shell

### Current hotspots

- `products/[slug]/page.tsx`
- `offers/[slug]/page.tsx`
- `category/[slug]/page.tsx`
- `wishlist/page.tsx`
- `orders/page.tsx`
- `cart/page.tsx`
- `checkout/page.tsx`
- `login/page.tsx`
- `signup/page.tsx`

### Goal

Extract shared helpers for:

- language validation
- dict loading
- common page shell / breadcrumb setup
- repeated metadata-building plumbing where appropriate

### Important constraint

Do not over-abstract pages that are only superficially similar. Keep data-fetching intent readable.

### Steps

1. Group pages by repeated structure.
2. Extract only the common guard/helper logic.
3. Keep each page’s content and fetch set explicit.

### Verification

- storefront typecheck
- storefront tests

---

## Wave 6: Clean Internal Duplicates in Recent Components

### Why sixth

Some large components were already improved, but still contain duplicated branches internally.

### First target

- `apps/storefront/src/components/products/product-filters-content.tsx`

Current issue:

- mobile and desktop category rendering still duplicate a lot of logic

### Goal

Share:

- category tree traversal
- selected/open state rendering decisions
- repeated category item creation

Let mobile and desktop differ only in layout containers and spacing.

### Steps

1. Extract shared category rendering helper/component.
2. Keep mode-specific layout wrappers separate.
3. Verify behavior stays the same.

### Verification

- existing `ProductGrid` tests
- storefront test suite

---

## Sequence of Execution

Follow this order:

1. Wave 1: shared UI primitives
2. Wave 2: shared API base logic
3. Wave 3: shared types / DTOs / domain shapes
4. Wave 4: ERP repeated list pages
5. Wave 5: storefront page bootstrapping helpers
6. Wave 6: internal duplicate cleanup in recent components

This order is deliberate:

- highest duplication volume first
- lowest behavioral risk first
- shared contract cleanup before deeper page refactors

---

## Verification Standard Per Wave

At minimum after each wave:

1. run the most targeted typechecks/tests for touched apps
2. rerun `jscpd`
3. record whether duplication percentage moved

Recommended commands:

```powershell
pnpm --filter @capella/storefront exec tsc --noEmit
pnpm --filter @capella/erp exec tsc --noEmit
pnpm --filter @capella/api exec tsc --noEmit
pnpm --filter @capella/storefront test
pnpm --filter @capella/erp test
pnpm --filter @capella/api test
npx jscpd apps/ packages/ --threshold 5
```

Do not run all commands after every small edit. Use targeted verification based on touched files, then rerun `jscpd` at the end of the wave.

---

## Success Criteria

This plan is successful if:

1. duplicated UI primitives are no longer copied across ERP and storefront
2. API base logic is shared
3. duplicated business shapes have one canonical source
4. ERP repeated list page structures are reduced
5. storefront repeated page bootstrapping is reduced
6. `jscpd` percentage drops materially from `10.22%`

Getting under `5%` is the goal, but not at the cost of unreadable abstractions.

---

## Non-Goals

This plan does not aim to:

1. remove every repeated line
2. genericize all pages into one abstraction
3. refactor generated files
4. optimize test duplication before production duplication

---

## Next Session Starting Point

When resuming in a fresh session:

1. read this file first
2. start with Wave 1 only
3. inspect the duplicated ERP/storefront UI primitive files before editing
4. use TDD where behavior is being preserved through refactor
5. rerun `jscpd` after Wave 1 before moving to Wave 2
