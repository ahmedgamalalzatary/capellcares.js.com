# Minikoshk Monorepo Folder Structure

## Purpose

This file defines the canonical folder and boundary expectations for the Minikoshk project.

Treat this as the implementation baseline unless a new explicit product decision replaces it. The tree is intentionally pragmatic: required boundaries are strict, but helper folders/files are created when the implementation needs them.

This tree was last reconciled against the actual codebase on 2026-06-09. Since the prior reconcile it captures: the **collections** feature (storefront pages, ERP CRUD, API catalog + admin modules, shared DTO/schema, DB migration), the ERP **staff-management / roles-and-permissions** feature (API `erp-permissions` middleware/service plus `admin/staff-management` module), the storefront and ERP move to top-level `hooks/`, `types/`, `constants/`, and `utils/` folders (replacing per-page co-location), new API `config/` entries (`cors.ts`, `secrets.ts`), the `inventory` module, and the `admin/shared` helpers. It reflects tracked source files; build artifacts (`node_modules`, `dist`, `.next`, `.turbo`), editor/history folders (`.history`, `.sixth`), and local-only secrets (`.env`, `.env.docker`, `.env.test`) are intentionally omitted. Empty placeholder directories exist on disk but are not listed because they hold no files.

## Locked Project Decisions

- One monorepo.
- `apps/storefront` is the customer-facing Next.js app.
- `apps/erp` is the Arabic-only admin ERP Next.js app.
- `apps/api` is the Express.js backend API for storefront and ERP.
- MySQL is the shared production database.
- Drizzle ORM owns schema, migrations, seed logic, and DB access.
- Storefront and ERP consume the backend through HTTP APIs only.
- Public storefront routes and ERP/admin routes stay separated.
- Orders are persisted in DB. ERP has order-viewing UI (list + detail) but no order mutation in v1.
- Collections are a first-class catalog grouping: storefront browse pages, ERP CRUD, and API catalog + admin modules.
- ERP supports staff management with role-based permissions, enforced in the API via `erp-permissions` middleware/service.
- Storefront static UI translation stays centralized in `packages/shared/src/i18n` for now.
- Frontend API access may stay centralized in `client.ts`; split API files are optional, not mandatory.
- Shared UI primitives and the shared HTTP `base` client live in `packages/shared/src/ui` and `packages/shared/src/api`.

## Architecture Rules

- `apps/storefront` must not contain ERP pages.
- `apps/erp` must not contain storefront customer pages.
- `apps/api` owns backend behavior for both apps.
- `packages/shared` holds shared DTOs, validation schemas, constants, i18n dictionaries, shared UI primitives, the shared HTTP base client, and business-safe types.
- `packages/database` holds Drizzle schema, relations, migrations, seeds, and DB client.
- Storefront reads data through the API only.
- ERP writes and manages data through the API only.
- Orders are stored through checkout/internal service calls, not public order routes, in v1.

## Canonical Tree

```text
minikoshk/
├─ apps/
│  ├─ storefront/
│  │  ├─ public/
│  │  │  ├─ minikoshk logo.png
│  │  │  ├─ minikoshk logo1.png
│  │  │  ├─ minikoshk logo2.png
│  │  │  └─ minikoshk logo3.png
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ [lang]/
│  │  │  │  │  ├─ cart/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ category/
│  │  │  │  │  │  └─ [slug]/page.tsx
│  │  │  │  │  ├─ checkout/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ collections/
│  │  │  │  │  │  ├─ [slug]/page.tsx
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ login/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ offers/
│  │  │  │  │  │  ├─ [slug]/page.tsx
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ orders/
│  │  │  │  │  │  ├─ [id]/page.tsx
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ products/
│  │  │  │  │  │  ├─ [slug]/page.tsx
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ shop/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ signup/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ wishlist/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ layout.tsx
│  │  │  │  │  ├─ not-found.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ layout.tsx
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ globals.css
│  │  │  │  ├─ robots.ts
│  │  │  │  └─ sitemap.ts
│  │  │  ├─ components/
│  │  │  │  ├─ ask-minikoshk/
│  │  │  │  │  ├─ ask-minikoshk-button.tsx
│  │  │  │  │  ├─ ask-minikoshk-overlay.tsx
│  │  │  │  │  └─ ask-minikoshk-results.tsx
│  │  │  │  ├─ auth/
│  │  │  │  │  └─ auth-forms.tsx
│  │  │  │  ├─ cart/
│  │  │  │  │  └─ cart-view.tsx
│  │  │  │  ├─ checkout/
│  │  │  │  │  ├─ checkout-form.tsx
│  │  │  │  │  ├─ checkout-summary.tsx
│  │  │  │  │  └─ checkout-view.tsx
│  │  │  │  ├─ collections/
│  │  │  │  │  └─ collection-detail.tsx
│  │  │  │  ├─ layout/
│  │  │  │  │  ├─ header/
│  │  │  │  │  │  ├─ announcement-bar.tsx
│  │  │  │  │  │  ├─ mobile-drawer.tsx
│  │  │  │  │  │  ├─ search-overlay.tsx
│  │  │  │  │  │  └─ shop-mega-menu.tsx
│  │  │  │  │  ├─ breadcrumb.tsx
│  │  │  │  │  ├─ footer.tsx
│  │  │  │  │  ├─ header.tsx
│  │  │  │  │  └─ storefront-page-shell.tsx
│  │  │  │  ├─ offers/
│  │  │  │  │  └─ offer-detail.tsx
│  │  │  │  ├─ orders/
│  │  │  │  │  ├─ order-detail-view.tsx
│  │  │  │  │  └─ orders-view.tsx
│  │  │  │  ├─ products/
│  │  │  │  │  ├─ filters/
│  │  │  │  │  │  ├─ filter-section.tsx
│  │  │  │  │  │  ├─ mobile-filter-drawer.tsx
│  │  │  │  │  │  ├─ product-filter-category-list.tsx
│  │  │  │  │  │  └─ product-filters-content.tsx
│  │  │  │  │  ├─ grid/
│  │  │  │  │  │  ├─ product-grid-empty-state.tsx
│  │  │  │  │  │  ├─ product-grid-toolbar.tsx
│  │  │  │  │  │  └─ product-grid.tsx
│  │  │  │  │  ├─ advice-section.tsx
│  │  │  │  │  ├─ category-pill.tsx
│  │  │  │  │  ├─ price-input.tsx
│  │  │  │  │  ├─ product-card.tsx
│  │  │  │  │  ├─ product-detail.tsx
│  │  │  │  │  └─ related-items.tsx
│  │  │  │  ├─ providers/
│  │  │  │  │  ├─ auth-provider.tsx
│  │  │  │  │  ├─ cart-provider.tsx
│  │  │  │  │  └─ wishlist-provider.tsx
│  │  │  │  ├─ ui/
│  │  │  │  │  ├─ collection-illustration.tsx
│  │  │  │  │  ├─ icons.tsx
│  │  │  │  │  ├─ offer-illustration.tsx
│  │  │  │  │  └─ product-illustration.tsx
│  │  │  │  └─ wishlist/
│  │  │  │     └─ wishlist-view.tsx
│  │  │  ├─ constants/
│  │  │  │  └─ socials.ts
│  │  │  ├─ hooks/
│  │  │  │  ├─ use-ask-minikoshk.ts
│  │  │  │  ├─ use-checkout.ts
│  │  │  │  ├─ use-product-grid-filters.ts
│  │  │  │  └─ use-search.ts
│  │  │  ├─ lib/
│  │  │  │  ├─ api/
│  │  │  │  │  ├─ client/
│  │  │  │  │  │  ├─ http.ts
│  │  │  │  │  │  ├─ normalizers.ts
│  │  │  │  │  │  ├─ selectors.ts
│  │  │  │  │  │  └─ types.ts
│  │  │  │  │  ├─ client.ts
│  │  │  │  │  ├─ revalidate-secret.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ auth-provider.api.ts
│  │  │  │  ├─ auth-provider.storage.ts
│  │  │  │  ├─ cart.ts
│  │  │  │  ├─ header-menu.ts
│  │  │  │  ├─ nav.ts
│  │  │  │  ├─ seo.ts
│  │  │  │  ├─ storefront-detail-page.tsx
│  │  │  │  ├─ storefront-page-context.ts
│  │  │  │  ├─ storefront-static-data.ts
│  │  │  │  └─ utils.ts
│  │  │  ├─ types/
│  │  │  │  ├─ ask-minikoshk.types.ts
│  │  │  │  ├─ auth-provider.types.ts
│  │  │  │  ├─ checkout-view.types.ts
│  │  │  │  ├─ header.types.ts
│  │  │  │  └─ product-grid.types.ts
│  │  │  └─ utils/
│  │  │     └─ product-grid.utils.ts
│  │  ├─ tests/
│  │  │  ├─ components/
│  │  │  │  ├─ advice-section.test.tsx
│  │  │  │  ├─ auth-provider.test.tsx
│  │  │  │  ├─ header-mobile-drawer.test.tsx
│  │  │  │  ├─ mobile-filter-drawer.test.tsx
│  │  │  │  ├─ offer-detail.test.tsx
│  │  │  │  ├─ order-page.test.tsx
│  │  │  │  ├─ orders-view.test.tsx
│  │  │  │  ├─ product-card.test.tsx
│  │  │  │  ├─ product-detail.test.tsx
│  │  │  │  ├─ product-filter-category-list.test.tsx
│  │  │  │  ├─ product-grid-empty-state.test.tsx
│  │  │  │  ├─ product-grid-toolbar.test.tsx
│  │  │  │  ├─ shop-mega-menu.test.tsx
│  │  │  │  └─ storefront-page-shell.test.tsx
│  │  │  ├─ contracts/
│  │  │  │  └─ storefront-client.contract.test.ts
│  │  │  ├─ unit/
│  │  │  │  ├─ api-base.test.ts
│  │  │  │  ├─ api-client.test.ts
│  │  │  │  ├─ ask-minikoshk-search.test.ts
│  │  │  │  ├─ cart.test.ts
│  │  │  │  ├─ category-page.test.tsx
│  │  │  │  ├─ collection-pages.test.tsx
│  │  │  │  ├─ header-menu.test.ts
│  │  │  │  ├─ nav.test.ts
│  │  │  │  ├─ next-config.test.ts
│  │  │  │  ├─ revalidate-route.test.ts
│  │  │  │  ├─ revalidate-secret.test.ts
│  │  │  │  ├─ seo.test.ts
│  │  │  │  ├─ shared-ui.test.tsx
│  │  │  │  ├─ shop-page.test.tsx
│  │  │  │  ├─ storefront-detail-page.test.tsx
│  │  │  │  ├─ storefront-page-context.test.ts
│  │  │  │  ├─ storefront-static-data.test.ts
│  │  │  │  └─ use-product-grid-filters.test.tsx
│  │  │  └─ setup.ts
│  │  ├─ middleware.ts
│  │  ├─ next-env.d.ts
│  │  ├─ next.config.ts
│  │  ├─ tailwind.config.ts
│  │  ├─ postcss.config.cjs
│  │  ├─ postcss.config.mjs
│  │  ├─ vitest.config.ts
│  │  ├─ components.json
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  ├─ erp/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ advices/
│  │  │  │  │  ├─ [id]/edit/page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ categories/
│  │  │  │  │  ├─ [id]/edit/page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ collections/
│  │  │  │  │  ├─ [id]/edit/page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ dashboard/page.tsx
│  │  │  │  ├─ login/page.tsx
│  │  │  │  ├─ offers/
│  │  │  │  │  ├─ [id]/edit/page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ orders/
│  │  │  │  │  ├─ [id]/page.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ products/
│  │  │  │  │  ├─ [id]/edit/page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ sales/page.tsx
│  │  │  │  ├─ staff/
│  │  │  │  │  ├─ [id]/edit/page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ trash/page.tsx
│  │  │  │  ├─ layout.tsx
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ globals.css
│  │  │  ├─ components/
│  │  │  │  ├─ admin/
│  │  │  │  │  ├─ admin-confirm-modal.tsx
│  │  │  │  │  ├─ admin-list-toolbar.tsx
│  │  │  │  │  ├─ admin-status-badge.tsx
│  │  │  │  │  ├─ erp-forbidden-state.tsx
│  │  │  │  │  └─ staff-editor-form.tsx
│  │  │  │  ├─ forms/
│  │  │  │  │  ├─ advice-form.tsx
│  │  │  │  │  ├─ category-form.tsx
│  │  │  │  │  ├─ category-picker.tsx
│  │  │  │  │  ├─ collection-form.tsx
│  │  │  │  │  ├─ editor-form-parts.tsx
│  │  │  │  │  ├─ form-slug.ts
│  │  │  │  │  ├─ image-upload.tsx
│  │  │  │  │  ├─ offer-form.tsx
│  │  │  │  │  ├─ product-form.tsx
│  │  │  │  │  ├─ product-hover-image-upload.tsx
│  │  │  │  │  ├─ product-media-upload.tsx
│  │  │  │  │  ├─ related-items-field.tsx
│  │  │  │  │  └─ related-options.ts
│  │  │  │  ├─ orders/
│  │  │  │  │  └─ order-details-view.tsx
│  │  │  │  ├─ providers/
│  │  │  │  │  ├─ admin-auth.tsx
│  │  │  │  │  └─ erp-toaster.tsx
│  │  │  │  ├─ shell/
│  │  │  │  │  └─ admin-shell.tsx
│  │  │  │  ├─ trash/
│  │  │  │  │  └─ deleted-list.tsx
│  │  │  │  ├─ ui/
│  │  │  │  │  ├─ icons.tsx
│  │  │  │  │  └─ modal.tsx
│  │  │  │  └─ products-table.tsx
│  │  │  ├─ hooks/
│  │  │  │  ├─ forms/
│  │  │  │  │  ├─ use-collection-form.ts
│  │  │  │  │  ├─ use-offer-form.ts
│  │  │  │  │  └─ use-product-form.ts
│  │  │  │  ├─ use-products-page.ts
│  │  │  │  └─ use-trash-page.ts
│  │  │  ├─ lib/
│  │  │  │  ├─ api/
│  │  │  │  │  └─ client.ts
│  │  │  │  ├─ store/
│  │  │  │  │  ├─ core.ts
│  │  │  │  │  ├─ normalizers.ts
│  │  │  │  │  └─ types.ts
│  │  │  │  ├─ erp-permissions.ts
│  │  │  │  ├─ errors.ts
│  │  │  │  ├─ store.ts
│  │  │  │  └─ utils.ts
│  │  │  └─ types/
│  │  │     ├─ forms/
│  │  │     │  ├─ collection-form.types.ts
│  │  │     │  ├─ offer-form.types.ts
│  │  │     │  └─ product-form.types.ts
│  │  │     └─ trash-page.types.ts
│  │  ├─ tests/
│  │  │  ├─ admin-list-toolbar.test.tsx
│  │  │  ├─ admin-shell.test.tsx
│  │  │  ├─ advices-page.test.tsx
│  │  │  ├─ api-base.test.ts
│  │  │  ├─ api-client-auth.test.ts
│  │  │  ├─ category-form-toast.test.tsx
│  │  │  ├─ category-form.test.tsx
│  │  │  ├─ collection-edit-page.test.tsx
│  │  │  ├─ collections-page.test.tsx
│  │  │  ├─ editor-form-parts.test.tsx
│  │  │  ├─ error-messages.test.ts
│  │  │  ├─ form-slug.test.ts
│  │  │  ├─ offer-form-related.test.tsx
│  │  │  ├─ offers-page.test.tsx
│  │  │  ├─ order-detail-page.test.tsx
│  │  │  ├─ orders-page.test.tsx
│  │  │  ├─ product-edit-page.test.tsx
│  │  │  ├─ products-page.test.tsx
│  │  │  ├─ sales-page.test.tsx
│  │  │  ├─ shared-ui.test.tsx
│  │  │  ├─ staff-edit-page.test.tsx
│  │  │  ├─ staff-management-page.test.tsx
│  │  │  ├─ staff-new-page.test.tsx
│  │  │  ├─ store.test.ts
│  │  │  ├─ trash-page.test.tsx
│  │  │  ├─ upload-permissions.test.tsx
│  │  │  └─ setup.ts
│  │  ├─ next-env.d.ts
│  │  ├─ next.config.ts
│  │  ├─ tailwind.config.ts
│  │  ├─ postcss.config.cjs
│  │  ├─ postcss.config.mjs
│  │  ├─ vitest.config.ts
│  │  ├─ components.json
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  └─ api/
│     ├─ src/
│     │  ├─ server.ts
│     │  ├─ app.ts
│     │  ├─ config/
│     │  │  ├─ cors.ts
│     │  │  ├─ env.ts
│     │  │  └─ secrets.ts
│     │  ├─ middlewares/
│     │  │  ├─ admin-auth.middleware.ts
│     │  │  ├─ auth.middleware.ts
│     │  │  ├─ erp-permissions.middleware.ts
│     │  │  ├─ error.middleware.ts
│     │  │  ├─ locale.middleware.ts
│     │  │  ├─ rate-limit.middleware.ts
│     │  │  └─ validate.middleware.ts
│     │  ├─ modules/
│     │  │  ├─ admin/
│     │  │  │  ├─ admin.controller.ts
│     │  │  │  ├─ admin.routes.ts
│     │  │  │  ├─ storefront-revalidation.ts
│     │  │  │  ├─ advices/
│     │  │  │  │  ├─ admin-advices.controller.ts
│     │  │  │  │  ├─ admin-advices.routes.ts
│     │  │  │  │  └─ storefront-advices.routes.ts
│     │  │  │  ├─ auth/
│     │  │  │  │  ├─ admin-auth.controller.ts
│     │  │  │  │  ├─ admin-auth.routes.ts
│     │  │  │  │  ├─ admin-auth.schemas.ts
│     │  │  │  │  └─ admin-auth.service.ts
│     │  │  │  ├─ categories/
│     │  │  │  │  └─ admin-categories.controller.ts
│     │  │  │  ├─ collections/
│     │  │  │  │  ├─ admin-collections.controller.ts
│     │  │  │  │  └─ admin-collections.mapper.ts
│     │  │  │  ├─ offers/
│     │  │  │  │  ├─ admin-offers.controller.ts
│     │  │  │  │  └─ admin-offers.mapper.ts
│     │  │  │  ├─ products/
│     │  │  │  │  ├─ lib/
│     │  │  │  │  │  └─ admin-product-input.ts
│     │  │  │  │  ├─ admin-products.controller.ts
│     │  │  │  │  └─ admin-products.service.ts
│     │  │  │  ├─ shared/
│     │  │  │  │  ├─ db-errors.ts
│     │  │  │  │  └─ related-items.ts
│     │  │  │  └─ staff-management/
│     │  │  │     ├─ admin-staff-management.controller.ts
│     │  │  │     └─ admin-staff-management.routes.ts
│     │  │  ├─ auth/
│     │  │  │  ├─ auth.controller.ts
│     │  │  │  ├─ auth.routes.ts
│     │  │  │  ├─ auth.service.ts
│     │  │  │  └─ cookie-options.ts
│     │  │  ├─ catalog/
│     │  │  │  ├─ catalog.controller.ts
│     │  │  │  ├─ collections/
│     │  │  │  │  ├─ collections.controller.ts
│     │  │  │  │  ├─ collections.mapper.ts
│     │  │  │  │  ├─ collections.routes.ts
│     │  │  │  │  └─ collections.service.ts
│     │  │  │  ├─ offers/
│     │  │  │  │  └─ offers.mapper.ts
│     │  │  │  └─ products/
│     │  │  │     ├─ products.controller.ts
│     │  │  │     ├─ products.mapper.ts
│     │  │  │     ├─ products.routes.ts
│     │  │  │     └─ products.service.ts
│     │  │  ├─ checkout/
│     │  │  │  ├─ checkout.controller.ts
│     │  │  │  ├─ checkout.routes.ts
│     │  │  │  ├─ checkout.schemas.ts
│     │  │  │  └─ checkout.service.ts
│     │  │  ├─ collections/
│     │  │  │  └─ collection-mapper.shared.ts
│     │  │  ├─ inventory/
│     │  │  │  └─ bundle-inventory.ts
│     │  │  ├─ offers/
│     │  │  │  └─ offer-mapper.shared.ts
│     │  │  ├─ orders/
│     │  │  │  ├─ admin-orders.routes.ts
│     │  │  │  ├─ orders.controller.ts
│     │  │  │  ├─ orders.routes.ts
│     │  │  │  └─ orders.service.ts
│     │  │  ├─ uploads/
│     │  │  │  ├─ uploads.controller.ts
│     │  │  │  ├─ uploads.permissions.ts
│     │  │  │  ├─ uploads.routes.ts
│     │  │  │  ├─ uploads.schemas.ts
│     │  │  │  └─ uploads.service.ts
│     │  │  └─ wishlist/
│     │  │     ├─ wishlist.controller.ts
│     │  │     ├─ wishlist.routes.ts
│     │  │     └─ wishlist.service.ts
│     │  ├─ repositories/
│     │  │  ├─ order/
│     │  │  │  ├─ read.ts
│     │  │  │  ├─ shared.ts
│     │  │  │  └─ write.ts
│     │  │  ├─ product/
│     │  │  │  ├─ read.ts
│     │  │  │  ├─ shared.ts
│     │  │  │  └─ write.ts
│     │  │  ├─ related-item/
│     │  │  │  ├─ read.ts
│     │  │  │  ├─ shared.ts
│     │  │  │  └─ write.ts
│     │  │  ├─ admin-user.repository.ts
│     │  │  ├─ advice.repository.ts
│     │  │  ├─ auth-session.repository.ts
│     │  │  ├─ category.repository.ts
│     │  │  ├─ collection.repository.ts
│     │  │  ├─ customer.repository.ts
│     │  │  ├─ offer.repository.ts
│     │  │  ├─ order.repository.ts
│     │  │  ├─ product.repository.ts
│     │  │  ├─ related-item.repository.ts
│     │  │  └─ wishlist.repository.ts
│     │  ├─ services/
│     │  │  ├─ auth-session.service.ts
│     │  │  ├─ erp-permissions.service.ts
│     │  │  └─ slug.service.ts
│     │  ├─ routes/
│     │  │  ├─ erp.routes.ts
│     │  │  ├─ index.ts
│     │  │  └─ storefront.routes.ts
│     │  └─ types/
│     │     └─ domain.ts
│     ├─ tests/
│     │  ├─ contracts/
│     │  │  └─ storefront-contracts.test.ts
│     │  ├─ helpers/
│     │  │  ├─ admin-auth.ts
│     │  │  ├─ database.ts
│     │  │  └─ request.ts
│     │  ├─ repositories/
│     │  │  ├─ admin-products.repository.test.ts
│     │  │  ├─ offer.repository.test.ts
│     │  │  ├─ order.repository.test.ts
│     │  │  ├─ product-search.repository.test.ts
│     │  │  └─ related-item.repository.test.ts
│     │  ├─ routes/
│     │  │  ├─ admin-auth.routes.test.ts
│     │  │  ├─ admin-categories.routes.test.ts
│     │  │  ├─ admin-collections.routes.test.ts
│     │  │  ├─ admin-offers.routes.test.ts
│     │  │  ├─ admin-products.routes.test.ts
│     │  │  ├─ admin-staff-management.routes.test.ts
│     │  │  ├─ advices.routes.test.ts
│     │  │  ├─ auth.routes.test.ts
│     │  │  ├─ checkout.routes.test.ts
│     │  │  ├─ erp-permissions.routes.test.ts
│     │  │  ├─ orders.routes.test.ts
│     │  │  ├─ route-truth.routes.test.ts
│     │  │  ├─ sales.routes.test.ts
│     │  │  ├─ wishlist.routes.test.ts
│     │  │  └─ x-lang.routes.test.ts
│     │  ├─ services/
│     │  │  ├─ admin-auth.service.test.ts
│     │  │  ├─ admin-products.service.test.ts
│     │  │  ├─ auth-session.service.test.ts
│     │  │  ├─ checkout.service.test.ts
│     │  │  ├─ erp-permissions.service.test.ts
│     │  │  └─ uploads.test.ts
│     │  └─ unit/
│     │     ├─ admin-auth.middleware.test.ts
│     │     ├─ admin-product-input.test.ts
│     │     ├─ auth.middleware.test.ts
│     │     ├─ bundle-inventory.test.ts
│     │     ├─ checkout.schemas.test.ts
│     │     ├─ cors-origins.test.ts
│     │     ├─ load-workspace-env.test.ts
│     │     ├─ offer-mapper.test.ts
│     │     ├─ rate-limit.test.ts
│     │     ├─ related-items.test.ts
│     │     ├─ secrets.test.ts
│     │     ├─ storefront-revalidation.test.ts
│     │     └─ uploads-permissions.test.ts
│     ├─ scripts/
│     │  └─ run-tests.mjs
│     ├─ esbuild.config.mjs
│     ├─ tsconfig.json
│     └─ package.json
│
├─ packages/
│  ├─ shared/
│  │  ├─ src/
│  │  │  ├─ api/
│  │  │  │  └─ base.ts
│  │  │  ├─ config/
│  │  │  │  └─ workspace-env.ts
│  │  │  ├─ constants/
│  │  │  │  ├─ currency.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ languages.ts
│  │  │  │  ├─ payment-methods.ts
│  │  │  │  └─ product-status.ts
│  │  │  ├─ dto/
│  │  │  │  ├─ advice.dto.ts
│  │  │  │  ├─ auth.dto.ts
│  │  │  │  ├─ category.dto.ts
│  │  │  │  ├─ checkout.dto.ts
│  │  │  │  ├─ collection.dto.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ offer.dto.ts
│  │  │  │  ├─ order.dto.ts
│  │  │  │  ├─ product.dto.ts
│  │  │  │  └─ wishlist.dto.ts
│  │  │  ├─ i18n/
│  │  │  │  ├─ ar.ts
│  │  │  │  ├─ en.ts
│  │  │  │  └─ index.ts
│  │  │  ├─ schemas/
│  │  │  │  ├─ advice.schema.ts
│  │  │  │  ├─ auth.schema.ts
│  │  │  │  ├─ category.schema.ts
│  │  │  │  ├─ checkout.schema.ts
│  │  │  │  ├─ collection.schema.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ offer.schema.ts
│  │  │  │  ├─ product.schema.ts
│  │  │  │  └─ wishlist.schema.ts
│  │  │  ├─ types/
│  │  │  │  ├─ assert-type-equal.ts
│  │  │  │  └─ index.ts
│  │  │  ├─ ui/
│  │  │  │  ├─ badge.tsx
│  │  │  │  ├─ button.tsx
│  │  │  │  ├─ card.tsx
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ input.tsx
│  │  │  │  ├─ label.tsx
│  │  │  │  ├─ select.tsx
│  │  │  │  ├─ separator.tsx
│  │  │  │  ├─ table.tsx
│  │  │  │  ├─ textarea.tsx
│  │  │  │  └─ utils.ts
│  │  │  └─ index.ts
│  │  ├─ tests/
│  │  │  └─ contracts/
│  │  │     ├─ advice.contract.ts
│  │  │     ├─ category.contract.ts
│  │  │     ├─ collection.contract.ts
│  │  │     ├─ helpers.ts
│  │  │     ├─ index.ts
│  │  │     ├─ offer.contract.ts
│  │  │     ├─ product.contract.ts
│  │  │     └─ related-item.contract.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  └─ database/
│     ├─ drizzle/
│     │  ├─ migrations/
│     │  │  ├─ meta/
│     │  │  │  ├─ 0000_snapshot.json
│     │  │  │  ├─ 0006_snapshot.json
│     │  │  │  ├─ 0008_snapshot.json
│     │  │  │  └─ _journal.json
│     │  │  ├─ 0000_glamorous_proudstar.sql
│     │  │  ├─ 0001_handy_advices.sql
│     │  │  ├─ 0002_auth_sessions.sql
│     │  │  ├─ 0003_product_media.sql
│     │  │  ├─ 0004_product_hover_image.sql
│     │  │  ├─ 0005_related_items.sql
│     │  │  ├─ 0006_db_integrity.sql
│     │  │  ├─ 0007_collections.sql
│     │  │  ├─ 0008_lumpy_rhino.sql
│     │  │  └─ 0009_abundant_gargoyle.sql
│     │  └─ schema.ts
│     ├─ drizzle.config.ts
│     ├─ src/
│     │  ├─ client.ts
│     │  ├─ db.ts
│     │  ├─ env.ts
│     │  └─ seeds/
│     │     ├─ categories.seed.ts
│     │     ├─ index.ts
│     │     └─ test.seed.ts
│     ├─ tests/
│     │  ├─ env.test.ts
│     │  └─ integrity.test.ts
│     ├─ scripts/
│     │  ├─ run-test-migrations.mjs
│     │  └─ run-tests.mjs
│     ├─ tsconfig.json
│     └─ package.json
│
├─ docs/
│  ├─ specs/
│  │  ├─ folder-structure.md
│  │  └─ storefront-erp-spec.md
│  ├─ plans/
│  │  ├─ features/
│  │  │  └─ promo-code-plan.md
│  │  ├─ fixes/
│  │  │  └─ state-management-and-server-state-plan.md
│  │  └─ testing/
│  │     ├─ 00-README.md
│  │     ├─ 01-foundation.md
│  │     ├─ 02-api.md
│  │     ├─ 03-storefront-vitest.md
│  │     ├─ 04-erp-vitest.md
│  │     ├─ 05-playwright-smoke.md
│  │     ├─ 05a-playwright-local.md
│  │     ├─ 06-ci-and-regression.md
│  │     └─ playwright-vitest-implementation.md
│  └─ docker.md
├─ .dockerignore
├─ .env.example
├─ .gitignore
├─ AGENTS.md
├─ Dockerfile.api
├─ Dockerfile.erp
├─ Dockerfile.storefront
├─ docker-compose.yml
├─ eslint.config.mjs
├─ playwright.config.ts
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ pnpm-lock.yaml
```

## Optional Folders / Files

The following may be added when they create real value, but are not required just to satisfy structure:

- Split frontend API files such as `products.ts`, `categories.ts`, `auth.ts`, `wishlist.ts`, `checkout.ts`.
- Both frontend apps now use top-level `hooks/`, `types/` (and storefront `constants/`/`utils/`) folders instead of co-locating those internals next to each page/component.
- ERP `middleware.ts`, if frontend route protection is implemented at the Next.js middleware layer.
- Shared `enums/`, if constants/types are not sufficient.

## Required Boundaries

### Frontend App Boundaries

- `apps/storefront` must not contain ERP pages.
- `apps/erp` must not contain storefront customer pages.
- Both frontend apps consume the backend through HTTP APIs.

### API Route Boundaries

- `routes/storefront.routes.ts` mounts public/storefront-facing endpoints under `/api/v1`.
- `routes/erp.routes.ts` mounts ERP/admin endpoints under `/api/erp`.
- `routes/index.ts` only composes those two route groups plus health checks.
- ERP routes must be protected by `admin-auth.middleware.ts`.
- ERP routes that mutate or read privileged resources are further gated by `erp-permissions.middleware.ts` (backed by `services/erp-permissions.service.ts`), enforcing per-role staff permissions.
- Storefront routes use customer auth only where required, such as wishlist.

### Orders Boundary

- `modules/orders/` handles order persistence and queries.
- ERP has order-viewing UI (list + detail pages) in v1; no order mutation (cancel/modify) exposed.
- `checkout.service.ts` persists orders by calling `orders.service.ts`.
- Orders support product variant lines and offer lines.

### Locale Boundary

- Storefront locale is controlled by `[lang]` routes.
- Storefront API client sends the active locale as `x-lang` on localized requests.
- API locale middleware/service normalizes locale and can use it for response shaping.

### Catalog Collections Boundary

- `modules/catalog/collections/` owns public collection browsing endpoints; `modules/admin/collections/` owns ERP collection CRUD.
- `modules/collections/collection-mapper.shared.ts` holds shared collection mapping used by both sides.
- `repositories/collection.repository.ts` owns collection persistence.

### Upload Boundary

- `modules/uploads/` owns upload HTTP endpoints; `uploads.service.ts` owns the Hostinger file-storage integration details and `uploads.permissions.ts` gates who may upload.
- Product and offer image replacement must go through this boundary.

### Revalidation Boundary

- ERP catalog mutations trigger storefront ISR revalidation via `apps/api/src/modules/admin/storefront-revalidation.ts`, which calls the storefront `app/api/revalidate/route.ts` endpoint.

## Notes For Future Implementers

- Do not collapse `storefront`, `erp`, and `api` into fewer apps without an explicit decision.
- Do not merge public catalog and ERP admin modules.
- Do not expose ERP order-mutation (cancel/modify) UI in v1.
- Do not move storefront or ERP to direct DB access.
- Do not reintroduce `cat.txt`; the initial category tree is documented in `docs/specs/storefront-erp-spec.md`.
- Shared UI primitives now live in `packages/shared/src/ui`; per-app `components/ui` folders only hold app-specific primitives (storefront: icons/illustrations; ERP: icons/modal).
- Do not expose ERP staff-management or role/permission editing without going through `erp-permissions` enforcement on the API side.
