# Capella Store

Capella is a bilingual (Arabic/English) e-commerce platform built as a pnpm + Turborepo monorepo: a customer storefront, an Arabic-only ERP/admin app, a mobile client, and a shared Express API on MySQL.

Storefront, ERP, and mobile talk to the API over HTTP only. Database schema, migrations, and seeds live in `packages/database`. Shared contracts live in `packages/shared`.

The product and architecture source of truth is [docs/storefront-erp-spec.md](docs/storefront-erp-spec.md).

## Monorepo Layout

| Path | Package | Role |
| --- | --- | --- |
| `apps/storefront` | `@capella/storefront` | Customer-facing Next.js app, Arabic + English, port `3000` |
| `apps/erp` | `@capella/erp` | Arabic-only admin ERP, port `3001` |
| `apps/api` | `@capella/api` | Express API for storefront, ERP, and mobile, port `4000` |
| `apps/mobile` | `@capella/mobile` | Expo/React Native client reusing the storefront contracts |
| `packages/shared` | `@capella/shared` | Shared DTOs, Zod schemas, constants, i18n dictionaries, shared UI primitives, shared HTTP base client |
| `packages/database` | `@capella/database` | Drizzle schema, migrations, seeds, DB client |

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix/shadcn-style UI
- **Mobile:** Expo 57, React Native, Expo Router
- **Backend:** Express 4, Zod validation, JWT access tokens + rotating refresh sessions
- **Database:** MySQL 8, Drizzle ORM
- **Payments:** Paymob hosted card/wallet checkout with HMAC-verified callbacks
- **Shipping:** Bosta carrier integration (quotes, dispatch, sync, cancellation, edits)
- **Tooling:** pnpm 12, Turborepo, TypeScript 5, ESLint
- **Testing:** Node test runner (API + database), Vitest (storefront + ERP), Jest (mobile), Playwright (mobile e2e)

## What Is Implemented

### Storefront (`/api/v1/*`)

- Bilingual routing under `/[lang]` (`ar`, `en`), with `/` redirecting to the default locale
- Shop home, product listing with category/price filtering, sorting and search, category pages, `new` and `bestsellers` pages
- Product detail with variants, price range, hover images, media gallery, offer badges, related items, ratings and reviews
- Offers and collections browsing and detail pages
- Cart (local storage for everyone, plus server sync for signed-in customers)
- Checkout: Cash on Delivery and Paymob, shipping quote + address selection, checkout status polling and retry
- Customer orders: list, detail, shipping progress, and eligible cancellation
- Wishlist (products, offers, collections), reviews and review prompts, announcement bar, advice content, shop media sections
- Customer signup/login with rotating refresh sessions
- SEO helpers (`robots.ts`, `sitemap.ts`) and on-demand ISR revalidation

### ERP (`/api/erp/*`)

- Admin login with DB-provisioned bootstrap user and rotating sessions
- Dashboard, catalog CRUD, reordering, soft delete + trash restore + permanent delete
- Products (variants, stock, per-variant discounts, media, hover images, related items), categories, collections, offers
- Order list/detail, review flags, Paymob reconciliation and callback requeue
- Shipping overview with guarded individual and bulk actions
- Sales summary, reviews moderation, bulk discounts, advices, announcements, shop media
- Staff management with per-permission access enforced at the API layer
- Permission-gated media uploads stored by the API and served as public URLs

### Shared Data Model

Categories (with closure table), products, variants, variant discounts, entity media, offers, offer items, collections, collection items, bundle discounts, related items, advices, shop media sections and items, announcements, customers, admin users with roles and permissions, auth sessions, wishlists, carts, orders, order items, checkout sessions and reservations, payment attempts, Paymob callback inbox and reconciliation state, shipments and shipping work items, shipping rates, order review flags, order state history, and reviews.

## Architecture Rules

- Storefront and ERP must not access MySQL directly; all access goes through the API.
- Public storefront routes (`/api/v1`) and ERP/admin routes (`/api/erp`) stay separated.
- Shared contracts belong in `packages/shared`; persistence belongs in `packages/database`.
- Prices are derived server-side; frontend-submitted prices are ignored. Shipping charges are quoted and then snapshotted immutably on the order.
- Paymob payment status is provider-managed and driven by verified callbacks; ERP may only deny a Paymob order, which requires a provider refund first.
- Carrier shipping gates default to disabled until the merchant account is verified.
- Staff and permission changes must always go through API-side permission enforcement.

## Requirements

- Node.js 24 (the Docker runtime), compatible with package engines
- pnpm `11.5.2` (see the root `packageManager` field)
- MySQL 8

## Setup

```powershell
pnpm install
Copy-Item .env.example .env
```

Edit `.env` with local MySQL credentials, JWT secrets, admin bootstrap values, `NEXT_PUBLIC_API_URL`, and the CORS allowlist. In production the API refuses to boot without production JWT secrets, a revalidation secret, and `CORS_ALLOWED_ORIGINS`.

### Database

With MySQL running locally and `DATABASE_URL` set in `.env`:

```powershell
pnpm --filter @capella/database db:migrate
pnpm --filter @capella/database db:seed
```

Use migrations for local and deployed databases. See [docs/docker.md](docs/docker.md) for the full migration policy.

## Development

```powershell
pnpm dev            # all apps via Turbo
pnpm dev:web        # storefront + ERP + API
pnpm dev:mobile     # mobile + API
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
| API app config | http://localhost:4000/app-config |

API route groups:

- Storefront: `/api/v1/*`
- ERP/admin: `/api/erp/*`

## Build, Lint, Typecheck, and Test

```powershell
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Scoped variants:

| Command | Scope |
| --- | --- |
| `pnpm build:web` / `build:mobile` | Web stack / mobile + API |
| `pnpm lint:web` / `lint:mobile` | Web stack / mobile + API |
| `pnpm typecheck:web` / `typecheck:mobile` | Web stack / mobile + API |
| `pnpm test:web` / `test:mobile` / `test:apps` | Web stack / mobile + API / all frontends and shared |
| `pnpm test:db` | Database + API (sequential) |
| `pnpm test:coverage` | Coverage across apps (sequential) |

Targeted test runs:

```powershell
pnpm --filter @capella/api test -- tests/routes/admin-products.routes.test.ts
pnpm --filter @capella/storefront test -- tests/unit/cart.test.ts
pnpm --filter @capella/erp test
```

API and database tests read `.env.test` at the repo root. Keep a dedicated test database (`capella_test`) separate from local dev data. API tests touch MySQL; frontend and mobile tests do not.

## Docker

Production-style local or VPS deployment uses `docker-compose.yml` with MySQL, the API, storefront and ERP, plus a one-shot migration service that must succeed before the API starts.

```powershell
docker compose --env-file .env.docker up -d
```

Full deploy, migration, seed, and troubleshooting flows are documented in [docs/docker.md](docs/docker.md).

## Payments and Shipping Configuration

Paymob and Bosta are server-only. Keep credentials out of any `NEXT_PUBLIC_*` variable, use test-mode keys while developing, and leave the Bosta activation gates off until the merchant account contracts are verified.

Check carrier configuration consistency without provider requests or database queries:

```powershell
pnpm --filter @capella/api shipping:check
```

A successful check confirms configuration only; it does not prove merchant account behavior or authorize live activation.

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/storefront-erp-spec.md](docs/storefront-erp-spec.md) | Product, architecture, and folder-boundary source of truth |
| [docs/mobile-app-plan.md](docs/mobile-app-plan.md) | Mobile app phases, policy, and plan |
| [docs/docker.md](docs/docker.md) | Docker deploy, migrations, and env setup |
| [AGENTS.md](AGENTS.md) | Contributor/agent workflow and verification commands |

## Contributing Notes

- Trace changes end-to-end: UI/page → client/store → API route → service/repository → schema.
- Read nearby tests before adding new ones; match existing helpers and placement.
- Add regression tests for response-shape bugs, soft-delete behavior, and visibility rules.
- Never create a commit unless it is explicitly requested.