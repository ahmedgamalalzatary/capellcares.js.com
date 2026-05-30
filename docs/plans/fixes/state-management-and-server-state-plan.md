# State Management and Server State Plan

## Summary

The repo does **not** need a broad "add Zustand everywhere" migration.

The highest-value change is:

- Use **TanStack Query** to replace the ERP custom server-state store in
  `apps/erp/src/lib/store.ts`.

The next most valuable changes are:

- Use **TanStack Query selectively** for storefront client-only authenticated data
  such as wishlist and orders.
- Consolidate duplicated client-side catalog resolution where cart/checkout need
  product or offer data in the browser.

The lower-priority and optional changes are:

- Use **Zustand only where a real shared client-state problem exists**.
- Keep local `useState` / `useReducer` for ordinary component-local state.
- Do **not** introduce Redux.

The main problem to solve is not "we have no global store". The real problem is
that `apps/erp/src/lib/store.ts` is manually implementing too many concerns in
one place:

- server fetching
- normalization
- caching
- mutation orchestration
- invalidation/refetch rules
- auth hydration coupling
- token-change reactions
- browser focus refresh
- React subscription wiring

That should be progressively separated and mostly replaced by TanStack Query.

## Current State

### ERP

ERP has a custom singleton store in:

- `apps/erp/src/lib/store.ts`

That store currently owns:

- products
- categories
- offers
- advices
- orders
- sales analytics
- loading/error/loaded flags
- broad `refetch()` behavior
- mutation methods such as `upsertProduct`, `softDeleteProduct`, `toggleOfferStatus`, `updateOrderPaymentStatus`

It is consumed by:

- `apps/erp/src/app/dashboard/page.tsx`
- `apps/erp/src/app/products/page.tsx`
- `apps/erp/src/app/products/new/page.tsx`
- `apps/erp/src/app/products/[id]/edit/page.tsx`
- `apps/erp/src/app/categories/page.tsx`
- `apps/erp/src/app/categories/new/page.tsx`
- `apps/erp/src/app/categories/[id]/edit/page.tsx`
- `apps/erp/src/app/offers/page.tsx`
- `apps/erp/src/app/offers/new/page.tsx`
- `apps/erp/src/app/offers/[id]/edit/page.tsx`
- `apps/erp/src/app/advices/page.tsx`
- `apps/erp/src/app/advices/[id]/edit/page.tsx`
- `apps/erp/src/app/orders/page.tsx`
- `apps/erp/src/app/sales/page.tsx`
- `apps/erp/src/app/trash/page.tsx`
- `apps/erp/src/components/forms/product-form.tsx`
- `apps/erp/src/components/forms/category-form.tsx`
- `apps/erp/src/components/forms/offer-form.tsx`
- `apps/erp/src/components/forms/advice-form.tsx`
- `apps/erp/src/components/orders/order-details-view.tsx`

ERP auth is currently Context-backed:

- `apps/erp/src/components/providers/admin-auth.tsx`
- `apps/erp/src/lib/api/client.ts`

It stores the admin user in `sessionStorage`, keeps the access token in module
memory, and notifies the custom store when auth hydration or access token changes.

### Storefront

Storefront uses three Context providers:

- `apps/storefront/src/components/providers/auth-provider.tsx`
- `apps/storefront/src/components/providers/cart-provider.tsx`
- `apps/storefront/src/components/providers/wishlist-provider.tsx`

Storefront also has client-side fetches in:

- `apps/storefront/src/components/cart/cart-view.tsx`
- `apps/storefront/src/components/checkout/checkout-view.tsx`
- `apps/storefront/src/components/wishlist/wishlist-view.tsx`
- `apps/storefront/src/components/orders/orders-view.tsx`
- `apps/storefront/src/components/orders/order-detail-view.tsx`
- `apps/storefront/src/components/search/ask-capella-overlay.tsx`

Server/static page data is fetched through:

- `apps/storefront/src/lib/api/client.ts`
- `apps/storefront/src/lib/storefront-static-data.ts`
- `apps/storefront/src/lib/storefront-page-context.ts`
- `apps/storefront/src/lib/storefront-detail-page.tsx`

Those server/static pathways should not be blindly converted to client-side Query.
Keep server-rendered and static/revalidated page data where it already fits Next.js.

## Diagnosis

### What Is Healthy

- Most local `useState` usage is ordinary component state: forms, filters, tabs,
  drawers, loading flags, confirmation modals, and transient UI.
- Storefront cart state is browser-owned and already reasonably simple.
- Storefront and ERP both keep API access behind frontend client modules instead
  of calling the DB directly.
- There are existing tests around the ERP store, auth providers, cart
  localStorage helpers, and critical frontend flows.

### What Is Risky

- `apps/erp/src/lib/store.ts` combines server data fetching, normalization, cache
  ownership, mutation methods, refetch rules, auth hydration coupling, browser
  focus refresh, and React subscription wiring in one file.
- ERP mutations often refetch every ERP dataset after one write, even when only
  one query needs invalidation.
- The custom ERP store has no standard stale-time, cache-time, retry, request
  de-duplication, cancellation, or stale response protection.
- Storefront wishlist is optimistic but has no rollback on failed toggle.
- Storefront cart and checkout independently fetch products/offers to resolve
  cart lines, duplicating work and loading/error behavior.
- Access token handling is split between Context state and module-level mutable
  variables.

### What Is Not A Priority Problem

- The repo does not currently show a broad Context-caused architecture failure.
- The storefront cart is not currently complex enough to justify a mandatory
  Zustand migration.
- Auth migration is high-risk and should not be the first state-management refactor.

## Decision

Use this rule:

```text
Is it API-owned, refetchable, cacheable, or invalidation-sensitive?
  Yes -> TanStack Query

Is it shared browser/UI state with a concrete need beyond one component tree?
  Maybe -> Zustand, only if the current approach is actually painful

Is it used only by one component or form?
  Yes -> local useState/useReducer
```

This is intentionally not "everything shared goes to Zustand". The highest-ROI
fix is server-state separation, not a repo-wide client-store migration.

## Target Architecture

### Shared Frontend Query Conventions

Create app-local query modules rather than one giant query file.

Recommended ERP layout:

```text
apps/erp/src/lib/query/
  client.tsx
  keys.ts
  products.ts
  categories.ts
  offers.ts
  advices.ts
  orders.ts
  sales.ts
```

Recommended storefront layout:

```text
apps/storefront/src/lib/query/
  client.tsx
  keys.ts
  wishlist.ts
  orders.ts
  catalog.ts
```

Keep existing API clients as the low-level HTTP layer:

- `apps/erp/src/lib/api/client.ts`
- `apps/storefront/src/lib/api/client.ts`

Query modules should call those clients. Components should call query hooks, not
raw `fetch()`, except for server components and static-generation helpers.

### Query Provider Placement

ERP:

- Add `QueryClientProvider` under `AdminAuthProvider` in `apps/erp/src/app/layout.tsx`.
- Use conservative defaults for admin data:
  - `staleTime`: short, tuned per screen rather than one hard global assumption
  - `refetchOnWindowFocus`: enabled where operational freshness matters
  - `retry`: low or disabled for auth-sensitive mutations

Storefront:

- Add `QueryClientProvider` around client providers in `apps/storefront/src/app/[lang]/layout.tsx`.
- Keep server-rendered catalog pages as server data unless a component already
  fetches client-side.
- Use Query mainly for client-only authenticated data and shared client-side
  catalog resolution where it removes duplication.

### Zustand Placement

Zustand is optional, not the main goal of this plan.

Only introduce it where a real shared browser-state problem exists.

Possible future candidates:

```text
apps/storefront/src/lib/stores/
  cart-store.ts
  ui-store.ts

apps/erp/src/lib/stores/
  admin-session-store.ts
  ui-store.ts
```

Do **not** put products, categories, offers, orders, or sales into Zustand.
Those belong in TanStack Query.

Do **not** treat cart/auth Zustand migration as required for the ERP server-state
cleanup to be successful.

## Phase 0 - Dependencies and Setup

Add dependencies needed for the Query migration:

- `@tanstack/react-query`
- `@tanstack/react-query-devtools` as optional dev tooling

Only add `zustand` in the same phase if a concrete follow-up PR is actually going
to use it soon. Otherwise, defer it.

Update:

- `apps/erp/package.json`
- `apps/storefront/package.json`
- `pnpm-lock.yaml`

Add query providers:

- `apps/erp/src/lib/query/client.tsx`
- `apps/storefront/src/lib/query/client.tsx`

Add provider wiring:

- `apps/erp/src/app/layout.tsx`
- `apps/storefront/src/app/[lang]/layout.tsx`

Verification:

- `pnpm --filter @capella/erp lint`
- `pnpm --filter @capella/storefront lint`
- Existing provider tests should still pass.

## Phase 1 - ERP Query Foundation

Start with read-only queries before moving mutations.

Create query keys:

- `erp.products`
- `erp.categories`
- `erp.offers`
- `erp.advices`
- `erp.orders`
- `erp.sales`
- `erp.order(id)`

Create hooks:

- `useErpProducts()`
- `useErpCategories()`
- `useErpOffers()`
- `useErpAdvices()`
- `useErpOrders()`
- `useErpSales()`
- `useErpOrder(orderId)`

Move normalization from `apps/erp/src/lib/store.ts` into reusable mapper modules:

```text
apps/erp/src/lib/api/mappers.ts
```

or colocate narrowly:

```text
apps/erp/src/lib/query/products.ts
apps/erp/src/lib/query/categories.ts
```

Prefer mapper extraction if both list and detail flows need the same shape.

First page migrations:

- `apps/erp/src/app/dashboard/page.tsx`
- `apps/erp/src/app/sales/page.tsx`
- `apps/erp/src/app/orders/page.tsx`

These are good first targets because they mostly read data and do not own
complex form submit behavior.

Keep `apps/erp/src/lib/store.ts` during this phase. Do not remove it until all
consumers are migrated.

Verification:

- `pnpm --filter @capella/erp test -- tests/sales-page.test.tsx`
- `pnpm --filter @capella/erp test -- tests/orders-page.test.tsx`
- `pnpm --filter @capella/erp test -- tests/store.test.ts` until the store is removed or tests are replaced.

## Phase 2 - ERP Mutations and Invalidation

Replace `getStore().method()` calls with mutation hooks.

Create mutation hooks:

- `useUpsertProduct()`
- `useSoftDeleteProduct()`
- `useRestoreProduct()`
- `useHardDeleteProduct()`
- `useToggleProductStatus()`
- `useSetVariantStock()`
- `useUpsertCategory()`
- `useSoftDeleteCategory()`
- `useRestoreCategory()`
- `useUpsertOffer()`
- `useSoftDeleteOffer()`
- `useRestoreOffer()`
- `useToggleOfferStatus()`
- `useUpsertAdvice()`
- `useToggleAdviceStatus()`
- `useDeleteAdvice()`
- `useUpdateOrderPaymentStatus()`

Invalidation rules:

- Product create/edit/delete/toggle/restore:
  - invalidate `erp.products`
  - invalidate `erp.sales` if stock/sales-derived data can change
- Category create/edit/delete/restore:
  - invalidate `erp.categories`
  - invalidate `erp.products` if category display or filtering depends on category state
- Offer create/edit/delete/toggle/restore:
  - invalidate `erp.offers`
  - invalidate `erp.products` if offer display depends on product/variant links
- Advice create/edit/delete/toggle:
  - invalidate `erp.advices`
- Order payment update:
  - invalidate `erp.orders`
  - invalidate `erp.order(id)`
  - invalidate `erp.sales`

Touching files:

- `apps/erp/src/components/forms/product-form.tsx`
- `apps/erp/src/components/forms/category-form.tsx`
- `apps/erp/src/components/forms/offer-form.tsx`
- `apps/erp/src/components/forms/advice-form.tsx`
- `apps/erp/src/components/orders/order-details-view.tsx`
- `apps/erp/src/app/products/page.tsx`
- `apps/erp/src/app/categories/page.tsx`
- `apps/erp/src/app/offers/page.tsx`
- `apps/erp/src/app/advices/page.tsx`
- `apps/erp/src/app/trash/page.tsx`

Verification:

- Existing ERP page/form tests near each migrated file.
- Add or update tests for mutation invalidation if the behavior is visible.
- Keep API route tests as the source of truth for actual backend mutation behavior.

## Phase 3 - Remove ERP Custom Store

After all `useStore()` and `getStore()` references are gone:

- Delete `apps/erp/src/lib/store.ts`.
- Replace `apps/erp/tests/store.test.ts` with focused query hook or page behavior tests.
- Remove custom auth listener coupling from the deleted store.
- Keep `apps/erp/src/lib/api/client.ts` as the HTTP client and token holder unless auth is migrated separately.

Before deleting, verify:

```powershell
rg -n "useStore\\(|getStore\\(|ErpStore|useSyncExternalStore" apps/erp
```

Expected result after migration: no references except possibly old tests that should be removed.

Verification:

- `pnpm --filter @capella/erp test`
- `pnpm --filter @capella/erp lint`

## Phase 4 - Storefront Query Migration

Use TanStack Query for client-only API fetches. Do not convert server components
unless there is a specific interactivity or cache-sharing reason.

First targets:

- `apps/storefront/src/components/orders/orders-view.tsx`
- `apps/storefront/src/components/orders/order-detail-view.tsx`
- `apps/storefront/src/components/wishlist/wishlist-view.tsx`
- `apps/storefront/src/components/providers/wishlist-provider.tsx`

Create hooks:

- `useCustomerOrders(accessToken)`
- `useCustomerOrder(orderId, accessToken)`
- `useWishlistIds(accessToken)`
- `useToggleWishlistProduct()`

Wishlist should use optimistic updates with rollback:

- cancel current wishlist query
- snapshot previous IDs
- optimistically update IDs
- rollback on error
- invalidate on settle

Cart/checkout product resolution:

- Convert `cart-view.tsx` and `checkout-view.tsx` product/offer fetches to shared query hooks.
- This de-duplicates loading and keeps product/offer resolution consistent.

Files:

- `apps/storefront/src/lib/query/wishlist.ts`
- `apps/storefront/src/lib/query/orders.ts`
- `apps/storefront/src/lib/query/catalog.ts`
- `apps/storefront/src/components/wishlist/wishlist-view.tsx`
- `apps/storefront/src/components/providers/wishlist-provider.tsx`
- `apps/storefront/src/components/orders/orders-view.tsx`
- `apps/storefront/src/components/orders/order-detail-view.tsx`
- `apps/storefront/src/components/cart/cart-view.tsx`
- `apps/storefront/src/components/checkout/checkout-view.tsx`

Verification:

- `pnpm --filter @capella/storefront test -- tests/components/orders-view.test.tsx`
- `pnpm --filter @capella/storefront test -- tests/components/auth-provider.test.tsx`
- Add wishlist optimistic rollback tests if the provider/hook is changed.

## Phase 5 - Optional Zustand Adoption

This phase is optional. Do it only if there is a concrete client-state pain after
the ERP Query migration and storefront Query cleanup.

### Possible candidate: storefront cart

Cart could move to Zustand because it is shared browser state used by header,
cart, checkout, product detail, and offer detail.

But this is not mandatory. The current Context-based cart is acceptable unless:

- selector performance becomes a problem
- provider composition becomes painful
- testing/store ergonomics become materially worse than a small Zustand store
- more independent cart consumers appear and the current boundary gets awkward

If cart is migrated, replace or wrap:

- `apps/storefront/src/components/providers/cart-provider.tsx`
- `apps/storefront/src/lib/cart.ts`

Create:

- `apps/storefront/src/lib/stores/cart-store.ts`

Store shape:

- `lines`
- `hydrated`
- `count`
- `add(line)`
- `setQty(key, qty)`
- `remove(key)`
- `clear()`
- `keyOf(line)`
- `hydrate(storage)`

Use Zustand `persist` only if it can preserve the existing `capella` cart
storage shape or include a migration. Otherwise, keep explicit
`loadCartLines` and `saveCartLines` for compatibility.

Consumers:

- `apps/storefront/src/components/layout/header.tsx`
- `apps/storefront/src/components/products/product-detail.tsx`
- `apps/storefront/src/components/offers/offer-detail.tsx`
- `apps/storefront/src/components/cart/cart-view.tsx`
- `apps/storefront/src/components/checkout/checkout-view.tsx`

Migration option:

- Keep `CartProvider` temporarily as a compatibility wrapper that renders
  children and hydrates the store.
- Then convert `useCart()` to read from Zustand.
- Later remove the Context if no longer needed.

Verification:

- `pnpm --filter @capella/storefront test -- tests/unit/cart.test.ts`
- `pnpm --filter @capella/storefront test -- tests/components/product-detail.test.tsx`

## Phase 6 - Auth Migration

Do not move auth first. Auth is cross-cutting and currently tied to refresh-cookie
behavior, access-token memory, local/session storage, and API clients.

Move auth in its own separate phase after TanStack Query and any justified Zustand
migration are stable.

If auth is moved, use app-local stores:

- `apps/storefront/src/lib/stores/auth-store.ts`
- `apps/erp/src/lib/stores/admin-auth-store.ts`

Do not share one auth store across ERP and storefront. They use different routes,
cookies, storage keys, and account models.

Why separate it:

- It affects hydration timing.
- It affects refresh-token and logout behavior.
- It affects how API clients read access tokens.
- It is higher-risk than ERP Query migration, wishlist/orders Query migration,
  or optional cart cleanup.

## What Not To Do

- Do not install Redux for the current problem.
- Do not put API data into Zustand as a general cache.
- Do not convert server-rendered storefront catalog pages into client components
  just to use Query.
- Do not replace all `useState` usage.
- Do not migrate auth, cart, wishlist, and ERP store in one PR.
- Do not delete `apps/erp/src/lib/store.ts` until every consumer has been migrated.
- Do not assume a large file is fixed simply by moving it to Zustand. Separation
  of concerns is the primary fix.

## Recommended PR Sequence

1. Add TanStack Query dependencies and providers only.
2. Add ERP query keys/hooks and migrate one read-only ERP page.
3. Migrate remaining ERP read pages.
4. Add ERP mutation hooks and migrate one entity at a time: categories, advices, offers, products, orders.
5. Remove ERP custom store after all references are gone.
6. Move storefront orders and wishlist client fetches to TanStack Query.
7. Consolidate cart/checkout product and offer resolution if still duplicated.
8. Consider Zustand only for a concrete leftover client-state problem such as cart ergonomics.
9. Migrate auth separately in its own phase if Context is no longer the desired boundary.

## Test Strategy

Read existing tests before creating replacements. Keep tests near current app conventions.

Targeted ERP commands:

```powershell
pnpm --filter @capella/erp test -- tests/store.test.ts
pnpm --filter @capella/erp test -- tests/products-page.test.tsx
pnpm --filter @capella/erp test -- tests/category-form.test.tsx
pnpm --filter @capella/erp test -- tests/offers-page.test.tsx
pnpm --filter @capella/erp test -- tests/advices-page.test.tsx
pnpm --filter @capella/erp test -- tests/orders-page.test.tsx
pnpm --filter @capella/erp test -- tests/order-detail-page.test.tsx
pnpm --filter @capella/erp test -- tests/sales-page.test.tsx
```

Targeted storefront commands:

```powershell
pnpm --filter @capella/storefront test -- tests/unit/cart.test.ts
pnpm --filter @capella/storefront test -- tests/components/auth-provider.test.tsx
pnpm --filter @capella/storefront test -- tests/components/product-detail.test.tsx
pnpm --filter @capella/storefront test -- tests/components/product-card.test.tsx
pnpm --filter @capella/storefront test -- tests/components/orders-view.test.tsx
```

Broader verification after major phases:

```powershell
pnpm --filter @capella/erp lint
pnpm --filter @capella/storefront lint
pnpm --filter @capella/erp test
pnpm --filter @capella/storefront test
pnpm lint
pnpm test
```

## Acceptance Criteria

The migration is successful when:

- `apps/erp/src/lib/store.ts` is deleted or reduced to no server-state responsibility.
- No ERP page or form imports `getStore()` or `useStore()` from the custom store.
- ERP server data uses TanStack Query hooks with clear query keys and mutation invalidation.
- Storefront client-only authenticated data uses TanStack Query where it improves correctness and duplication.
- Storefront server-rendered catalog pages remain server-rendered unless there is a concrete reason to make them client-side.
- Any Zustand adoption is justified by a real client-state need, not by policy alone.
- Existing behavior tests pass, and new tests cover changed invalidation/optimistic behavior.

## Final Recommendation

Use **TanStack Query as the primary fix** because the current pain is mostly
API/server state, especially in ERP.

Use **Zustand only if a concrete shared browser-state problem remains** after the
server-state cleanup and selective storefront Query migration.

Avoid Redux for now. The repo does not justify it.
