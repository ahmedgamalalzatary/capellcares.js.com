# Capella Store

Capella is a monorepo for a bilingual storefront, Arabic-only ERP, and shared Express/MySQL backend.

## Apps

- `apps/storefront`: customer-facing Next.js app on port `3000`.
- `apps/erp`: Arabic-only ERP/admin Next.js app on port `3001`.
- `apps/api`: Express API on port `4000`.
- `packages/shared`: shared DTOs, schemas, constants, i18n, and safe types.
- `packages/database`: Drizzle schema, migrations, seeds, and DB client.

## Requirements

- Node.js compatible with the installed Next.js/TypeScript toolchain.
- `pnpm` `10.12.1`.
- MySQL database.

## Setup

```powershell
pnpm install
Copy-Item .env.example .env
```

Edit `.env` with local database credentials and secrets.

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

- Storefront: `http://localhost:3000`
- ERP: `http://localhost:3001`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## Build And Test

```powershell
pnpm build
pnpm test
```

Some packages currently have placeholder test scripts. As runtime phases are implemented, tests must be added under `/tests` folders and written test-first.

## Documentation

- Product/system spec: `docs/storefront-erp-spec.md`
- Folder/boundary rules: `docs/folder-structure.md`
- Implementation phases: `docs/implementation-phases.md`
- Current bug audit: `docs/bugs.md`

## Current Scope

- Checkout is Cash on Delivery only.
- PayMob/online payment is out of scope until a separate payment plan exists.
- Storefront and ERP must use the API, not direct DB access.
- MySQL/Drizzle is the target runtime source of truth.
