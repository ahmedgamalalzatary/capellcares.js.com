# TanStack Query Adoption Plan

## Goal

Adopt **TanStack Query** in `apps/erp` and `apps/storefront` to replace manual
server-state handling and duplicated client fetch orchestration.

This document is intentionally TanStack-only.

## What To Change

Use TanStack Query for:

- ERP API-owned state: products, categories, collections, offers, advices,
  orders, sales
- storefront authenticated client fetches: wishlist and customer orders
- storefront shared client-side catalog fetches used by cart and checkout

Do not move server-rendered storefront catalog pages to client query hooks.

## Why This Repo Needs It

### ERP

The current server-state owner is the custom store:

- `apps/erp/src/lib/store.ts`
- `apps/erp/src/lib/store/core.ts`

It currently mixes:

- fetch orchestration
- caching
- normalization
- mutations
- refetch rules
- auth hydration coupling
- focus refresh
- React subscriptions

Main consumers to migrate:

- `apps/erp/src/app/dashboard/page.tsx`
- `apps/erp/src/app/sales/page.tsx`
- `apps/erp/src/app/orders/page.tsx`
- `apps/erp/src/app/products/page.tsx`
- `apps/erp/src/app/products/new/page.tsx`
- `apps/erp/src/app/products/[id]/edit/page.tsx`
- `apps/erp/src/app/categories/page.tsx`
- `apps/erp/src/app/categories/new/page.tsx`
- `apps/erp/src/app/categories/[id]/edit/page.tsx`
- `apps/erp/src/app/offers/page.tsx`
- `apps/erp/src/app/offers/new/page.tsx`
- `apps/erp/src/app/offers/[id]/edit/page.tsx`
- `apps/erp/src/app/collections/page.tsx`
- `apps/erp/src/app/collections/new/page.tsx`
- `apps/erp/src/app/collections/[id]/edit/page.tsx`
- `apps/erp/src/app/advices/page.tsx`
- `apps/erp/src/app/advices/[id]/edit/page.tsx`
- `apps/erp/src/app/trash/page.tsx`
- `apps/erp/src/hooks/use-products-page.ts`
- `apps/erp/src/hooks/use-trash-page.ts`
- `apps/erp/src/hooks/forms/use-product-form.ts`
- `apps/erp/src/hooks/forms/use-offer-form.ts`
- `apps/erp/src/hooks/forms/use-collection-form.ts`
- `apps/erp/src/components/forms/category-form.tsx`
- `apps/erp/src/components/forms/advice-form.tsx`
- `apps/erp/src/components/orders/order-details-view.tsx`

### Storefront

The current issue is duplicated client fetching in:

- `apps/storefront/src/components/providers/wishlist-provider.tsx`
- `apps/storefront/src/components/wishlist/wishlist-view.tsx`
- `apps/storefront/src/components/orders/orders-view.tsx`
- `apps/storefront/src/components/orders/order-detail-view.tsx`
- `apps/storefront/src/components/providers/cart-provider.tsx`
- `apps/storefront/src/components/cart/cart-view.tsx`
- `apps/storefront/src/hooks/use-checkout.ts`

## File Structure

### ERP

Create:

```text
apps/erp/src/lib/query/
  client.tsx
  keys.ts
  products.ts
  categories.ts
  collections.ts
  offers.ts
  advices.ts
  orders.ts
  sales.ts
```

Keep:

- `apps/erp/src/lib/api/client.ts`

### Storefront

Create:

```text
apps/storefront/src/lib/query/
  client.tsx
  keys.ts
  wishlist.ts
  orders.ts
  catalog.ts
```

Keep:

- `apps/storefront/src/lib/api/client.ts`

## Provider Wiring

### ERP

Update:

- `apps/erp/src/app/layout.tsx`

Target tree:

```tsx
<AdminAuthProvider>
  <ErpQueryProvider>
    <ErpToaster />
    {children}
  </ErpQueryProvider>
</AdminAuthProvider>
```

### Storefront

Update:

- `apps/storefront/src/app/[lang]/layout.tsx`

Target tree:

```tsx
<AuthProvider>
  <StorefrontQueryProvider>
    <WishlistProvider>
      <CartProvider>{children}</CartProvider>
    </WishlistProvider>
  </StorefrontQueryProvider>
</AuthProvider>
```

## Query Keys

### ERP

Create in:

- `apps/erp/src/lib/query/keys.ts`

Keys:

- `erpKeys.products()`
- `erpKeys.categories()`
- `erpKeys.collections()`
- `erpKeys.offers()`
- `erpKeys.advices()`
- `erpKeys.orders()`
- `erpKeys.order(id)`
- `erpKeys.sales()`

### Storefront

Create in:

- `apps/storefront/src/lib/query/keys.ts`

Keys:

- `storefrontKeys.wishlist(customerId)`
- `storefrontKeys.orders(customerId)`
- `storefrontKeys.order(customerId, orderId)`
- `storefrontKeys.catalog(lang)`

## Hook Names

### ERP Read Hooks

- `useErpProducts()`
- `useErpCategories()`
- `useErpCollections()`
- `useErpOffers()`
- `useErpAdvices()`
- `useErpOrders()`
- `useErpOrder(orderId: number)`
- `useErpSales()`

### ERP Mutation Hooks

- `useUpsertProduct()`
- `useSoftDeleteProduct()`
- `useRestoreProduct()`
- `useHardDeleteProduct()`
- `useToggleProductStatus()`
- `useSetVariantStock()`
- `useUpsertCategory()`
- `useSoftDeleteCategory()`
- `useRestoreCategory()`
- `useUpsertCollection()`
- `useSoftDeleteCollection()`
- `useRestoreCollection()`
- `useToggleCollectionStatus()`
- `useUpsertOffer()`
- `useSoftDeleteOffer()`
- `useRestoreOffer()`
- `useToggleOfferStatus()`
- `useUpsertAdvice()`
- `useToggleAdviceStatus()`
- `useDeleteAdvice()`
- `useUpdateOrderPaymentStatus()`

### Storefront Hooks

- `useWishlistIds(accessToken, customerId)`
- `useToggleWishlistProduct()`
- `useCustomerOrders(accessToken, customerId)`
- `useCustomerOrder(orderId, accessToken, customerId)`
- `useCatalogSnapshot(lang)`

## Invalidation Rules

### ERP

- product mutations: invalidate `products`, `sales`
- category mutations: invalidate `categories`, `products`
- collection mutations: invalidate `collections`, `products`
- offer mutations: invalidate `offers`, `products`
- advice mutations: invalidate `advices`
- order payment-status mutations: invalidate `orders`, `order(id)`, `sales`

### Storefront

- wishlist toggle: optimistic update, rollback on error, invalidate on settle
- orders: scope by customer id
- catalog: one shared query for products, offers, collections

## Migration Order

### Phase 0 - Dependencies And Providers

Update:

- `apps/erp/package.json`
- `apps/storefront/package.json`
- `pnpm-lock.yaml`
- `apps/erp/src/app/layout.tsx`
- `apps/storefront/src/app/[lang]/layout.tsx`

Create:

- `apps/erp/src/lib/query/client.tsx`
- `apps/storefront/src/lib/query/client.tsx`

Add:

- `@tanstack/react-query`
- optional `@tanstack/react-query-devtools`

### Phase 1 - ERP Read Queries

Create:

- `apps/erp/src/lib/query/keys.ts`
- `apps/erp/src/lib/query/products.ts`
- `apps/erp/src/lib/query/categories.ts`
- `apps/erp/src/lib/query/collections.ts`
- `apps/erp/src/lib/query/offers.ts`
- `apps/erp/src/lib/query/advices.ts`
- `apps/erp/src/lib/query/orders.ts`
- `apps/erp/src/lib/query/sales.ts`

Migrate first:

- `apps/erp/src/app/dashboard/page.tsx`
- `apps/erp/src/app/sales/page.tsx`
- `apps/erp/src/app/orders/page.tsx`

Then migrate read dependencies in:

- `apps/erp/src/app/products/new/page.tsx`
- `apps/erp/src/app/products/[id]/edit/page.tsx`
- `apps/erp/src/app/offers/new/page.tsx`
- `apps/erp/src/app/offers/[id]/edit/page.tsx`
- `apps/erp/src/app/collections/new/page.tsx`
- `apps/erp/src/app/collections/[id]/edit/page.tsx`
- `apps/erp/src/app/categories/new/page.tsx`
- `apps/erp/src/app/categories/[id]/edit/page.tsx`
- `apps/erp/src/app/advices/[id]/edit/page.tsx`

Leave the custom store in place temporarily for unmigrated writes.

### Phase 2 - ERP Mutations

Replace `getStore().*` in:

- categories:
  - `apps/erp/src/components/forms/category-form.tsx`
  - `apps/erp/src/app/categories/page.tsx`
  - `apps/erp/src/app/categories/new/page.tsx`
  - `apps/erp/src/app/categories/[id]/edit/page.tsx`
- advices:
  - `apps/erp/src/components/forms/advice-form.tsx`
  - `apps/erp/src/app/advices/page.tsx`
  - `apps/erp/src/app/advices/[id]/edit/page.tsx`
- offers:
  - `apps/erp/src/hooks/forms/use-offer-form.ts`
  - `apps/erp/src/app/offers/page.tsx`
  - `apps/erp/src/app/offers/new/page.tsx`
  - `apps/erp/src/app/offers/[id]/edit/page.tsx`
- collections:
  - `apps/erp/src/hooks/forms/use-collection-form.ts`
  - `apps/erp/src/app/collections/page.tsx`
  - `apps/erp/src/app/collections/new/page.tsx`
  - `apps/erp/src/app/collections/[id]/edit/page.tsx`
- products:
  - `apps/erp/src/hooks/forms/use-product-form.ts`
  - `apps/erp/src/hooks/use-products-page.ts`
  - `apps/erp/src/app/products/page.tsx`
  - `apps/erp/src/app/products/new/page.tsx`
  - `apps/erp/src/app/products/[id]/edit/page.tsx`
- orders and trash:
  - `apps/erp/src/components/orders/order-details-view.tsx`
  - `apps/erp/src/app/orders/page.tsx`
  - `apps/erp/src/hooks/use-trash-page.ts`
  - `apps/erp/src/app/trash/page.tsx`

### Phase 3 - Remove ERP Custom Store

Delete or replace:

- `apps/erp/src/lib/store.ts`
- `apps/erp/src/lib/store/core.ts`
- `apps/erp/src/lib/store/types.ts`

Before deletion:

```powershell
rg -n "useStore\\(|getStore\\(|ErpStore|useSyncExternalStore" apps/erp
```

### Phase 4 - Storefront Orders And Wishlist

Create:

- `apps/storefront/src/lib/query/keys.ts`
- `apps/storefront/src/lib/query/orders.ts`
- `apps/storefront/src/lib/query/wishlist.ts`

Migrate:

- `apps/storefront/src/components/providers/wishlist-provider.tsx`
- `apps/storefront/src/components/wishlist/wishlist-view.tsx`
- `apps/storefront/src/components/orders/orders-view.tsx`
- `apps/storefront/src/components/orders/order-detail-view.tsx`

Target behavior:

- `OrdersView` uses `useCustomerOrders(...)`
- `OrderDetailView` uses `useCustomerOrder(...)`
- wishlist becomes query-backed with optimistic rollback

### Phase 5 - Storefront Shared Catalog Query

Create:

- `apps/storefront/src/lib/query/catalog.ts`

Migrate:

- `apps/storefront/src/components/providers/cart-provider.tsx`
- `apps/storefront/src/components/cart/cart-view.tsx`
- `apps/storefront/src/hooks/use-checkout.ts`

Goal:

- replace repeated `Promise.all([fetchProducts(), fetchOffers(), fetchCollections()])`
- use one shared catalog query for products, offers, and collections

Do not migrate these pages to client query hooks:

- `apps/storefront/src/app/[lang]/products/page.tsx`
- `apps/storefront/src/app/[lang]/products/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/offers/page.tsx`
- `apps/storefront/src/app/[lang]/offers/[slug]/page.tsx`
- `apps/storefront/src/app/[lang]/collections/page.tsx`
- `apps/storefront/src/app/[lang]/collections/[slug]/page.tsx`

## Auth Boundary

Do not refactor auth during initial Query adoption.

Current auth files:

- ERP:
  - `apps/erp/src/components/providers/admin-auth.tsx`
  - `apps/erp/src/lib/api/client.ts`
- storefront:
  - `apps/storefront/src/components/providers/auth-provider.tsx`
  - `apps/storefront/src/lib/auth-provider.api.ts`
  - `apps/storefront/src/lib/auth-provider.storage.ts`

## Verification

### ERP

```powershell
pnpm --filter @capella/erp lint
pnpm --filter @capella/erp test -- tests/store.test.ts
pnpm --filter @capella/erp test -- tests/sales-page.test.tsx
pnpm --filter @capella/erp test -- tests/orders-page.test.tsx
pnpm --filter @capella/erp test -- tests/products-page.test.tsx
pnpm --filter @capella/erp test -- tests/category-form.test.tsx
pnpm --filter @capella/erp test -- tests/offers-page.test.tsx
pnpm --filter @capella/erp test -- tests/advices-page.test.tsx
pnpm --filter @capella/erp test -- tests/order-detail-page.test.tsx
pnpm --filter @capella/erp test
```

### Storefront

```powershell
pnpm --filter @capella/storefront lint
pnpm --filter @capella/storefront test -- tests/components/auth-provider.test.tsx
pnpm --filter @capella/storefront test -- tests/components/orders-view.test.tsx
pnpm --filter @capella/storefront test -- tests/unit/cart.test.ts
pnpm --filter @capella/storefront test -- tests/components/product-detail.test.tsx
pnpm --filter @capella/storefront test -- tests/components/product-card.test.tsx
pnpm --filter @capella/storefront test
```

### Workspace

```powershell
pnpm lint
pnpm test
```

## Acceptance Criteria

- ERP no longer uses the custom singleton store for runtime server state
- ERP pages and forms use TanStack Query hooks with explicit invalidation rules
- storefront wishlist and customer orders are query-backed
- storefront cart and checkout share one client-side catalog query
- server-rendered storefront catalog pages remain server-rendered
