# Capella Monorepo Folder Structure

## Purpose

This file defines the canonical folder and boundary expectations for the Capella project.

Treat this as the implementation baseline unless a new explicit product decision replaces it. The tree is intentionally pragmatic: required boundaries are strict, but helper folders/files are created when the implementation needs them.

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
- Storefront static UI translation stays centralized in `packages/shared/src/i18n` for now.
- Frontend API access may stay centralized in `client.ts`; split API files are optional, not mandatory.

## Architecture Rules

- `apps/storefront` must not contain ERP pages.
- `apps/erp` must not contain storefront customer pages.
- `apps/api` owns backend behavior for both apps.
- `packages/shared` holds shared DTOs, validation schemas, constants, i18n dictionaries, and business-safe types.
- `packages/database` holds Drizzle schema, relations, migrations, seeds, and DB client.
- Storefront reads data through the API only.
- ERP writes and manages data through the API only.
- Orders are stored through checkout/internal service calls, not public order routes, in v1.

## Canonical Tree

```text
capella/
├─ apps/
│  ├─ storefront/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ [lang]/
│  │  │  │  │  ├─ cart/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ category/
│  │  │  │  │  │  └─ [slug]/page.tsx
│  │  │  │  │  ├─ checkout/
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
│  │  │  │  ├─ auth/
│  │  │  │  │  └─ auth-forms.tsx
│  │  │  │  ├─ cart/
│  │  │  │  │  └─ cart-view.tsx
│  │  │  │  ├─ checkout/
│  │  │  │  │  └─ checkout-view.tsx
│  │  │  │  ├─ layout/
|  |  |  |  |  └─ breadcrumbs.tsx
|  |  |  |  |  ├─ footer.tsx
|  |  |  |  |  └─ header.tsx
│  │  │  │  ├─ offers/
│  │  │  │  │  └─ offer-detail.tsx
│  │  │  │  ├─ orders/
│  │  │  │  │  ├─ order-detail-view.tsx
│  │  │  │  │  └─ orders-view.tsx
│  │  │  │  ├─ products/
│  │  │  │  │  ├─ advice-section.tsx
│  │  │  │  │  ├─ product-card.tsx
│  │  │  │  │  ├─ product-detail.tsx
│  │  │  │  │  └─ product-grid.tsx
│  │  │  │  ├─ providers/
│  │  │  │  │  ├─ auth-provider.tsx
│  │  │  │  │  ├─ cart-provider.tsx
│  │  │  │  │  └─ wishlist-provider.tsx
│  │  │  │  ├─ search/
│  │  │  │  │  ├─ ask-capella-button.tsx
│  │  │  │  │  └─ ask-capella-overlay.tsx
│  │  │  │  ├─ ui/
│  │  │  │  │  ├─ badge.tsx
│  │  │  │  │  ├─ button.tsx
│  │  │  │  │  ├─ card.tsx
│  │  │  │  │  ├─ icons.tsx
│  │  │  │  │  ├─ input.tsx
│  │  │  │  │  ├─ label.tsx
│  │  │  │  │  ├─ offer-illustration.tsx
│  │  │  │  │  ├─ product-illustration.tsx
│  │  │  │  │  ├─ select.tsx
│  │  │  │  │  ├─ separator.tsx
│  │  │  │  │  ├─ table.tsx
│  │  │  │  │  └─ textarea.tsx
│  │  │  │  └─ wishlist/
│  │  │  │     └─ wishlist-view.tsx
│  │  │  └─ lib/
│  │  │     ├─ api/
│  │  │     │  ├─ base.ts
│  │  │     │  └─ client.ts
│  │  │     ├─ cart.ts
│  │  │     ├─ nav.ts
│  │  │     ├─ seo.ts
│  │  │     └─ utils.ts
│  │  ├─ tests/
│  │  │  ├─ components/
│  │  │  │  ├─ advice-section.test.tsx
│  │  │  │  ├─ auth-provider.test.tsx
│  │  │  │  ├─ order-page.test.tsx
│  │  │  │  └─ orders-view.test.tsx
│  │  │  ├─ contracts/
│  │  │  │  └─ storefront-client.contract.test.ts
│  │  │  ├─ unit/
│  │  │  │  ├─ api-base.test.ts
│  │  │  │  └─ cart.test.ts
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
│  │  │  │  ├─ trash/page.tsx
│  │  │  │  ├─ layout.tsx
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ globals.css
│  │  │  ├─ components/
│  │  │  │  ├─ forms/
│  │  │  │  │  ├─ advice-form.tsx
│  │  │  │  │  ├─ category-form.tsx
│  │  │  │  │  ├─ category-picker.tsx
│  │  │  │  │  ├─ image-upload.tsx
│  │  │  │  │  ├─ offer-form.tsx
│  │  │  │  │  └─ product-form.tsx
│  │  │  │  ├─ orders/
│  │  │  │  │  └─ order-details-view.tsx
│  │  │  │  ├─ providers/
│  │  │  │  │  ├─ admin-auth.tsx
│  │  │  │  │  └─ erp-toaster.tsx
│  │  │  │  ├─ shell/
│  │  │  │  │  └─ admin-shell.tsx
│  │  │  │  └─ ui/
│  │  │  │     ├─ badge.tsx
│  │  │  │     ├─ button.tsx
│  │  │  │     ├─ card.tsx
│  │  │  │     ├─ checkbox.tsx
│  │  │  │     ├─ icons.tsx
│  │  │  │     ├─ input.tsx
│  │  │  │     ├─ label.tsx
│  │  │  │     ├─ modal.tsx
│  │  │  │     ├─ select.tsx
│  │  │  │     ├─ separator.tsx
│  │  │  │     ├─ table.tsx
│  │  │  │     └─ textarea.tsx
│  │  │  └─ lib/
│  │  │     ├─ api/
│  │  │     │  ├─ base.ts
│  │  │     │  └─ client.ts
│  │  │     ├─ errors.ts
│  │  │     ├─ store.ts
│  │  │     └─ utils.ts
│  │  ├─ tests/
│  │  │  ├─ advices-page.test.tsx
│  │  │  ├─ api-base.test.ts
│  │  │  ├─ category-form.test.tsx
│  │  │  ├─ category-form-toast.test.tsx
│  │  │  ├─ error-messages.test.ts
│  │  │  ├─ offers-page.test.tsx
│  │  │  ├─ order-detail-page.test.tsx
│  │  │  ├─ orders-page.test.tsx
│  │  │  ├─ products-page.test.tsx
│  │  │  ├─ store.test.ts
│  │  │  ├─ trash-page.test.tsx
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
│     │  │  ├─ constants.ts
│     │  │  └─ env.ts
│     │  ├─ middlewares/
│     │  │  ├─ admin-auth.middleware.ts
│     │  │  ├─ auth.middleware.ts
│     │  │  ├─ error.middleware.ts
│     │  │  ├─ locale.middleware.ts
│     │  │  ├─ rate-limit.middleware.ts
│     │  │  └─ validate.middleware.ts
│     │  ├─ modules/
│     │  │  ├─ advices/
│     │  │  │  ├─ advices.controller.ts
│     │  │  │  ├─ admin-advices.routes.ts
│     │  │  │  └─ storefront-advices.routes.ts
│     │  │  ├─ admin/
│     │  │  │  ├─ admin.controller.ts
│     │  │  │  ├─ admin.routes.ts
│     │  │  │  ├─ auth/
│     │  │  │  │  ├─ admin-auth.controller.ts
│     │  │  │  │  ├─ admin-auth.routes.ts
│     │  │  │  │  ├─ admin-auth.schemas.ts
│     │  │  │  │  └─ admin-auth.service.ts
│     │  │  │  ├─ categories/
│     │  │  │  │  ├─ admin-categories.controller.ts
│     │  │  │  │  ├─ admin-categories.routes.ts
│     │  │  │  │  ├─ admin-categories.schemas.ts
│     │  │  │  │  └─ admin-categories.service.ts
│     │  │  │  ├─ offers/
│     │  │  │  │  ├─ admin-offers.controller.ts
│     │  │  │  │  ├─ admin-offers.mapper.ts
│     │  │  │  │  ├─ admin-offers.routes.ts
│     │  │  │  │  ├─ admin-offers.schemas.ts
│     │  │  │  │  └─ admin-offers.service.ts
│     │  │  │  └─ products/
│     │  │  │     ├─ admin-products.controller.ts
│     │  │  │     ├─ admin-products.mapper.ts
│     │  │  │     ├─ admin-products.routes.ts
│     │  │  │     ├─ admin-products.schemas.ts
│     │  │  │     └─ admin-products.service.ts
│     │  │  ├─ auth/
│     │  │  │  ├─ auth.controller.ts
│     │  │  │  ├─ auth.routes.ts
│     │  │  │  ├─ auth.schemas.ts
│     │  │  │  ├─ auth.service.ts
│     │  │  │  └─ cookie-options.ts
│     │  │  ├─ catalog/
│     │  │  │  ├─ catalog.controller.ts
│     │  │  │  ├─ catalog.routes.ts
│     │  │  │  ├─ categories/
│     │  │  │  │  ├─ categories.controller.ts
│     │  │  │  │  ├─ categories.routes.ts
│     │  │  │  │  ├─ categories.schemas.ts
│     │  │  │  │  └─ categories.service.ts
│     │  │  │  ├─ offers/
│     │  │  │  │  ├─ offers.controller.ts
│     │  │  │  │  ├─ offers.mapper.ts
│     │  │  │  │  ├─ offers.routes.ts
│     │  │  │  │  ├─ offers.schemas.ts
│     │  │  │  │  └─ offers.service.ts
│     │  │  │  └─ products/
│     │  │  │     ├─ products.controller.ts
│     │  │  │     ├─ products.mapper.ts
│     │  │  │     ├─ products.routes.ts
│     │  │  │     ├─ products.schemas.ts
│     │  │  │     └─ products.service.ts
│     │  │  ├─ checkout/
│     │  │  │  ├─ checkout.controller.ts
│     │  │  │  ├─ checkout.routes.ts
│     │  │  │  ├─ checkout.schemas.ts
│     │  │  │  └─ checkout.service.ts
│     │  │  ├─ customers/
│     │  │  │  ├─ customers.controller.ts
│     │  │  │  ├─ customers.routes.ts
│     │  │  │  ├─ customers.schemas.ts
│     │  │  │  └─ customers.service.ts
│     │  │  ├─ orders/
│     │  │  │  ├─ admin-orders.routes.ts
│     │  │  │  ├─ orders.controller.ts
│     │  │  │  ├─ orders.mapper.ts
│     │  │  │  ├─ orders.routes.ts
│     │  │  │  ├─ orders.schemas.ts
│     │  │  │  └─ orders.service.ts
│     │  │  ├─ uploads/
│     │  │  │  ├─ uploads.controller.ts
│     │  │  │  ├─ uploads.routes.ts
│     │  │  │  ├─ uploads.schemas.ts
│     │  │  │  └─ uploads.service.ts
│     │  │  └─ wishlist/
│     │  │     ├─ wishlist.controller.ts
│     │  │     ├─ wishlist.routes.ts
│     │  │     ├─ wishlist.schemas.ts
│     │  │     └─ wishlist.service.ts
│     │  ├─ repositories/
│     │  │  ├─ admin-user.repository.ts
│     │  │  ├─ advice.repository.ts
│     │  │  ├─ auth-session.repository.ts
│     │  │  ├─ category.repository.ts
│     │  │  ├─ customer.repository.ts
│     │  │  ├─ offer-item.repository.ts
│     │  │  ├─ offer.repository.ts
│     │  │  ├─ order-item.repository.ts
│     │  │  ├─ order.repository.ts
│     │  │  ├─ product-variant.repository.ts
│     │  │  ├─ product.repository.ts
│     │  │  └─ wishlist.repository.ts
│     │  ├─ services/
│     │  │  ├─ auth-session.service.ts
│     │  │  ├─ image.service.ts
│     │  │  └─ slug.service.ts
│     │  ├─ routes/
│     │  │  ├─ erp.routes.ts
│     │  │  ├─ index.ts
│     │  │  └─ storefront.routes.ts
│     │  ├─ types/
│     │  │  └─ domain.ts
│     │  └─ utils/
│     │     └─ index.ts
│     ├─ tests/
│     │  ├─ contracts/
│     │  │  └─ storefront-contracts.test.ts
│     │  ├─ helpers/
│     │  │  ├─ admin-auth.ts
│     │  │  ├─ database.ts
│     │  │  └─ request.ts
│     │  ├─ repositories/
│     │  │  └─ admin-products.repository.test.ts
│     │  ├─ routes/
│     │  │  ├─ admin-auth.routes.test.ts
│     │  │  ├─ admin-categories.routes.test.ts
│     │  │  ├─ admin-offers.routes.test.ts
│     │  │  ├─ admin-products.routes.test.ts
│     │  │  ├─ advices.routes.test.ts
│     │  │  ├─ auth.routes.test.ts
│     │  │  ├─ checkout.routes.test.ts
│     │  │  ├─ orders.routes.test.ts
│     │  │  ├─ wishlist.routes.test.ts
│     │  │  └─ x-lang.routes.test.ts
│     │  ├─ services/
│     │  │  ├─ admin-auth.service.test.ts
│     │  │  ├─ admin-products.service.test.ts
│     │  │  ├─ checkout.service.test.ts
│     │  │  └─ uploads.test.ts
│     │  └─ unit/
│     │     ├─ auth.middleware.test.ts
│     │     ├─ checkout.schemas.test.ts
│     │     └─ load-workspace-env.test.ts
│     ├─ tsconfig.json
│     └─ package.json
│
├─ packages/
│  ├─ shared/
│  │  ├─ src/
│  │  │  ├─ constants/
│  │  │  │  ├─ currency.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ languages.ts
│  │  │  │  ├─ payment-methods.ts
│  │  │  │  ├─ product-status.ts
│  │  │  │  └─ soft-delete.ts
│  │  │  ├─ dto/
│  │  │  │  ├─ advice.dto.ts
│  │  │  │  ├─ auth.dto.ts
│  │  │  │  ├─ category.dto.ts
│  │  │  │  ├─ checkout.dto.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ offer.dto.ts
│  │  │  │  ├─ order.dto.ts
│  │  │  │  ├─ product.dto.ts
│  │  │  │  └─ wishlist.dto.ts
│  │  │  ├─ enums/
│  │  │  │  └─ index.ts
│  │  │  ├─ i18n/
│  │  │  │  ├─ ar.ts
│  │  │  │  ├─ en.ts
│  │  │  │  └─ index.ts
│  │  │  ├─ schemas/
│  │  │  │  ├─ advice.schema.ts
│  │  │  │  ├─ auth.schema.ts
│  │  │  │  ├─ category.schema.ts
│  │  │  │  ├─ checkout.schema.ts
│  │  │  │  ├─ index.ts
│  │  │  │  ├─ offer.schema.ts
│  │  │  │  ├─ product.schema.ts
│  │  │  │  └─ wishlist.schema.ts
│  │  │  ├─ types/
│  │  │  │  └─ index.ts
│  │  │  ├─ utils/
│  │  │  │  └─ index.ts
│  │  │  └─ index.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  └─ database/
│     ├─ drizzle/
│     │  ├─ migrations/
│     │  │  ├─ meta/
│     │  │  │  ├─ 0000_snapshot.json
│     │  │  │  └─ _journal.json
│     │  │  ├─ 0000_glamorous_proudstar.sql
│     │  │  ├─ 0001_handy_advices.sql
│     │  │  └─ 0002_auth_sessions.sql
│     │  ├─ relations.ts
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
│     │  └─ env.test.ts
│     ├─ scripts/
│     │  └─ run-test-migrations.mjs
│     ├─ tsconfig.json
│     └─ package.json
│
├─ docs/
│  ├─ storefront-erp-spec.md
│  ├─ folder-structure.md
│  ├─ testing-design.md
│  └─ deploy.md
├─ .agents/
│  ├─ King-Mode/
│  │  └─ Skill.md
│  ├─ brainstorming/
│  │  └─ SKILL.md
│  ├─ frontend-design/
│  │  └─ SKILL.md
│  ├─ receiving-code-review/
│  │  └─ SKILL.md
│  ├─ test-driven-development/
│  │  ├─ SKILL.md
│  │  └─ testing-anti-patterns.md
│  └─ verification-before-completion/
│     └─ SKILL.md
├─ .env.example
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ pnpm-lock.yaml
```

## Optional Folders / Files

The following may be added when they create real value, but are not required just to satisfy structure:

- Split frontend API files such as `products.ts`, `categories.ts`, `auth.ts`, `wishlist.ts`, `checkout.ts`.
- Frontend `hooks/`, `styles/`, `types/`, `validators/`, `formatters/`, and `auth/` folders.
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

### Upload Boundary

- `modules/uploads/` owns upload HTTP endpoints.
- `services/image.service.ts` owns Hostinger file storage integration details.
- Product and offer image replacement must go through this boundary.

## Notes For Future Implementers

- Do not collapse `storefront`, `erp`, and `api` into fewer apps without an explicit decision.
- Do not merge public catalog and ERP admin modules.
- Do not expose ERP order-mutation (cancel/modify) UI in v1.
- Do not move storefront or ERP to direct DB access.
- Do not reintroduce `cat.txt`; the initial category tree is documented in `docs/storefront-erp-spec.md`.


