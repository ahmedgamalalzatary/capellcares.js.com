# Phase 04 - Feature 4: Related Items (Products, Offers, Collections-later)

> **Status: SHIPPED (archived 2026-05-30).** Implemented in commits `5dcc5f5`
> (feat: cross-entity related items for products and offers) and `dd81ce1`
> (fix: preserve offer items and harden related editing). The `related_items`
> table exists in `packages/database/drizzle/schema.ts` with the
> `related_items_link_unique` constraint. This document is retained as the
> historical design record; `collection` as a related type remains future scope.

## Goal

Let admins curate "related items" for a product, and show them on the storefront
product detail page. Relationships are **bidirectional** (link once, both sides are
connected automatically) but **ranking is per-source** (each side orders its own
related list independently).

This supersedes the original "one-way, products-only, single shared sort" idea.

## Key Design Decisions (locked)

- **Polymorphic target.** A related item can be a `product`, an `offer`, and later a
  `collection`. The schema is polymorphic from day one so adding `collection` later
  needs no schema change.
- **Bidirectional, auto-mirrored.** When an admin links A with B, the system ensures
  both directions exist automatically. Unlinking removes both directions.
- **Per-source ranking (manual).** Each direction carries its own `rank`, so
  `A -> B` can be rank 2 while `B -> A` is rank 3. This requires **two mirrored rows**
  per link (NOT one shared row), because a single shared rank would be ambiguous.
- **v1 scope: products + offers, fully symmetric.** Any product or offer can relate to
  any product or offer ΓÇö product<->product, product<->offer, AND offer<->offer.
  `collection` is a reserved future type, not built yet.
- **One combined ranked list.** Related products and offers interleave in a single list
  ordered purely by the page's `rank` (no separate per-type sections).
- **Show all linked.** No cap on how many related items render on the storefront.
- **New links default to the end** of the source's list; admin reorders afterward.
- **Link active items only.** The ERP selector offers only active, non-deleted items.
- **Read-time filtering.** The storefront hides targets that are inactive, deleted,
  out-of-stock (products), or expired/scheduled (offers). Rows are kept; they just
  don't render.
- **Ranks may have gaps.** When a target is removed or hidden, remaining ranks are NOT
  re-packed; the display simply skips missing items (order stays correct).
- **Ordering is manual** (admin-controlled per page). No sales/popularity auto-ranking
  in this phase.

## Backend / DB

- Add `related_items` table (polymorphic, directional):
  - `id`
  - `source_type` enum (`product` | `offer` | `collection`)
  - `source_id`
  - `target_type` enum (`product` | `offer` | `collection`)
  - `target_id`
  - `rank` int (order of this target within the source's related list)
  - `created_at` timestamp
  - Unique constraint on (`source_type`, `source_id`, `target_type`, `target_id`).
- **Mirroring rule:** linking A and B inserts two rows ΓÇö `A -> B` and `B -> A`. Each
  row gets its own `rank` (appended to the end of that source's list by default).
  Removing a link deletes both rows.
- **Self-reference is forbidden:** a row where source == target is rejected.
- Product upsert saves the product's chosen related links and, for each, ensures the
  mirror row on the target side exists.
- ERP product/offer detail data includes that entity's ordered related links for editing.
- Storefront product detail returns related targets ordered by this product's `rank`,
  filtered at read time to: active, non-deleted, in-stock products and active,
  non-deleted, non-expired/non-scheduled offers. Rows for filtered-out targets are kept;
  they just don't render, and remaining ranks keep their gaps (no re-pack).
- Storefront offer detail likewise returns its related targets (since relations are
  bidirectional and offers are in scope for v1), with the same filtering rules.
- List endpoints do not need full related payloads.

## ERP UI

- Add a "Related items" section to product create/edit (and offer create/edit, since
  offers are in v1 scope and relations are mutual).
- The section is full CRUD over this entity's related list:
  - **Add:** selector of active, non-deleted products/offers (collections later);
    excludes the current entity. Adding appends to the end of this entity's list and
    auto-creates BOTH mirror rows (`A->B` and `B->A`), each appended to its own side.
  - **Read:** lists this entity's related items in its own rank order, with each item's
    type indicated (product / offer).
  - **Reorder (update):** drag-to-reorder updates `rank` on THIS side only; the other
    entity's list order is untouched (per-source ranking).
  - **Remove (delete):** removing an item unlinks BOTH mirror rows, so it disappears from
    both entities.

## Storefront

- Show related items only inside `/products/[slug]` (and `/offers/[slug]`) detail pages.
- Render all linked, active, non-deleted targets as one combined list (products and
  offers interleaved), ordered by the current page's `rank`.
- Do not add related items to product grids, homepage, category pages, or unrelated pages.
- Reuse existing product/offer card patterns where practical.

## Tests

- API:
  - Linking A and B creates both `A -> B` and `B -> A` rows.
  - Unlinking removes both directions.
  - Per-source rank is independent (`A -> B` rank differs from `B -> A` rank).
  - Self-reference is rejected.
  - Product upsert saves related links.
  - Storefront detail filters out inactive/deleted/out-of-stock/expired targets, ordered by rank.
  - Removed/hidden targets leave rank gaps (no re-pack); order remains correct.
  - ERP selector only offers active, non-deleted items.
  - Cross-type relations work both ways (product<->offer).
  - Offer<->offer relations work both ways.
  - New links append to the end of the source's list (default rank).
- ERP:
  - Product/offer form renders the related-items selector.
  - Current entity is excluded from its own options.
  - Reordering one side does not change the other side's order.
- Storefront:
  - Product/offer detail renders related items in the page's own rank order.
  - Inactive/deleted related targets do not render.

## Verification

- `pnpm --filter @capella/api test -- tests/routes/admin-products.routes.test.ts`
- `pnpm --filter @capella/api test -- tests/contracts/storefront-contracts.test.ts`
- `pnpm --filter @capella/erp test -- tests/products-page.test.tsx`
- `pnpm --filter @capella/storefront test -- tests/unit/storefront-detail-page.test.tsx`

## Acceptance Criteria

- Admin can select related items (products and offers) while adding/editing an entity.
- Linking once connects both sides automatically (bidirectional).
- Each side can be ordered independently (per-source manual rank).
- Storefront product/offer detail shows the related items in that page's own order.
- Inactive/deleted targets are hidden on the storefront.
- Schema is polymorphic so `collection` can be added later without migration churn.

## Out of Scope (future)

- `collection` as a related type (reserved in the enum, not built).
- Sales/popularity-based auto-ranking.
- Caps/pagination on the related list.
