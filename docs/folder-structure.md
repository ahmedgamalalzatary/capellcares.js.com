# Capella Monorepo Folder Structure

## Purpose

This file defines the canonical folder and boundary expectations for the Capella project.

Treat this as the implementation baseline unless a new explicit product decision replaces it. The tree is intentionally pragmatic: required boundaries are strict, but helper folders/files are created when the implementation needs them.

This tree was last reconciled against the actual codebase on 2026-09-20. It includes the storefront, ERP, API, and mobile workspaces, the current Paymob checkout/payment layer, and database migrations through `0046`. It reflects tracked source files; build artifacts (`node_modules`, `dist`, `.next`, `.turbo`), editor/history folders (`.history`, `.sixth`), and local-only secrets (`.env`, `.env.docker`, `.env.test`) are intentionally omitted. Empty placeholder directories exist on disk but are not listed because they hold no files.

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
capella/
├─ apps/
│  ├─ storefront/
│  │  ├─ public/
│  │  │  ├─ capella logo.png
│  │  │  ├─ capella logo1.png
│  │  │  ├─ capella logo2.png
│  │  │  └─ capella logo3.png
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
│  │  │  │  ├─ ask-capella/
│  │  │  │  │  ├─ ask-capella-button.tsx
│  │  │  │  │  ├─ ask-capella-overlay.tsx
│  │  │  │  │  └─ ask-capella-results.tsx
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
│  │  │  │  ├─ use-ask-capella.ts
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
│  │  │  │  ├─ ask-capella.types.ts
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
│  │  │  │  ├─ ask-capella-search.test.ts
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
│  │  │  ├─ app/                              routes only (Next App Router); each imports its feature's parts
│  │  │  │  ├─ advices/
│  │  │  │  │  ├─ [id]/edit/page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ api/health/route.ts
│  │  │  │  ├─ categories/{[id]/edit,new}/page.tsx + page.tsx
│  │  │  │  ├─ collections/{[id]/edit,new}/page.tsx + page.tsx
│  │  │  │  ├─ dashboard/page.tsx
│  │  │  │  ├─ discounts/page.tsx
│  │  │  │  ├─ login/page.tsx
│  │  │  │  ├─ offers/{[id]/edit,new}/page.tsx + page.tsx
│  │  │  │  ├─ orders/[id]/page.tsx + orders/reconciliation/page.tsx + orders/page.tsx
│  │  │  │  ├─ products/{[id]/discount,[id]/edit,new}/page.tsx + page.tsx
│  │  │  │  ├─ reviews/page.tsx
│  │  │  │  ├─ sales/page.tsx
│  │  │  │  ├─ shipping/page.tsx
│  │  │  │  ├─ shop-media/page.tsx
│  │  │  │  ├─ staff/{[id]/edit,new}/page.tsx + page.tsx
│  │  │  │  ├─ trash/page.tsx
│  │  │  │  ├─ globals.css
│  │  │  │  ├─ layout.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ components/                       shared, feature-agnostic UI
│  │  │  │  ├─ admin/
│  │  │  │  │  ├─ admin-confirm-modal.tsx
│  │  │  │  │  ├─ admin-list-header.tsx
│  │  │  │  │  ├─ editor-layout.tsx
│  │  │  │  │  ├─ erp-forbidden-state.tsx
│  │  │  │  │  ├─ form-save-bar.tsx
│  │  │  │  │  ├─ list-table.tsx
│  │  │  │  │  ├─ permission-gate.tsx
│  │  │  │  │  ├─ reorder-buttons.tsx
│  │  │  │  │  ├─ shipping-actions.tsx
│  │  │  │  │  ├─ status-badge.tsx
│  │  │  │  │  └─ stepper.tsx
│  │  │  │  ├─ forms/
│  │  │  │  │  ├─ category-picker.tsx
│  │  │  │  │  ├─ editor-form-parts.tsx
│  │  │  │  │  ├─ entity-media-upload.tsx
│  │  │  │  │  ├─ hover-image-upload.tsx
│  │  │  │  │  ├─ image-actions.tsx
│  │  │  │  │  ├─ lang-tag.tsx
│  │  │  │  │  ├─ media-frame.tsx
│  │  │  │  │  ├─ related-items-field.tsx
│  │  │  │  │  ├─ single-image-field.tsx
│  │  │  │  │  └─ status-choice.tsx
│  │  │  │  ├─ providers/
│  │  │  │  │  ├─ admin-auth.tsx
│  │  │  │  │  └─ erp-toaster.tsx
│  │  │  │  ├─ shell/
│  │  │  │  │  ├─ admin-shell.tsx
│  │  │  │  │  └─ theme-menu.tsx
│  │  │  │  └─ ui/
│  │  │  │     ├─ alert.tsx
│  │  │  │     ├─ badge.tsx
│  │  │  │     ├─ button.tsx
│  │  │  │     ├─ card.tsx
│  │  │  │     ├─ empty-state.tsx
│  │  │  │     ├─ field.tsx
│  │  │  │     ├─ file-button.tsx
│  │  │  │     ├─ input.tsx
│  │  │  │     ├─ modal.tsx
│  │  │  │     ├─ row-menu.tsx
│  │  │  │     ├─ skeleton.tsx
│  │  │  │     ├─ switch.tsx
│  │  │  │     ├─ table.tsx
│  │  │  │     └─ thumb.tsx
│  │  │  ├─ features/                        one folder per feature; mirrors tests/features
│  │  │  │  ├─ advices/components/{advice-form,advices-table}.tsx
│  │  │  │  ├─ bundles/                      offers + collections shared code (§5.4)
│  │  │  │  │  ├─ components/{bundle-form,bundles-table}.tsx
│  │  │  │  │  ├─ hooks/{use-bundle-form,use-bundles-list}.ts
│  │  │  │  │  ├─ bundle-config.ts
│  │  │  │  │  └─ types.ts
│  │  │  │  ├─ categories/
│  │  │  │  │  ├─ components/{category-form,category-tree}.tsx
│  │  │  │  │  ├─ hooks/use-collapsed-categories.ts
│  │  │  │  │  └─ lib/category-order.ts
│  │  │  │  ├─ collections/
│  │  │  │  │  ├─ components/collection-form.tsx      wrapper → BundleForm + collectionConfig
│  │  │  │  │  ├─ hooks/use-collection-form.ts        wrapper → useBundleForm + collectionConfig
│  │  │  │  │  ├─ collection-config.ts
│  │  │  │  │  └─ types.ts
│  │  │  │  ├─ dashboard/
│  │  │  │  │  ├─ components/{attention-strip,catalog-health,ending-discounts,new-menu,sales-pulse,stock-alerts,top-sellers}.tsx
│  │  │  │  │  └─ lib/metrics.ts
│  │  │  │  ├─ discounts/{components/selection-group.tsx,lib/discount.ts}
│  │  │  │  ├─ offers/
│  │  │  │  │  ├─ components/offer-form.tsx           wrapper → BundleForm + offerConfig
│  │  │  │  │  ├─ hooks/use-offer-form.ts             wrapper → useBundleForm + offerConfig
│  │  │  │  │  ├─ offer-config.ts
│  │  │  │  │  └─ types.ts
│  │  │  │  ├─ orders/components/{order-details-view,order-review-flag-alerts,orders-table}.tsx
│  │  │  │  ├─ products/
│  │  │  │  │  ├─ components/{product-form,products-table}.tsx
│  │  │  │  │  ├─ hooks/{use-product-form,use-products-page}.ts
│  │  │  │  │  └─ types.ts
│  │  │  │  ├─ reviews/components/reviews-table.tsx
│  │  │  │  ├─ shipping/{components/shipments-table.tsx,lib/labels.ts}
│  │  │  │  ├─ shop-media/
│  │  │  │  │  ├─ components/fold-button.tsx
│  │  │  │  │  ├─ hooks/{use-collapsed-shop-media,use-collapsed-shop-media-items}.ts
│  │  │  │  │  ├─ lib/editable-section.ts
│  │  │  │  │  └─ types.ts
│  │  │  │  ├─ staff/{components/{staff-editor-form,staff-table}.tsx,lib/staff-form-state.ts,types.ts}
│  │  │  │  └─ trash/{components/deleted-list.tsx,hooks/use-trash-page.ts,types.ts}
│  │  │  ├─ hooks/                           shared, feature-agnostic
│  │  │  │  ├─ use-collapsed-set.ts
│  │  │  │  ├─ use-hover-image-fields.ts
│  │  │  │  ├─ use-image-upload.ts
│  │  │  │  ├─ use-list-reorder.ts
│  │  │  │  ├─ use-media-query.ts
│  │  │  │  ├─ use-table-sort.ts
│  │  │  │  └─ use-wizard-steps.ts
│  │  │  └─ lib/
│  │  │     ├─ api/client.ts
│  │  │     ├─ store/{core,index,normalizers,types}.ts
│  │  │     ├─ array.ts
│  │  │     ├─ category-tree.ts
│  │  │     ├─ erp-permissions.ts
│  │  │     ├─ errors.ts
│  │  │     ├─ format.ts
│  │  │     ├─ media.ts
│  │  │     ├─ order-review-flags.ts
│  │  │     ├─ payment-status.ts
│  │  │     ├─ related-options.ts
│  │  │     ├─ slug.ts
│  │  │     ├─ stock.ts
│  │  │     ├─ theme-script.ts
│  │  │     ├─ theme.ts
│  │  │     └─ utils.ts
│  │  ├─ tests/                              mirrors src/ 1:1 (same folders, <file>.test.ts(x))
│  │  │  ├─ app/api/health/route.test.ts
│  │  │  ├─ components/                      admin/, forms/, providers/, shell/ — mirroring src/components
│  │  │  ├─ features/                        one folder per feature, mirroring src/features
│  │  │  │  └─ bundles/{bundle-form-hover-image,bundle-form-item-reorder,bundles-reorder}.test.tsx
│  │  │  ├─ hooks/{use-image-upload,use-list-reorder,use-table-sort,use-wizard-steps}.test.tsx
│  │  │  ├─ lib/{array,category-tree,errors,format,media,slug,theme}.test.ts
│  │  │  ├─ lib/api/client.test.ts
│  │  │  ├─ lib/store/{core,normalizers}.test.ts
│  │  │  ├─ setup.ts
│  │  │  └─ shared-ui.test.tsx
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
│  │  # Import rules (ERP)
│  │  #  - features/A never imports from features/B. Only exception: offers/collections → bundles.
│  │  #  - The shared layer (components/ui|admin|forms, hooks, lib) never imports from features/**.
│  │  #  - The only shell→feature import is components/shell/admin-shell → features/orders/.../order-review-flag-alerts.
│  │  #  - Use @/… absolute imports everywhere; relative ./x only inside the same folder.
│  │  #  - Promotion rule: used by one feature → that feature; used by 2+ → the shared layer.
│  │
│  ├─ mobile/
│  │  ├─ __tests__/
│  │  │  ├─ api-base.test.js
│  │  │  ├─ api-client.test.js
│  │  │  ├─ api-data.test.js
│  │  │  ├─ api-http.test.js
│  │  │  ├─ app-scaffold.test.js
│  │  │  ├─ lang-provider.test.js
│  │  │  ├─ metro-config.test.js
│  │  │  └─ root-layout.test.js
│  │  ├─ app/
│  │  │  ├─ _layout.tsx
│  │  │  └─ index.tsx
│  │  ├─ assets/
│  │  │  ├─ adaptive-icon.png
│  │  │  ├─ icon.png
│  │  │  └─ splash-icon.png
│  │  ├─ src/
│  │  │  ├─ constants/storage.ts
│  │  │  ├─ lib/
│  │  │  │  ├─ api/
│  │  │  │  │  ├─ base.ts
│  │  │  │  │  ├─ client.ts
│  │  │  │  │  ├─ http.ts
│  │  │  │  │  ├─ normalizers.ts
│  │  │  │  │  ├─ selectors.ts
│  │  │  │  │  └─ types.ts
│  │  │  │  └─ lang.tsx
│  │  │  └─ theme.ts
│  │  ├─ tests/
│  │  │  ├─ expo-config.test.ts
│  │  │  ├─ metro-js-specifier.test.ts
│  │  │  ├─ shared-bundle.test.ts
│  │  │  ├─ storage-keys.test.ts
│  │  │  └─ theme.test.ts
│  │  ├─ .env.example
│  │  ├─ app.json
│  │  ├─ babel.config.js
│  │  ├─ eas.json
│  │  ├─ eslint.config.js
│  │  ├─ jest.config.js
│  │  ├─ metro.config.js
│  │  ├─ metro-js-specifier.js
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
│     │  │  │  │  └─ admin-products.controller.ts
│     │  │  │  ├─ shared/
│     │  │  │  │  ├─ activation.ts
│     │  │  │  │  ├─ db-errors.ts
│     │  │  │  │  └─ related-items.ts
│     │  │  │  └─ staff-management/
│     │  │  │     ├─ admin-staff-management.controller.ts
│     │  │  │     └─ admin-staff-management.routes.ts
│     │  │  ├─ auth/
│     │  │  │  ├─ auth.controller.ts
│     │  │  │  ├─ auth.routes.ts
│     │  │  │  ├─ auth.service.ts
│     │  │  │  ├─ cookie-options.ts
│     │  │  │  ├─ auth-session.repository.ts
│     │  │  │  └─ customer.repository.ts
│     │  │  ├─ catalog/
│     │  │  │  ├─ catalog.controller.ts
│     │  │  │  ├─ collections/
│     │  │  │  │  ├─ collections.controller.ts
│     │  │  │  │  ├─ collections.mapper.ts
│     │  │  │  │  ├─ collections.routes.ts
│     │  │  │  │  ├─ collections.service.ts
│     │  │  │  │  └─ collection.repository.ts
│     │  │  │  ├─ categories/
│     │  │  │  │  ├─ category-tree.ts
│     │  │  │  │  ├─ category.repository.ts
│     │  │  │  │  └─ categories.controller.ts
│     │  │  │  ├─ offers/
│     │  │  │  │  ├─ offers.mapper.ts
│     │  │  │  │  ├─ offer.repository.ts
│     │  │  │  │  ├─ bundle-discount.repository.ts
│     │  │  │  │  └─ bundle-discount-price.repository.ts
│     │  │  │  └─ products/
│     │  │  │     ├─ products.controller.ts
│     │  │  │     ├─ products.mapper.ts
│     │  │  │     ├─ products.routes.ts
│     │  │  │     ├─ products.service.ts
│     │  │  │     ├─ product.repository.ts
│     │  │  │     └─ product/
│     │  │  │        ├─ read.ts
│     │  │  │        ├─ shared.ts
│     │  │  │        ├─ write.ts
│     │  │  │        └─ ordering.ts
│     │  │  ├─ checkout/
│     │  │  │  ├─ checkout.controller.ts
│     │  │  │  ├─ checkout-expiry-worker.ts
│     │  │  │  ├─ checkout-retry.controller.ts
│     │  │  │  ├─ checkout.routes.ts
│     │  │  │  ├─ checkout.schemas.ts
│     │  │  │  ├─ checkout-status.controller.ts
│     │  │  │  ├─ checkout.service.ts
│     │  │  │  ├─ paymob-checkout.service.ts
│     │  │  │  ├─ checkout-reservation.repository.ts
│     │  │  │  └─ financial-evidence.repository.ts
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
│     │  │  │  ├─ orders.service.ts
│     │  │  │  ├─ order-review-flag.repository.ts
│     │  │  │  ├─ order.repository.ts
│     │  │  │  └─ order/
│     │  │  │     ├─ read.ts
│     │  │  │     ├─ shared.ts
│     │  │  │     └─ write.ts
│     │  │  ├─ payments/
│     │  │  │  └─ paymob/
│     │  │  │  ├─ paymob-callback.ts
│     │  │  │  ├─ paymob-client.ts
│     │  │  │  ├─ paymob-config.ts
│     │  │  │  ├─ paymob-hmac.ts
│     │  │  │  ├─ paymob-transaction.service.ts
│     │  │  │  ├─ paymob-webhook.controller.ts
│     │  │  │  ├─ paymob-webhook.routes.ts
│     │  │  │  ├─ paymob-webhook.service.ts
│     │  │  │  └─ paymob-callback.repository.ts
│     │  │  ├─ reviews/
│     │  │  │  └─ review.repository.ts
│     │  │  ├─ shipping/
│     │  │  │  ├─ shipping-dispatch.repository.ts
│     │  │  │  ├─ shipping-state.repository.ts
│     │  │  │  ├─ shipping-cancellation.repository.ts
│     │  │  │  ├─ shipping-action.repository.ts
│     │  │  │  ├─ shipping-edit.repository.ts
│     │  │  │  ├─ shipping-overview.repository.ts
│     │  │  │  ├─ shipping-rate.repository.ts
│     │  │  │  ├─ shipping-sync.repository.ts
│     │  │  │  ├─ shipment-binding.repository.ts
│     │  │  │  ├─ customer-shipping.repository.ts
│     │  │  │  ├─ shipping-rule-error.ts
│     │  │  │  ├─ shipping-sync-policy.ts
│     │  │  │  └─ bosta/
│     │  │  ├─ shared/
│     │  │  │  ├─ entity-media/
│     │  │  │  │  └─ entity-media.repository.ts
│     │  │  │  ├─ entity-ordering/
│     │  │  │  │  └─ entity-ordering.repository.ts
│     │  │  │  └─ related-items/
│     │  │  │     ├─ related-item.repository.ts
│     │  │  │     └─ related-item/
│     │  │  │        ├─ read.ts
│     │  │  │        ├─ shared.ts
│     │  │  │        └─ write.ts
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
│     │  ├─ services/
│     │  │  ├─ auth-session.service.ts
│     │  │  ├─ erp-permissions.service.ts
│     │  │  ├─ category.service.ts
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
│     │  │  ├─ auth-session.service.test.ts
│     │  │  ├─ checkout.service.test.ts
│     │  │  ├─ erp-permissions.service.test.ts
│     │  │  └─ uploads.test.ts
│     │  └─ unit/
│     │     ├─ admin-auth.middleware.test.ts
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
│     │  │  │  ├─ 0018_snapshot.json
│     │  │  │  ├─ 0019_snapshot.json
│     │  │  │  ├─ 0020_snapshot.json
│     │  │  │  ├─ 0021_snapshot.json
│     │  │  │  ├─ 0022_snapshot.json
│     │  │  │  ├─ 0023_snapshot.json
│     │  │  │  ├─ 0024_snapshot.json
│     │  │  │  ├─ 0025_snapshot.json
│     │  │  │  ├─ 0026_snapshot.json
│     │  │  │  ├─ 0027_snapshot.json
│     │  │  │  ├─ 0028_snapshot.json
│     │  │  │  ├─ 0029_snapshot.json
│     │  │  │  ├─ 0030_snapshot.json
│     │  │  │  ├─ 0031_snapshot.json
│     │  │  │  ├─ 0034_snapshot.json
│     │  │  │  ├─ 0035_snapshot.json
│     │  │  │  ├─ 0036_snapshot.json
│     │  │  │  ├─ 0037_snapshot.json
│     │  │  │  ├─ 0038_snapshot.json
│     │  │  │  ├─ 0039_snapshot.json
│     │  │  │  ├─ 0040_snapshot.json
│     │  │  │  ├─ 0041_snapshot.json
│     │  │  │  ├─ 0042_snapshot.json
│     │  │  │  ├─ 0043_snapshot.json
│     │  │  │  ├─ 0044_snapshot.json
│     │  │  │  ├─ 0045_snapshot.json
│     │  │  │  ├─ 0046_snapshot.json
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
│     │  │  ├─ 0009_abundant_gargoyle.sql
│     │  │  ├─ 0010_category_slug_scope.sql
│     │  │  ├─ 0011_category_sort_order.sql
│     │  │  ├─ 0012_fk_hardening.sql
│     │  │  ├─ 0013_category_paths.sql
│     │  │  ├─ 0014_entity_orderings.sql
│     │  │  ├─ 0015_category_images.sql
│     │  │  ├─ 0016_shop_media_sections.sql
│     │  │  ├─ 0017_shop_media_mobile_images.sql
│     │  │  ├─ 0018_shop_media_optional_images.sql
│     │  │  ├─ 0019_advices_video_only.sql
│     │  │  ├─ 0020_variant_discounts.sql
│     │  │  ├─ 0021_wishlist_entities.sql
│     │  │  ├─ 0022_advices_entity_ordering.sql
│     │  │  ├─ 0023_reviews.sql
│     │  │  ├─ 0024_review_prompt_states.sql
│     │  │  ├─ 0025_review_prompt_orders.sql
│     │  │  ├─ 0026_review_submission_history.sql
│     │  │  ├─ 0027_entity_media.sql
│     │  │  ├─ 0028_offer_categories.sql
│     │  │  ├─ 0029_localized_shop_media.sql
│     │  │  ├─ 0030_bundle_youtube_urls.sql
│     │  │  ├─ 0031_localized_entity_images.sql
│     │  │  ├─ 0032_announcements.sql
│     │  │  ├─ 0033_announcement_bar_settings.sql
│     │  │  ├─ 0034_paymob_checkout_foundation.sql
│     │  │  ├─ 0035_paymob_webhook_events.sql
│     │  │  ├─ 0036_paymob_attempt_identifiers.sql
│     │  │  ├─ 0037_separate_provider_payment_status.sql
│     │  │  ├─ 0038_tidy_matthew_murdock.sql
│     │  │  ├─ 0039_graceful_piledriver.sql
│     │  │  ├─ 0040_stormy_mandrill.sql
│     │  │  ├─ 0041_stormy_stingray.sql
│     │  │  ├─ 0042_shocking_changeling.sql
│     │  │  ├─ 0043_modern_matthew_murdock.sql
│     │  │  ├─ 0044_lonely_nomad.sql
│     │  │  ├─ 0045_plain_scalphunter.sql
│     │  │  └─ 0046_powerful_pepper_potts.sql
│     │  └─ schema.ts
│     ├─ drizzle.config.ts
│     ├─ src/
│     │  ├─ client.ts
│     │  ├─ db.ts
│     │  ├─ env.ts
│     │  └─ seeds/
│     │     ├─ categories.seed.ts
│     │     └─ index.ts
│     ├─ tests/
│     │  ├─ helpers/
│     │  │  ├─ mysql-errors.ts
│     │  │  └─ test-seed.ts
│     │  ├─ env.test.ts
│     │  └─ integrity.test.ts
│     ├─ scripts/
│     │  ├─ run-test-migrations.mjs
│     │  └─ run-tests.mjs
│     ├─ tsconfig.json
│     └─ package.json
│
├─ docs/
│  ├─ folder-structure.md
│  ├─ mobile-app-plan.md
│  ├─ paymob-checkout-orders-audit.md
│  ├─ paymob-integration-status.md
│  ├─ storefront-erp-spec.md
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
- `modules/catalog/collections/collection.repository.ts` owns collection persistence.

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
- Do not reintroduce `cat.txt`; the initial category tree is documented in `docs/storefront-erp-spec.md`.
- Shared UI primitives now live in `packages/shared/src/ui`; per-app `components/ui` folders only hold app-specific primitives. Storefront: icons/illustrations. ERP: the full primitive set under `apps/erp/src/components/ui` (alert, badge, button, card, empty-state, field, file-button, input, modal, row-menu, skeleton, switch, table, thumb), plus the cross-feature building blocks in `apps/erp/src/components/{admin,forms}`.
- Do not expose ERP staff-management or role/permission editing without going through `erp-permissions` enforcement on the API side.
