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

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Radix/shadcn-style UI
- **Backend:** Express 4, Zod validation, JWT + cookie auth
- **Database:** MySQL 8, Drizzle ORM
- **Tooling:** pnpm 11, Turborepo, TypeScript 5
- **Testing:** Node test runner (API + database), Vitest (storefront + ERP), Playwright (staging smoke)

## What Is Implemented

### Storefront (`/api/v1/*`)

- Bilingual routing under `/[lang]` (`ar`, `en`)
- Catalog browsing: products, categories, collections, offers, shop
- Shop mega-menu, Ask-Capella search overlay, and announcement bar
- Product detail with variants, media, and related items
- Cart, checkout (COD and verified Paymob card/wallet payments), orders, wishlist
- Bilingual customer shipping progress and eligible pre-print/pre-pickup cancellation
- Customer signup/login
- SEO helpers (`robots.ts`, `sitemap.ts`) and on-demand revalidation

### ERP (`/api/erp/*`)

- Admin login with DB-backed bootstrap user
- Dashboard, catalog CRUD, soft delete + trash restore
- Products (variants, stock, media, related items), categories, collections, offers, advices
- Staff management with role-based permissions (enforced at the API layer)
- Order list/detail, independent payment/refund and shipping states
- Shipping overview, guarded individual/bulk actions and read-only linked return/exchange status
- Sales summary
- Media uploads (Hostinger SFTP integration), permission-gated

### Shared Data Model

Categories, products, variants, media, offers, offer items, related items, collections, advices, customers, admin users (with roles/permissions), auth sessions, wishlists, orders, and order items.

## Architecture Rules

- Storefront and ERP must not access MySQL directly.
- Public storefront routes and ERP/admin routes stay separated at the API layer.
- Shared contracts belong in `packages/shared`; persistence belongs in `packages/database`.
- COD and Paymob use server-derived products plus immutable shipping charges; Paymob orders are created only after a verified callback.
- Bosta shipping stays disabled until merchant contracts are verified. Pickup, return/exchange operations and refund initiation remain in the provider dashboards.

## Requirements

- Node.js 24 (the Docker runtime), compatible with the package engines
- pnpm `11.5.2` (see root `packageManager` field)
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
pnpm --filter @capella/database db:migrate
pnpm --filter @capella/database db:seed
```

Use migrations for local and deployed databases. See [docs/docker.md](docs/docker.md) for the full migration policy.

## Development

Run all apps through Turbo:

```powershell
pnpm dev
```

Web (storefront + ERP). `dev:web` also starts the API so both fronts can talk to it:

```powershell
pnpm dev:web
pnpm build:web
pnpm build:web-stack
```

| Command | What it runs |
| --- | --- |
| `pnpm build:web` | Storefront + ERP |
| `pnpm build:web-stack` | Storefront + ERP + API |
| `pnpm dev:web` / `pnpm dev:web-stack` | Storefront + ERP + API |

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
```

API and database tests use `.env.test` at the repo root. Keep a dedicated test database (`capella_test`) separate from local dev data.

## Docker

Production-style local or VPS deployment uses `docker-compose.yml` with MySQL, the API, storefront and ERP, plus a one-shot migration service that must succeed before the API starts.

```powershell
docker compose --env-file .env.docker up -d
```

Full deploy, migration, seed, and troubleshooting flows are documented in [docs/docker.md](docs/docker.md).

## Shipping Release

The API receives all `BOSTA_*` settings from the Compose environment file. Keep keys and verified account contracts server-only; all activation gates default to false. The dispatch, synchronization, cancellation and checkout-expiry workers start inside the API process.

Validate configured capabilities without provider requests or database queries:

```powershell
pnpm --filter @capella/api shipping:check
```

A successful check confirms configuration consistency, including disabled mode; it does not prove merchant account behavior or authorize live activation. See [the shipping release guide](docs/bosta-shipping-release.md) for migrations, webhook setup, activation, disable/recovery and the release regression commands. Account evidence and progress remain in [the integration plan](docs/bosta-shipping-integration.md).

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/storefront-erp-spec.md](docs/storefront-erp-spec.md) | Product and architecture source of truth |
| [docs/folder-structure.md](docs/folder-structure.md) | Canonical folder and boundary rules |
| [docs/docker.md](docs/docker.md) | Docker deploy, migrations, and env setup |
| [docs/bosta-shipping-release.md](docs/bosta-shipping-release.md) | Shipping deployment and recovery |
| [AGENTS.md](AGENTS.md) | Contributor/agent workflow and verification commands |

## Contributing Notes

- Trace changes end-to-end: UI/page → client/store → API route → service/repository → schema.
- Read nearby tests before adding new ones; match existing helpers and placement.
- Add regression tests for response-shape bugs, soft-delete behavior, and visibility rules.
