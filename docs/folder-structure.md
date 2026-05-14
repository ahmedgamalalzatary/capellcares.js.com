# Capella Monorepo Folder Structure

## Purpose

This file defines the canonical folder structure for the Capella project.

The next engineer or AI agent should treat this as the implementation baseline and should not redesign the project structure unless a new explicit product decision replaces it.

This structure reflects the locked project decisions:
- one monorepo
- `Next.js` storefront
- separate `Next.js` ERP app
- `Express.js` API
- `MySQL`
- `Drizzle ORM`
- public storefront API separated from ERP/admin API
- orders persisted in DB but no ERP orders UI in v1
- bilingual storefront
- Arabic-first ERP

## Architecture Rules

- `apps/storefront` is the customer-facing storefront only.
- `apps/erp` is the admin ERP frontend only.
- `apps/api` is the backend API for both storefront and ERP.
- `packages/shared` holds DTOs, validation schemas, enums, constants, and shared business-safe types.
- `packages/database` holds the Drizzle schema, migrations, seed logic, and DB client.
- Storefront reads data through the API only.
- ERP writes and manages data through the API only.
- Public catalog routes and ERP routes must stay separated.
- Orders are stored through internal service calls, not public order routes, in v1.

## Canonical Tree

```text
capella/
├─ apps/
│  ├─ storefront/                               # Next.js customer-facing app
│  │  ├─ public/
│  │  │  ├─ images/
│  │  │  └─ icons/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ [lang]/
│  │  │  │  │  ├─ page.tsx                     # redirects to /[lang]/products
│  │  │  │  │  ├─ layout.tsx
│  │  │  │  │  ├─ products/
│  │  │  │  │  │  ├─ page.tsx
│  │  │  │  │  │  └─ [slug]/
│  │  │  │  │  │     └─ page.tsx
│  │  │  │  │  ├─ category/
│  │  │  │  │  │  └─ [slug]/
│  │  │  │  │  │     └─ page.tsx
│  │  │  │  │  ├─ offers/
│  │  │  │  │  │  ├─ page.tsx
│  │  │  │  │  │  └─ [slug]/
│  │  │  │  │  │     └─ page.tsx
│  │  │  │  │  ├─ cart/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ checkout/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ wishlist/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  ├─ login/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  └─ signup/
│  │  │  │  │     └─ page.tsx
│  │  │  │  ├─ globals.css
│  │  │  │  └─ not-found.tsx
│  │  │  ├─ components/
│  │  │  │  ├─ ui/
│  │  │  │  ├─ layout/
│  │  │  │  ├─ products/
│  │  │  │  ├─ offers/
│  │  │  │  ├─ cart/
│  │  │  │  ├─ checkout/
│  │  │  │  ├─ wishlist/
│  │  │  │  └─ auth/
│  │  │  ├─ lib/
│  │  │  │  ├─ api/
│  │  │  │  │  ├─ client.ts                    # always sends x-lang
│  │  │  │  │  ├─ products.ts
│  │  │  │  │  ├─ categories.ts
│  │  │  │  │  ├─ offers.ts
│  │  │  │  │  ├─ auth.ts
│  │  │  │  │  ├─ wishlist.ts
│  │  │  │  │  └─ checkout.ts
│  │  │  │  ├─ auth/
│  │  │  │  ├─ cart/
│  │  │  │  ├─ i18n/
│  │  │  │  ├─ formatters/
│  │  │  │  ├─ validators/
│  │  │  │  └─ utils/
│  │  │  ├─ hooks/
│  │  │  ├─ messages/
│  │  │  │  ├─ ar.json
│  │  │  │  └─ en.json
│  │  │  ├─ styles/
│  │  │  └─ types/
│  │  ├─ middleware.ts                         # locale detection/normalization
│  │  ├─ next.config.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  ├─ erp/                                     # Next.js ERP/admin app
│  │  ├─ public/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ login/
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ dashboard/
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ products/
│  │  │  │  │  ├─ page.tsx
│  │  │  │  │  ├─ new/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  └─ [id]/
│  │  │  │  │     ├─ page.tsx
│  │  │  │  │     └─ edit/
│  │  │  │  │        └─ page.tsx
│  │  │  │  ├─ categories/
│  │  │  │  │  ├─ page.tsx
│  │  │  │  │  ├─ new/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  └─ [id]/
│  │  │  │  │     └─ edit/
│  │  │  │  │        └─ page.tsx
│  │  │  │  ├─ offers/
│  │  │  │  │  ├─ page.tsx
│  │  │  │  │  ├─ new/
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  └─ [id]/
│  │  │  │  │     └─ edit/
│  │  │  │  │        └─ page.tsx
│  │  │  │  ├─ trash/
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ layout.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ components/
│  │  │  │  ├─ ui/
│  │  │  │  ├─ layout/
│  │  │  │  ├─ forms/
│  │  │  │  ├─ products/
│  │  │  │  ├─ categories/
│  │  │  │  ├─ offers/
│  │  │  │  ├─ tables/
│  │  │  │  └─ uploads/
│  │  │  ├─ lib/
│  │  │  │  ├─ api/
│  │  │  │  │  ├─ client.ts
│  │  │  │  │  ├─ auth.ts
│  │  │  │  │  ├─ admin-products.ts
│  │  │  │  │  ├─ admin-categories.ts
│  │  │  │  │  ├─ admin-offers.ts
│  │  │  │  │  └─ uploads.ts
│  │  │  │  ├─ auth/
│  │  │  │  ├─ validators/
│  │  │  │  └─ utils/
│  │  │  ├─ hooks/
│  │  │  ├─ styles/
│  │  │  └─ types/
│  │  ├─ middleware.ts
│  │  ├─ next.config.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  └─ api/                                     # Express.js backend API
│     ├─ src/
│     │  ├─ server.ts
│     │  ├─ app.ts
│     │  ├─ config/
│     │  │  ├─ env.ts
│     │  │  ├─ constants.ts
│     │  │  └─ paymob.ts
│     │  ├─ middlewares/
│     │  │  ├─ auth.middleware.ts
│     │  │  ├─ admin-auth.middleware.ts
│     │  │  ├─ locale.middleware.ts
│     │  │  ├─ validate.middleware.ts
│     │  │  └─ error.middleware.ts
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  │  ├─ auth.controller.ts
│     │  │  │  ├─ auth.service.ts
│     │  │  │  ├─ auth.routes.ts
│     │  │  │  └─ auth.schemas.ts
│     │  │  ├─ customers/
│     │  │  │  ├─ customers.controller.ts
│     │  │  │  ├─ customers.service.ts
│     │  │  │  ├─ customers.routes.ts
│     │  │  │  └─ customers.schemas.ts
│     │  │  ├─ catalog/
│     │  │  │  ├─ products/
│     │  │  │  │  ├─ products.controller.ts
│     │  │  │  │  ├─ products.service.ts
│     │  │  │  │  ├─ products.routes.ts
│     │  │  │  │  ├─ products.schemas.ts
│     │  │  │  │  └─ products.mapper.ts
│     │  │  │  ├─ categories/
│     │  │  │  │  ├─ categories.controller.ts
│     │  │  │  │  ├─ categories.service.ts
│     │  │  │  │  ├─ categories.routes.ts
│     │  │  │  │  └─ categories.schemas.ts
│     │  │  │  └─ offers/
│     │  │  │     ├─ offers.controller.ts
│     │  │  │     ├─ offers.service.ts
│     │  │  │     ├─ offers.routes.ts
│     │  │  │     ├─ offers.schemas.ts
│     │  │  │     └─ offers.mapper.ts
│     │  │  ├─ wishlist/
│     │  │  │  ├─ wishlist.controller.ts
│     │  │  │  ├─ wishlist.service.ts
│     │  │  │  ├─ wishlist.routes.ts
│     │  │  │  └─ wishlist.schemas.ts
│     │  │  ├─ checkout/
│     │  │  │  ├─ checkout.controller.ts
│     │  │  │  ├─ checkout.service.ts
│     │  │  │  ├─ checkout.routes.ts
│     │  │  │  └─ checkout.schemas.ts
│     │  │  ├─ orders/
│     │  │  │  ├─ orders.service.ts          # internal-only in v1
│     │  │  │  ├─ orders.schemas.ts
│     │  │  │  └─ orders.mapper.ts
│     │  │  ├─ payments/
│     │  │  │  └─ paymob/
│     │  │  │     ├─ paymob.controller.ts
│     │  │  │     ├─ paymob.service.ts
│     │  │  │     ├─ paymob.routes.ts
│     │  │  │     ├─ paymob.schemas.ts
│     │  │  │     └─ paymob.mapper.ts
│     │  │  ├─ uploads/
│     │  │  │  ├─ uploads.controller.ts
│     │  │  │  ├─ uploads.service.ts
│     │  │  │  ├─ uploads.routes.ts
│     │  │  │  └─ uploads.schemas.ts
│     │  │  └─ admin/
│     │  │     ├─ products/
│     │  │     │  ├─ admin-products.controller.ts
│     │  │     │  ├─ admin-products.service.ts
│     │  │     │  ├─ admin-products.routes.ts
│     │  │     │  ├─ admin-products.schemas.ts
│     │  │     │  └─ admin-products.mapper.ts
│     │  │     ├─ categories/
│     │  │     │  ├─ admin-categories.controller.ts
│     │  │     │  ├─ admin-categories.service.ts
│     │  │     │  ├─ admin-categories.routes.ts
│     │  │     │  └─ admin-categories.schemas.ts
│     │  │     └─ offers/
│     │  │        ├─ admin-offers.controller.ts
│     │  │        ├─ admin-offers.service.ts
│     │  │        ├─ admin-offers.routes.ts
│     │  │        ├─ admin-offers.schemas.ts
│     │  │        └─ admin-offers.mapper.ts
│     │  ├─ repositories/
│     │  │  ├─ product.repository.ts
│     │  │  ├─ product-variant.repository.ts
│     │  │  ├─ category.repository.ts
│     │  │  ├─ offer.repository.ts
│     │  │  ├─ offer-item.repository.ts
│     │  │  ├─ order.repository.ts
│     │  │  ├─ order-item.repository.ts
│     │  │  ├─ customer.repository.ts
│     │  │  └─ wishlist.repository.ts
│     │  ├─ services/
│     │  │  ├─ slug.service.ts
│     │  │  ├─ image.service.ts              # Hostinger file storage integration
│     │  │  ├─ stock.service.ts
│     │  │  ├─ locale.service.ts
│     │  │  └─ price.service.ts
│     │  ├─ routes/
│     │  │  ├─ storefront.routes.ts          # mounts public routes under /api/v1
│     │  │  ├─ erp.routes.ts                 # mounts ERP routes under /api/erp
│     │  │  └─ index.ts                      # mounts the two route groups
│     │  └─ utils/
│     ├─ tests/
│     ├─ tsconfig.json
│     └─ package.json
│
├─ packages/
│  ├─ shared/
│  │  ├─ src/
│  │  │  ├─ dto/
│  │  │  │  ├─ product.dto.ts
│  │  │  │  ├─ category.dto.ts
│  │  │  │  ├─ offer.dto.ts
│  │  │  │  ├─ checkout.dto.ts
│  │  │  │  ├─ order.dto.ts
│  │  │  │  ├─ wishlist.dto.ts
│  │  │  │  └─ auth.dto.ts
│  │  │  ├─ schemas/
│  │  │  │  ├─ product.schema.ts
│  │  │  │  ├─ category.schema.ts
│  │  │  │  ├─ offer.schema.ts
│  │  │  │  ├─ checkout.schema.ts
│  │  │  │  ├─ wishlist.schema.ts
│  │  │  │  └─ auth.schema.ts
│  │  │  ├─ constants/
│  │  │  │  ├─ languages.ts
│  │  │  │  ├─ currency.ts
│  │  │  │  ├─ product-status.ts
│  │  │  │  ├─ payment-methods.ts
│  │  │  │  └─ soft-delete.ts
│  │  │  ├─ enums/
│  │  │  ├─ types/
│  │  │  └─ utils/
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  ├─ database/
│  │  ├─ drizzle/
│  │  │  ├─ schema.ts
│  │  │  ├─ relations.ts
│  │  │  └─ migrations/
│  │  ├─ drizzle.config.ts
│  │  ├─ src/
│  │  │  ├─ client.ts
│  │  │  ├─ db.ts
│  │  │  └─ seeds/
│  │  │     ├─ index.ts
│  │  │     └─ categories.seed.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  ├─ eslint-config/
│  └─ tsconfig/
│
├─ docs/
│  ├─ storefront-erp-spec.md
│  └─ folder-structure.md
│
├─ infra/
│  ├─ docker/
│  │  └─ mysql/
│  └─ scripts/
│
├─ cat.txt
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ README.md
```

## Required Boundaries

### Frontend App Boundaries

- `apps/storefront` must not contain ERP pages.
- `apps/erp` must not contain storefront customer pages.
- Both frontend apps consume the backend through HTTP APIs.

### API Route Boundaries

- `routes/storefront.routes.ts` mounts public/storefront-facing endpoints.
- `routes/erp.routes.ts` mounts ERP/admin endpoints.
- `routes/index.ts` only composes the two route groups.
- ERP routes must be protected by `admin-auth.middleware.ts`.
- Storefront routes use customer auth only where needed.

### Orders Boundary

- `modules/orders/` is internal-only in v1.
- Do not expose `orders.routes.ts` or `orders.controller.ts` in v1.
- `checkout.service.ts` persists orders by calling `orders.service.ts`.
- Payment flow may also update order/payment state through internal service calls.

### Locale Boundary

- Storefront locale is controlled by `[lang]` routes.
- Storefront API client must send the active locale to the API on every localized request.
- API locale middleware/service must normalize and expose the locale to catalog search and response mapping.

### Upload Boundary

- `modules/uploads/` owns upload HTTP endpoints.
- `services/image.service.ts` owns Hostinger file storage integration details.
- Product and offer image replacement must go through this boundary.

## Notes For Future Implementers

- Follow this structure directly unless a new explicit decision changes it.
- Do not collapse `storefront`, `erp`, and `api` into fewer apps.
- Do not merge public catalog and ERP admin modules.
- Do not expose orders as public endpoints in v1.
- Do not move storefront to direct DB access.
