# Capella Implementation Phases

This file tracks the agreed implementation order. Keep related edits together in the same phase and update this file when scope changes.

## Testing Rule

- Use TDD for runtime feature, bugfix, refactor, or behavior changes.
- Write the failing test first, verify it fails for the expected reason, then implement the minimal code to pass.
- Automated tests must live under `/tests` folders, for example:
  - `apps/api/tests/`
  - `apps/storefront/tests/`
  - `apps/erp/tests/`
  - `packages/shared/tests/`
  - `packages/database/tests/`
- Documentation-only/configuration-only changes may be verified with file checks, grep checks, typecheck/build where relevant, and manual review.

## Phase 1: Docs + Project Setup

- Add `README.md`.
- Add `.env.example`.
- Document dev ports and commands.
- Document required env vars.
- Keep docs aligned as decisions change.

## Phase 2: Remove PayMob / COD-Only Checkout Scope

- Remove PayMob from shared payment constants/types.
- Remove PayMob radio option from checkout UI.
- Remove PayMob backend module/routes/config references from active code.
- Update checkout/payment DTOs and schemas to COD-only.
- Ensure checkout docs/code use optional `notes`.

## Phase 3: API Route Foundation

- Mount `storefrontRoutes` and `erpRoutes` from `routes/index.ts`.
- Ensure `/api/v1/*` goes through storefront route group.
- Ensure `/api/erp/*` goes through ERP route group.
- Apply locale middleware to storefront routes.
- Apply admin auth middleware to ERP routes.
- Add consistent error middleware.
- Add validation middleware.

Status: Completed on 2026-05-15.

## Phase 4: Shared Contracts

- Fill `packages/shared/src/dto/*`.
- Fill `packages/shared/src/schemas/*` with Zod.
- Align checkout fields: `cityArea`, `buildingApartment`, optional `notes`.
- Align product/variant DTOs with DB mapping.
- Add offer/order DTOs supporting product variants and offers.
- Export clean shared contracts from `@capella/shared`.

Status: Completed on 2026-05-15.

## Phase 5: Database Schema Alignment

- Add product flags: `isNew`, `isBestseller`.
- Make `orders.notes` nullable.
- Extend `order_items` for item type, offer lines, and snapshot fields.
- Add offer visibility/status semantics.
- Keep no FK constraints, per product decision.
- Prepare/generate Drizzle migration strategy.

Status: Completed on 2026-05-15.

## Phase 6: DB Repositories + Data Migration

- Implement product/category/variant/offer/offer-item repositories.
- Replace catalog JSON reads with MySQL/Drizzle reads.
- Replace ERP JSON writes with MySQL/Drizzle writes.
- Seed the documented category tree into DB.
- Use current mock/JSON data only as migration/dev seed input if useful.
- Stop relying on `apps/api/data.json` as runtime source of truth.

Status: Completed on 2026-05-15.

## Phase 7: Catalog API + Storefront Search

- Implement storefront product/category/offer endpoints from DB.
- Server-side search by product names + keywords.
- Search handles Arabic/English based on query text.
- Category filtering includes descendant products.
- Hide inactive products.
- Hide hidden/deleted offers, but show visible out-of-stock offers.
- Add targeted product detail and offer detail DTOs.

Status: Completed on 2026-05-15.

## Phase 8: ERP Catalog Management

- Implement DB-backed ERP product CRUD.
- Implement DB-backed ERP category CRUD.
- Implement DB-backed ERP offer CRUD.
- Enforce activation rules server-side.
- Enforce category delete protection for descendant products and active children.
- Centralize slug generation.
- Add product flags management: `isNew`, `isBestseller`.
- Add offer visible/hidden management.

Status: Completed on 2026-05-15.

## Phase 9: Auth

- Implement DB-backed customer signup/login.
- Implement password hashing.
- Implement JWT access token + HTTP-only refresh cookie flow.
- Implement auth middleware for protected customer routes.
- Implement DB-backed admin auth.
- Keep hardcoded admin dev fallback only with clear warning.
- Protect all `/api/erp/*`.

Status: Completed on 2026-05-15.

## Phase 10: Wishlist

- Implement DB-backed wishlist repository/service/routes.
- Wishlist stores products only.
- Require customer auth for wishlist APIs.
- Update storefront wishlist provider/UI to use API.
- Guest wishlist click shows warning and login redirect.

Status: Completed on 2026-05-15.

## Phase 11: Checkout + Orders

- Wire checkout UI to `/api/v1/checkout`.
- Submit product variant lines and offer lines.
- API computes prices from DB.
- API validates stock at checkout.
- COD creates DB order with `pending` payment status.
- Deduct variant stock for products and offers.
- Store order item snapshots.
- Clear cart only after successful order creation.

Status: Completed on 2026-05-15.

## Phase 12: Uploads / Images

- Implement upload API boundary.
- Implement `image.service.ts` with Hostinger env placeholders.
- Accept PNG/JPG/WEBP up to 4MB.
- Return public URL/path usable by storefront.
- Product/offer image replacement updates reference only.
- Do not delete old physical image in v1.

Status: Completed on 2026-05-15.
- Implemented `POST /api/erp/uploads` with Zod schema validation, mime-type allowlist (`image/png`, `image/jpeg`, `image/webp`), and 4 MB size cap.
- Implemented `image.service.ts` (`saveImageBuffer`) writing files to a local `uploads/` directory with env-configurable `HOSTINGER_PUBLIC_BASE_URL` placeholder.
- Served the uploads directory as static files under `/uploads` via `express.static`.
- Wired ERP `image-upload.tsx` component to call `api.uploadImage()` (real multipart-to-base64 upload) instead of the previous data-URL mock.
- Added `api.uploadImage` helper in `apps/erp/src/lib/api/client.ts` with `arrayBufferToBase64` encoding and `x-admin-basic` dev header.
- Uploaded `UPLOAD_ALLOWED_MIME_TYPES` and `UPLOAD_MAX_BYTES` are env-configurable.
- Also completed as part of this phase commit:
  - Removed all PayMob backend files (`apps/api/src/modules/payments/paymob/*`, `apps/api/src/config/paymob.ts`).
  - Implemented `admin-auth` module (`apps/api/src/modules/admin/auth/`) with JWT-signed login for the dev-fallback admin.
  - Extracted dev-admin credential resolution into `apps/api/src/middlewares/admin-auth.config.ts`.
  - Fixed `adminAuthMiddleware` to perform real JWT verification and respect `ALLOW_DEV_ADMIN_FALLBACK` / `DEV_ADMIN_*` env vars.
  - Implemented `apps/api/src/config/env.ts` (`loadWorkspaceEnv`) to load root `.env` file at startup.
  - Wired `loadWorkspaceEnv()` into `apps/api/src/server.ts` before app import.
  - Wired `validateBody(parseCheckoutBody)` into `POST /api/v1/checkout` using the shared Zod checkout schema.
  - Aligned `CheckoutForm` shared type and `checkout-view.tsx` to use `cityArea` / `buildingApartment` field names and numeric `variantId`.
  - Added `lint` (typecheck) scripts to all package/app `package.json` files.
  - Added API tests: `load-workspace-env.test.ts`, `admin-auth.middleware.test.ts`, `admin-auth.service.test.ts`, `checkout.schemas.test.ts`, `uploads.test.ts`.

## Phase 13: Frontend Integration Polish

- Storefront API client sends `x-lang`.
- Product/category/offer pages consume updated DTOs.
- Product detail uses targeted endpoint instead of over-fetching.
- Offer detail uses resolved items endpoint instead of fetching all products.
- Cart and checkout handle out-of-stock states correctly.
- ERP UI consumes DB-backed APIs.

Status: Not started. Reverted to Phase 11 baseline on 2026-05-15 to keep phase commits clean.
- All storefront page changes (`products`, `category`, `offers`), `cart-view.tsx`, `wishlist-view.tsx`, `layout.tsx`, and `apps/storefront/src/lib/api/client.ts` were restored to the Phase 11 committed state.
- Phase 13 will be implemented as its own dedicated commit once Phase 14 tests are complete.

## Phase 14: Tests + Verification

- Add API tests for auth.
- Add API tests for category delete protection.
- Add API tests for product activation validation.
- Add API tests for wishlist persistence.
- Add API tests for checkout stock deduction.
- Add API tests for offer stock deduction.
- Run typecheck/build/lint as available.
- Update `docs/bugs.md` after fixes.

Status: Pending — not started as a standalone phase. Work tracked here was folded into the Phase 12 commit on 2026-05-15.

Items moved to Phase 12 commit (already done):
- API regression tests for workspace `.env` loading (`load-workspace-env.test.ts`).
- Package-level typecheck `lint` scripts added to all apps/packages.
- Checkout contract validation tests; Zod schema wired to `POST /api/v1/checkout`.
- Admin dev-fallback auth config tests; middleware fixed for `DEV_ADMIN_*` / `ALLOW_DEV_ADMIN_FALLBACK`.
- Upload API tests (`uploads.test.ts`).

Items still remaining:
- Add API tests for customer auth (signup / login / refresh token).
- Add API tests for category delete protection (has-products, has-active-children).
- Add API tests for product activation validation (server-side enforcement).
- Add API tests for wishlist persistence (add / list / remove, auth required).
- Add API tests for checkout stock deduction (variant deduction, offer deduction).
- Add API tests for offer stock deduction.
- Run full `pnpm lint`, `pnpm test`, `pnpm build` after Phase 13 is implemented.
- Update `docs/bugs/bugs.md` after all remaining fixes.
