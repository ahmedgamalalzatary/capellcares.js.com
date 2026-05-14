# Capella Project Bug Audit

> Verified against the current project files, `docs/folder-structure.md`, and `docs/storefront-erp-spec.md` after the documentation decisions captured in this branch.

## Executive Summary

The project has a usable storefront UI and ERP UI shell, but the implementation is not yet aligned with the locked architecture. The largest problem is a split data model: storefront and ERP catalog endpoints read and write `apps/api/data.json`, while the MySQL/Drizzle layer is only partially used for checkout orders.

The current system can demo catalog browsing and ERP CRUD from a JSON file, but it is not production-functional for the specified storefront + ERP requirements. The main implementation gaps are database-backed catalog management, real auth, DB-backed wishlist, COD checkout wiring, uploads, validation, and shared DTO/schema contracts.

PayMob is no longer a bug for v1 because online payment integration has been explicitly removed from current scope.

---

## 1. Verified Structural Gaps vs Current Docs

### Root Setup Files

| Path | Status | Impact |
|---|---:|---|
| `README.md` | Added in Phase 1 | Project setup/run documentation now exists. |
| `.env.example` | Added in Phase 1 | Required current/planned environment variables are documented. |

### No Longer Bugs

| Previous Item | Current Decision |
|---|---|
| `cat.txt` missing | Not required. Category tree lives in `docs/storefront-erp-spec.md`. |
| `packages/eslint-config/` missing | Not required for now. |
| `packages/tsconfig/` missing | Not required for now. |
| Split storefront API files missing | Not required. Centralized `client.ts` is acceptable for now. |
| Split ERP API files missing | Not required. Centralized `client.ts` + store is acceptable for now. |
| `messages/ar.json` / `messages/en.json` missing | Not required. Static translation is centralized in `packages/shared/src/i18n`. |
| Optional folders like `hooks/`, `styles/`, `types/`, `validators/` missing | Not required until needed. |

### Important Route Composition Correction

`apps/api/src/routes/storefront.routes.ts` and `apps/api/src/routes/erp.routes.ts` exist, but `apps/api/src/routes/index.ts` does not mount them. It mounts `catalogRoutes` and `adminRoutes` directly instead, bypassing the intended route-group composition and middleware.

---

## 2. Critical Architecture / Data Layer Bugs

| Issue | Severity | Evidence | Impact |
|---|---:|---|---|
| Catalog API uses JSON file, not MySQL | Critical | `catalog.controller.ts` imports `getState` from `data/file-store.ts`. | Storefront catalog is not reading the shared ERP database. |
| ERP API uses JSON file, not MySQL | Critical | `admin.controller.ts` imports `getState`, `save`, and `nextId` from `data/file-store.ts`. | ERP CRUD does not manage the Drizzle/MySQL catalog tables. |
| Checkout/orders use MySQL separately | Critical | `orders.service.ts` and `order.repository.ts` use Drizzle tables. | Orders validate variant IDs against DB variants, while cart/catalog variants shown to users come from JSON, so real checkout can fail or deduct unrelated stock. |
| Most repositories are empty | High | `category.repository.ts`, `offer.repository.ts`, `customer.repository.ts`, `wishlist.repository.ts`, `product-variant.repository.ts`, `offer-item.repository.ts`, `order-item.repository.ts` are `export {}`. | Expected DB repository layer is mostly absent. |
| Database category seed is incomplete | High | `categories.seed.ts` inserts only 4 categories. | It does not seed the full category tree specified by the docs. |
| `DATABASE_URL` requires real local value | Low | `.env.example` now documents the variable; developers must still provide a real local DB URL. | New environments need local credential configuration. |

---

## 3. API Route and Middleware Bugs

| Issue | Severity | Evidence | Impact |
|---|---:|---|---|
| Intended storefront route group is unused | High | `routes/index.ts` mounts `catalogRoutes` directly under `/api/v1`. | `localeMiddleware` from `storefront.routes.ts` is not applied. |
| Intended ERP route group is unused | Critical | `routes/index.ts` mounts `adminRoutes` directly under `/api/erp`. | `adminAuthMiddleware` from `erp.routes.ts` is not applied. ERP API routes are unprotected. |
| `admin-auth.middleware.ts` is a bypass | Critical | Middleware only calls `next()`. | Even if mounted, it would not authenticate admin requests. |
| `auth.middleware.ts` is empty | Critical | File contains `export {}`. | No customer auth protection exists. |
| `validate.middleware.ts` is empty | High | File contains `export {}`. | API requests are not centrally validated. |
| `error.middleware.ts` is empty | Medium | File contains `export {}`. | Errors are handled inconsistently per controller. |
| `locale.middleware.ts` is not active | High | Middleware exists but unused by mounted routes. | API response shaping/search behavior cannot use normalized locale. |
| Storefront auth routes are empty | Critical | `auth.controller.ts`, `auth.routes.ts`, `auth.service.ts`, `auth.schemas.ts` are `export {}`. | Signup/login required by spec are not implemented. |
| Wishlist routes are empty | Critical | All files in `modules/wishlist` are `export {}`. | DB-backed wishlist required by spec is absent. |
| Upload routes are empty | High | All files in `modules/uploads` are `export {}`. | Hostinger/image upload boundary is absent. |
| Customer routes are empty | High | All files in `modules/customers` are `export {}`. | Customer management/auth backing is absent. |
| Admin product submodule is incomplete | Medium | `admin-products.service.ts` has partial DB create logic, but routes mounted are legacy `admin.routes.ts`. | DB-based admin product implementation is not actually used by current routing. |
| Admin category/offer submodules are empty | High | Admin category/offer module files are `export {}`. | Intended modular admin APIs are absent. |

---

## 4. Storefront Bugs vs Spec

| Issue | Severity | Evidence | Impact |
|---|---:|---|---|
| Checkout UI is fake | Critical | `checkout-view.tsx` waits 700ms, generates `CPL-XXXXXX`, clears cart, and never posts to `/api/v1/checkout`. | Orders are not saved from storefront checkout. |
| Checkout payload shape mismatch | Critical | UI fields are `city` and `building`; API expects `cityArea` and `buildingApartment`. | Direct wiring would fail without mapping/contracts. |
| Checkout notes contract is stale in API/DB | Medium | Current API requires notes and DB column is `notNull`; updated spec says notes are optional. | API/DB must be updated to allow optional notes. |
| Payment UI still includes PayMob | Medium | `checkout-view.tsx` renders a PayMob radio option. | Online payment is removed from v1 scope and should be removed from UI/contracts. |
| Auth is mocked | Critical | `auth-provider.tsx` stores a fake user in localStorage after a timeout. | Signup/login do not call backend, hash passwords, or create customers. |
| Wishlist is localStorage-only | Critical | `wishlist-provider.tsx` persists IDs under `capella.wishlist.v1`. | Spec requires login-only, DB-backed, cross-device wishlist. |
| Guest wishlist behavior is wrong | High | Product card/wishlist provider can toggle locally without requiring login. | Violates spec requirement to warn and redirect guests. |
| Storefront API client does not send `x-lang` | High | `getJSON()` in `src/lib/api/client.ts` sends no locale header. | Localized response shaping cannot work consistently. |
| `/products` does not use API search params | Medium | `products/page.tsx` calls `fetchProducts()` with no query params, then filters in `ProductGrid`. | Search should be server-side. |
| API search behavior does not match updated spec | Medium | `catalog.controller.ts` searches both language names, SKU, and keywords. | Search should use product names and keywords, not SKU, and should handle query language intentionally. |
| Product detail over-fetches | Medium | `products/[slug]/page.tsx` fetches product, categories, all offers, and all products. | Inefficient and should be served by targeted endpoints/DTOs. |
| Offer detail over-fetches | Medium | `offers/[slug]/page.tsx` fetches all products to resolve offer items. | Inefficient and fragile; API should return resolved offer item details. |
| Offer visibility model is not explicit in code | Medium | Current code uses `status === active`; updated spec distinguishes visible/hidden and out-of-stock. | Code/contracts need to match ERP visibility semantics. |
| Product flags missing | Medium | Spec requires `isNew` and `isBestseller`; current product model does not consistently expose/manage them. | Storefront filters/badges cannot be implemented correctly. |

---

## 5. ERP Bugs vs Spec

| Issue | Severity | Evidence | Impact |
|---|---:|---|---|
| ERP login is hardcoded only | Critical | `admin-auth.tsx` uses `admin@capella.eg / admin1234`. | Spec requires DB-backed admin auth; hardcoded credentials may remain only as warned dev fallback. |
| ERP API is unprotected | Critical | Current mounted `/api/erp` routes do not use `adminAuthMiddleware`; that middleware is also a no-op. | Anyone can call admin APIs. |
| ERP writes JSON data, not DB | Critical | `admin.controller.ts` uses `file-store.ts`. | ERP is not controlling the shared MySQL catalog. |
| Image upload is mocked | High | `image-upload.tsx` converts files to data URLs; upload service/routes are empty. | Images are not stored through Hostinger/API boundary. |
| Category delete protection only checks direct products | Medium | `adminSoftDeleteCategory` checks `p.categoryId === id`. | Parent categories with linked descendant products can be deleted. |
| Category delete does not protect active child categories | Medium | No check for non-deleted child categories before soft delete. | Can leave orphaned active children. |
| Activation rules are client-only/partial | High | Product form validates some fields before active status, but API accepts posted product objects without server validation. | Invalid active products can be created through API. |
| Direct stock update is JSON-only | High | `adminSetVariantStock` updates variants in `data.json`, not DB. | Storefront/checkout stock behavior diverges from persisted orders. |
| Slug generation is duplicated | Low | Slug logic exists in forms and partial admin service; `slug.service.ts` is empty. | Slug behavior can drift and is not centralized. |

---

## 6. Database / Schema Issues

| Issue | Severity | Evidence | Impact |
|---|---:|---|---|
| DB schema is not wired to catalog APIs | Critical | Product/category/offer catalog controllers use JSON file store. | MySQL catalog tables are mostly unused. |
| `orders.notes` should be nullable | Medium | Updated spec says notes are optional; schema currently has `notes.notNull()`. | Checkout without notes would fail after real wiring. |
| Order items do not support offers/snapshots | High | Current `order_items` only stores `variantId`, qty, unit price, line total. | Orders must support product variants and offers with historical snapshot fields. |
| No foreign key constraints are declared | Accepted for now | User explicitly chose no FK constraints for now. | Integrity must be enforced in application services. |
| Product draft model conflicts with DB `notNull` fields | Medium | Spec allows partial drafts but exact draft schema is unresolved. | Avoid overbuilding draft persistence until decision is made. |
| Product flags missing in DB schema | Medium | Current schema has no `isNew` or `isBestseller`. | Required storefront badges/filters need persistence. |

---

## 7. Shared Package Contract Problems

| Issue | Severity | Evidence | Impact |
|---|---:|---|---|
| DTO files are empty | High | All files in `packages/shared/src/dto/` are `export {}`. | No shared API data contracts. |
| Schema files are empty | High | All files in `packages/shared/src/schemas/` are `export {}`. | No shared Zod validation contracts. |
| Product variant type mismatch | High | Shared type uses `size`, `price`, `stock`; DB uses `sizeLabel`, `sellingPrice`, `stockQty`. | Mapping/DTO layer is required. |
| Checkout field mismatch | High | Shared `CheckoutForm` uses `city`, `building`; API/DB use `cityArea`, `buildingApartment`. | Frontend/API integration will break without adapters/contracts. |
| Payment methods still include PayMob | Medium | Shared constants include `paymob`. | Updated v1 scope is COD only. |

---

## 8. What Is Working / Partially Working

| Area | Status |
|---|---|
| Storefront route shell | Present for products, category, offers, cart, checkout, wishlist, login, signup under `[lang]`. |
| ERP route shell | Present for dashboard, products, categories, offers, trash, login. |
| Storefront catalog demo | Works from JSON-backed API for active/non-deleted products and offers. |
| ERP CRUD demo | Works against `apps/api/data.json`. |
| Category descendant filtering in API | Implemented in `catalog.controller.ts` when `category` query is used. |
| Category descendant filtering on category page | Implemented client-side through `getProductsByCategory`. |
| Drizzle order repository | Exists and uses a transaction to deduct stock and insert order/items for variants. |
| Bilingual UI dictionaries | Present in `packages/shared/src/i18n`. |
| Mock data | Products, categories, and offers exist in `packages/shared/src/mock`. |
| Soft delete UI | ERP trash/restore flow exists for JSON-backed data. |

---

## 9. Priority Fix Plan

### Phase 1: Foundation

1. Add `.env.example` and `README.md`.
2. Remove PayMob from shared constants, checkout UI, docs-linked API contracts, and backend module expectations.
3. Mount `storefrontRoutes` and `erpRoutes` from `routes/index.ts` instead of direct legacy routes.
4. Implement consistent error/validation middleware shape.
5. Add shared DTOs and Zod schemas for current v1 contracts.

### Phase 2: Database-backed Runtime

1. Replace JSON catalog/admin persistence with Drizzle repositories for products, variants, categories, offers, and offer items.
2. Update DB schema for optional order notes, order item offer support/snapshots, product flags, and offer visibility.
3. Seed the documented category tree into MySQL.
4. Keep JSON/mock data only as development seed/migration input if needed.

### Phase 3: Auth, Wishlist, Checkout

1. Implement customer signup/login with secure password hashing and JWT/HTTP-only refresh-cookie flow.
2. Implement DB-backed admin auth while clearly warning about any temporary hardcoded dev fallback.
3. Protect all `/api/erp/*` routes.
4. Implement DB-backed wishlist routes and frontend guest-warning/login behavior.
5. Wire checkout frontend to `/api/v1/checkout` for COD orders with product variant and offer lines.

### Phase 4: ERP/Storefront Correctness

1. Implement Hostinger upload service boundary with env placeholders.
2. Enforce activation rules server-side.
3. Fix category delete protection for descendant products and active children.
4. Implement server-side search by product names and keywords, excluding SKU.
5. Add targeted detail endpoints/DTOs for product offer badges and resolved offer item data.
6. Add tests around checkout stock deduction, offer stock deduction, category deletion rules, auth, and wishlist persistence.

