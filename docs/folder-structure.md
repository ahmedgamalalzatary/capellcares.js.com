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
- Orders are persisted in DB, but ERP order-management UI is deferred.
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
│  │  ├─ public/
│  │  │  ├─ images/
│  │  │  └─ icons/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ [lang]/
│  │  │  │  │  ├─ page.tsx
│  │  │  │  │  ├─ layout.tsx
│  │  │  │  │  ├─ products/
│  │  │  │  │  │  ├─ page.tsx
│  │  │  │  │  │  └─ [slug]/page.tsx
│  │  │  │  │  ├─ category/[slug]/page.tsx
│  │  │  │  │  ├─ offers/
│  │  │  │  │  │  ├─ page.tsx
│  │  │  │  │  │  └─ [slug]/page.tsx
│  │  │  │  │  ├─ cart/page.tsx
│  │  │  │  │  ├─ checkout/page.tsx
│  │  │  │  │  ├─ wishlist/page.tsx
│  │  │  │  │  ├─ login/page.tsx
│  │  │  │  │  └─ signup/page.tsx
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
│  │  │  └─ lib/
│  │  │     ├─ api/
│  │  │     │  └─ client.ts
│  │  │     └─ utils.ts
│  │  ├─ middleware.ts
│  │  ├─ next.config.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  ├─ erp/
│  │  ├─ public/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ login/page.tsx
│  │  │  │  ├─ dashboard/page.tsx
│  │  │  │  ├─ products/
│  │  │  │  │  ├─ page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ [id]/
│  │  │  │  │     ├─ page.tsx
│  │  │  │  │     └─ edit/page.tsx
│  │  │  │  ├─ categories/
│  │  │  │  │  ├─ page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ [id]/edit/page.tsx
│  │  │  │  ├─ offers/
│  │  │  │  │  ├─ page.tsx
│  │  │  │  │  ├─ new/page.tsx
│  │  │  │  │  └─ [id]/edit/page.tsx
│  │  │  │  ├─ trash/page.tsx
│  │  │  │  ├─ layout.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ components/
│  │  │  │  ├─ ui/
│  │  │  │  ├─ shell/
│  │  │  │  ├─ providers/
│  │  │  │  └─ forms/
│  │  │  └─ lib/
│  │  │     ├─ api/client.ts
│  │  │     ├─ store.ts
│  │  │     └─ utils.ts
│  │  ├─ next.config.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  └─ api/
│     ├─ src/
│     │  ├─ server.ts
│     │  ├─ app.ts
│     │  ├─ config/
│     │  │  ├─ env.ts
│     │  │  └─ constants.ts
│     │  ├─ middlewares/
│     │  │  ├─ auth.middleware.ts
│     │  │  ├─ admin-auth.middleware.ts
│     │  │  ├─ locale.middleware.ts
│     │  │  ├─ validate.middleware.ts
│     │  │  └─ error.middleware.ts
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  ├─ customers/
│     │  │  ├─ catalog/
│     │  │  │  ├─ products/
│     │  │  │  ├─ categories/
│     │  │  │  └─ offers/
│     │  │  ├─ wishlist/
│     │  │  ├─ checkout/
│     │  │  ├─ orders/
│     │  │  ├─ uploads/
│     │  │  └─ admin/
│     │  │     ├─ products/
│     │  │     ├─ categories/
│     │  │     └─ offers/
│     │  ├─ repositories/
│     │  ├─ services/
│     │  │  ├─ slug.service.ts
│     │  │  ├─ image.service.ts
│     │  │  ├─ stock.service.ts
│     │  │  ├─ locale.service.ts
│     │  │  └─ price.service.ts
│     │  ├─ routes/
│     │  │  ├─ storefront.routes.ts
│     │  │  ├─ erp.routes.ts
│     │  │  └─ index.ts
│     │  └─ utils/
│     ├─ tests/
│     ├─ tsconfig.json
│     └─ package.json
│
├─ packages/
│  ├─ shared/
│  │  ├─ src/
│  │  │  ├─ dto/
│  │  │  ├─ schemas/
│  │  │  ├─ constants/
│  │  │  ├─ i18n/
│  │  │  ├─ types/
│  │  │  └─ utils/
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  └─ database/
│     ├─ drizzle/
│     │  ├─ schema.ts
│     │  ├─ relations.ts
│     │  └─ migrations/
│     ├─ drizzle.config.ts
│     ├─ src/
│     │  ├─ client.ts
│     │  ├─ db.ts
│     │  └─ seeds/
│     ├─ tsconfig.json
│     └─ package.json
│
├─ docs/
│  ├─ storefront-erp-spec.md
│  ├─ folder-structure.md
│  ├─ implementation-phases.md
│  └─ bugs.md
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

- `modules/orders/` is internal-only in v1.
- Do not expose public order-management routes in v1.
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
- Do not expose ERP order-management UI in v1.
- Do not move storefront or ERP to direct DB access.
- Do not reintroduce `cat.txt`; the initial category tree is documented in `docs/storefront-erp-spec.md`.


