# Repository Guidelines

## Purpose
This file is the working guide for contributors and agents in this repo. It should be updated whenever new repo behavior, user preferences, debugging pathways, or reliable commands are discovered.

## Core Rules
1. Read existing tests before creating any new test file. Match the nearest existing style, helpers, and file placement.
2. For any medium or hard task, investigate first and identify the exact touching files and execution path before editing.
3. Prefer tracing the full path: UI/page -> store/client -> API route/controller -> repository/service -> DB schema.
5. Do not assume API response shape, delete behavior, or data flow. Inspect the actual controller, repository, store, and consuming UI path first.
6. Before calling work complete, run the most targeted verification available and state clearly what was verified and what was not.

## Investigation Commands
Use these before changing code:
- `rg -n "keyword" .` to trace usage quickly
- `rg --files .` to list files
- `Get-Content <path>` to read files
- `Get-ChildItem -Recurse -File <path> | Select-String -Pattern "text"` for targeted search
- `git log -6 --pretty=format:%s` to inspect commit style

Use these to verify work:
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm --filter @capella/api test -- tests/routes/<file>.test.ts`
- `pnpm --filter @capella/erp test -- tests/<file>.test.ts`
- `pnpm --filter @capella/storefront test -- tests/<file>.test.tsx`
- `pnpm test:staging-smoke`

## Folder Structure Outline
Use the canonical structure reference in [docs/folder-structure.md](D:/Documents/current_work/Capella/CapellaStore/capellacares.js.com/docs/folder-structure.md).

## Project Pathways
- Storefront and ERP must consume the API, not the DB directly.
- DB-backed work usually touches:
  `apps/erp` or `apps/storefront` -> `apps/*/src/lib/...` -> `apps/api/src/routes|modules|repositories` -> `packages/database/drizzle/schema.ts`
- Shared contract or response-shape work often also touches `packages/shared`.

## Preferred Debugging Order
1. Reproduce or restate the exact symptom.
2. Inspect the page, component, store, or API client that surfaces the issue.
3. Inspect the API route and controller used by that path.
4. Inspect the repository or service layer that shapes or mutates data.
5. Inspect the DB schema, migrations, and soft-delete/status rules if persistence is involved.
6. Read the nearest existing tests before creating new ones.
7. Identify the exact touching files and change pathway.
8. Apply the smallest fix that matches the full flow.
9. Verify with the most targeted tests available and state what was verified.

## Testing Rules
- API uses Node test runner.
- ERP and storefront use Vitest.
- E2E uses Playwright.
- Add regression tests for bugs in response shape, soft-delete behavior, create/edit flows, and visibility/filtering rules.
