# Capella Store

Capella is a pnpm + Turborepo monorepo for a bilingual e-commerce storefront, an Arabic-only ERP/admin app, and a shared Express API backed by MySQL.

Storefront and ERP talk to the API over HTTP only. Database schema, migrations, and seeds live in `packages/database`.

## Monorepo Layout

| Path | Package | Role |
| --- | --- | --- |
| `apps/storefront` | `@capella/storefront` | Customer-facing Next.js app (Arabic + English) on port `3000` |
| `apps/erp` | `@capella/erp` | Arabic-only admin ERP on port `3001` |
| `apps/api` | `@capella/api` | Express API on port `4000` |
| `packages/shared` | `@capella/shared` | Shared DTOs, Zod schemas, constants, i18n, UI primitives |
| `packages/database` | `@capella/database` | Drizzle schema, migrations, seeds, DB client |

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, Radix/shadcn-style UI
- **Backend:** Express 4, Zod validation, JWT + cookie auth
- **Database:** MySQL 8, Drizzle ORM
- **Tooling:** pnpm 11, Turborepo, TypeScript 5
- **Testing:** Node test runner (API + database), Vitest (storefront + ERP), Playwright (staging smoke)

## What Is Implemented

### Storefront (`/api/v1/*`)

- Bilingual routing under `/[lang]` (`ar`, `en`)
- Catalog browsing: products, categories, offers, shop
- Product detail with variants, media, and related items
- Cart, checkout (Cash on Delivery), orders, wishlist
- Customer signup/login
- SEO helpers (`robots.ts`, `sitemap.ts`) and on-demand revalidation

### ERP (`/api/erp/*`)

- Admin login with DB-backed bootstrap user
- Dashboard, catalog CRUD, soft delete + trash restore
- Products (variants, stock, media, related items), categories, offers, advices
- Order list/detail (read-only in v1)
- Sales summary
- Media uploads (Hostinger SFTP integration)

### Shared Data Model

Categories, products, variants, media, offers, offer items, related items, advices, customers, admin users, auth sessions, wishlists, orders, and order items.

## Architecture Rules

- Storefront and ERP must not access MySQL directly.
- Public storefront routes and ERP/admin routes stay separated at the API layer.
- Shared contracts belong in `packages/shared`; persistence belongs in `packages/database`.
- Checkout is Cash on Delivery only. Online payment (PayMob, etc.) is out of scope until a separate payment plan exists.

## Requirements

- Node.js compatible with Next.js 15 / TypeScript 5
- pnpm `11.1.2` (see root `packageManager` field)
- MySQL 8 database

## Setup

```powershell
pnpm install
Copy-Item .env.example .env
```

Edit `.env` with local MySQL credentials, JWT secrets, admin bootstrap values, and `NEXT_PUBLIC_API_URL`.

### Database (local non-Docker)

With MySQL running locally and `DATABASE_URL` set in `.env`:

```powershell
pnpm --filter @capella/database exec drizzle-kit push --config=drizzle.config.ts
pnpm --filter @capella/database db:seed
```

For disposable local Docker databases or production, use `db:migrate` instead of `push`. See [docs/deploy.md](docs/deploy.md) for the full migration policy.

## Development

Run all apps through Turbo:

```powershell
pnpm dev
```

Run individual apps:

```powershell
pnpm --filter @capella/api dev
pnpm --filter @capella/storefront dev
pnpm --filter @capella/erp dev
```

Default local URLs:

| Service | URL |
| --- | --- |
| Storefront | http://localhost:3000 |
| ERP | http://localhost:3001 |
| API | http://localhost:4000 |
| API health | http://localhost:4000/health |

API route groups:

- Storefront: `/api/v1/*`
- ERP/admin: `/api/erp/*`

## Build, Lint, and Test

```powershell
pnpm build
pnpm lint
pnpm test
```

Targeted test runs:

```powershell
pnpm --filter @capella/api test -- tests/routes/admin-products.routes.test.ts
pnpm --filter @capella/storefront test -- tests/unit/cart.test.ts
pnpm --filter @capella/erp test
pnpm test:staging-smoke
```

API and database tests use `.env.test` at the repo root. Keep a dedicated test database (`capella_test`) separate from local dev data.

## Docker

Production-style local or VPS deployment uses `docker-compose.yml` with four services: `mysql`, `api`, `storefront`, and `erp`.

```powershell
docker compose --env-file .env.docker up -d
```

Full deploy, migration, seed, and troubleshooting flows are documented in [docs/deploy.md](docs/deploy.md).

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/specs/storefront-erp-spec.md](docs/specs/storefront-erp-spec.md) | Product and architecture source of truth |
| [docs/specs/folder-structure.md](docs/specs/folder-structure.md) | Canonical folder and boundary rules |
| [docs/plans/testing/](docs/plans/testing/) | Testing strategy and layout |
| [docs/deploy.md](docs/deploy.md) | Docker deploy, migrations, and env setup |
| [AGENTS.md](AGENTS.md) | Contributor/agent workflow and verification commands |

## Contributing Notes

- Trace changes end-to-end: UI/page → client/store → API route → service/repository → schema.
- Read nearby tests before adding new ones; match existing helpers and placement.
- Add regression tests for response-shape bugs, soft-delete behavior, and visibility rules.
