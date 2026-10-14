# ERP smart pagination — plan (temporary, for review)

> Temporary working document. Delete it (and fold the rules into `apps/erp/DESIGN.md`) once the work ships.
> Nothing here is built yet. Review it; implementation starts at Phase 0 after your go-ahead.

## 1. Goal and decisions

Every ERP list page gets the same "smart pagination" bar, driven by one shared logic layer.

| # | Behaviour | Decision |
|---|---|---|
| 1 | Where am I | "صفحة 5 من 125" (right side of the bar) |
| 2 | السابق / التالي | disabled at the ends |
| 3 | Go to page | "صفحة [5/125]" input on the left; Enter/blur jumps; out-of-range is clamped |
| 4 | Page numbers | middle: `السابق 1 … 4 [5] 6 … 125 التالي` |
| 5 | تحميل المزيد | on top of the bar; **each click adds exactly one more page** of the current size; at most **100 rows** on screen (20 → up to 4 clicks, 50 → 1 click, 100 → hidden) |
| 6 | Rows per page | 20 (default) / 50 / 100, next to "where am I" |
| 7 | Memory | page, rows per page, load-more, search, filters and sort, per list (URL + browser session) |

Other decisions:
- Orders, shipping and reviews are paged **on the server**; their search, filters and sort move there too.
- Server sorting of status columns uses their **natural order**, not alphabetical Arabic.
- Shipping "needs attention" is **saved in the database** first (blocker, Phase S) so the server can filter on it.
- Sales "تفصيل الطلبات" is paged in the browser (its data is already downloaded for the sales numbers).
- Reconciliation lists get the bar too.
- Categories page (tree): no pagination.
- Discounts page pickers: left as they are (form control, not a list page).
- Order details reuses the shared shipping labels (cleanup from §9.4, included).

## 2. Bar layout (from your screenshot)

```
Desktop ≥ md — one card under the table
┌───────────────────────────────────────────────────────────────────────────────────┐
│                               [ تحميل المزيد ]                                       │
├───────────────────────────────────────────────────────────────────────────────────┤
│ صفحة 1 من 125  [20 ▾]       السابق  [1]  2  3  …  125  التالي        صفحة [1/125]   │
│   right: where am I              middle: page numbers              left: type to go  │
└───────────────────────────────────────────────────────────────────────────────────┘
After 2 load-mores: "الصفحات 1–3 من 125"; التالي goes to 4.

Phone < md
┌──────────────────────────────┐
│ [        تحميل المزيد       ] │
│ صفحة 1 من 125        [20 ▾]   │
│  السابق   [1] 2 … 125   التالي │
│           صفحة [1/125]        │
└──────────────────────────────┘
```
- Full width (DESIGN.md §4), tokens only, Latin digits (`num` + `formatNumber`), current page = filled chip as in the
  screenshot.
- `<nav aria-label="التنقل بين الصفحات">`, current page `aria-current="page"`, labelled page input and size select,
  busy state on تحميل المزيد, page change announced (`role="status"`).
- Hidden entirely when the list fits in one page at 20 rows. The count stays in the list header.
- Remote loading: table shows skeleton rows (existing pattern); the bar keeps its last values and disables controls.

## 3. Verified current state

| Page | Data source | Search / filters / sort today | Server paging today |
|---|---|---|---|
| products, offers, collections, advices | store loads the full list | browser | none |
| staff | page fetches the full list | browser | none |
| trash (products/categories/offers/collections tabs) | store, full list | browser | none |
| trash (reviews tab) | loops **all** review pages at 100 each | browser | — |
| reviews | server pages | `q`, `status`, `entityType` on server; no sort | `page`, `pageSize` (≤100) |
| orders | store loads **all orders** (`listOrdersRepo`, no limit) | browser: payment, from/to date, sort on 6 columns | none |
| shipping | 100-row cursor chunks + "load more" | browser, **only over loaded chunks** (bug) | cursor only |
| sales "تفصيل الطلبات" | `/api/erp/sales` (every recognised order) | browser sort | none |
| orders/reconciliation | two short queues | none | none |
| categories | store, tree | browser | none (stays unpaginated) |

Why the catalog lists stay in the browser: the full products / offers / collections / categories lists are also needed by
the editors' pickers, related items, discounts and the dashboard. Server paging would not remove that download, only add a
second request. They still get the same bar and memory.

`store.orders` is used by the orders page and the dashboard's payment numbers (`paymentSplit`) only. Dashboard sales
numbers come from `/api/erp/sales`.

Bosta (docs.bosta.co, read for this plan): delivery state changes reach us by webhook (it fires only on a state change)
and by our sync worker; we store them on `shipments.normalized_state` (`created → picked_up → in_transit → delivered /
returned / cancelled / exception`, mapped from Bosta codes 10…105). The shipping list is read from **our** database, not
from Bosta, so all paging/search work is ours.

## 4. Architecture

```
                         ┌─────────────────────────── shared (one of each) ───────────────────────────┐
 packages/shared         │ types: PageMeta, Paged<T>, PAGE_SIZES = [20, 50, 100], MAX_VISIBLE_ROWS = 100 │
 apps/api/src/lib        │ pagination.ts → zod query schema (page, pageSize, pages, q, sort, dir)        │
                         │                 + pageMeta(total, page, pageSize) + LIKE escaping              │
 apps/erp/src/lib        │ pagination.ts → PURE logic: page numbers with gaps, clamp, row range,         │
                         │                 load-more span, list state ⇄ URL (parse / serialize)           │
 apps/erp/src/lib        │ table-sort.ts → PURE sort (moved out of use-table-sort)                       │
 apps/erp/src/hooks      │ use-paginated-list.ts → THE hook: state + memory                              │
                         │     local mode : slices the rows it is given                                  │
                         │     remote mode: exposes the query; page fetches; hook gets the total back    │
 apps/erp/src/components │ admin/smart-pagination.tsx → THE bar                                          │
                         └───────────────────────────────────────────────────────────────────────────────┘

 Local page                                  Remote page
 full rows (store)                           GET /api/erp/<x>?page&pageSize&pages&q&<filters>&sort&dir
   → page's filter predicate                   ← { items, pagination }
   → sortRows(rows, accessors, sort)         table ← items
   → list.slice(rows) → table                <SmartPagination {...list.bar} />
 <SmartPagination {...list.bar} />
```

Rules:
- **One state owner.** Search, filters, sort, page, size and load-more live in `usePaginatedList`. Changing search /
  filter / sort / size resets to page 1 and clears load-more inside the hook (no per-page effects).
- **`useTableSort` split.** `compare`, the asc → desc → none cycle and `sortRows` move to `lib/table-sort.ts`;
  `useTableSort` stays as a thin wrapper for non-paginated tables (sales product/variant totals). Its tests stay green.
- **Memory precedence:** URL params → else the session copy for that list → else defaults. The URL is then rewritten with
  `router.replace` (no extra history entries).
- **URL keys** (same on every list): `page`, `size`, `more`, `q`, `sort`, `dir`, plus each filter's key (`status`,
  `category`, `payment`, `from`, `to`, `section`, …). Defaults are left out of the URL. Junk values fall back to defaults.
- **Session key:** `capella-erp-list:<listId>` in `sessionStorage`, every access in try/catch.
- **Search:** input updates instantly; URL and server request are debounced 300 ms.
- **Clamp:** if the page no longer exists (last row deleted, remembered page gone), go to the last page and fix the URL.
- **Reorder arrows** (products/offers/collections/advices) act on the full list; a row moved past a page edge moves to the
  neighbouring page.
- **Remote load-more:** one request with `pages=n` returns `n × pageSize` rows from `page`; the server rejects
  `pages × pageSize > 100`. A restored "pages 1–3" view is a single request.

## 5. API contract (server-paged lists)

```
GET /api/erp/<list>?page=1&pageSize=20&pages=1&q=…&sort=<key>&dir=asc|desc&<filters>
200 { items: T[], pagination: { page, pageSize, total, totalPages } }
400 { message } on any invalid param (unknown sort key, size not 20/50/100, pages×size > 100, bad date…)
```
- Shared zod builder; each endpoint adds its filters and **its own whitelist of sort keys** mapped to columns.
- Every sort ends with `id DESC` so pages never repeat or skip rows. `total` uses the same WHERE as `items`.
- Dates: the browser sends `from` / `to` as ISO instants for the start of the local "from" day and the end of the local
  "to" day, matching today's browser behaviour without the server guessing a timezone.
- Search: `LIKE %term%` on the same fields searched today, with `%`, `_` and `\` escaped.
- Natural order for status columns: MySQL sorts an `ENUM` column by its declared order, which is already the natural
  order (e.g. carrier `created → picked_up → in_transit → delivered → returned → cancelled → exception`; manual
  `preparing → ready_for_pickup → printed → delivered → returned`; size `small → medium → large`; kind
  `outgoing → return → exchange`). Empty values sort last. No Arabic labels on the server.

## 6. Phases and slices

Each slice is red → green → refactor. Each phase ends with targeted green (lint, typecheck, tests of the touched area).
Phase 7 runs the whole repo green (API + ERP + shared + database are all touched).

### Phase 0 — baseline (no code changes)
- 0.1 ERP: `tsc --noEmit`, lint, tests for every list page, dashboard, `use-table-sort`, `admin-list-header`.
- 0.2 API: tests for admin reviews, admin orders, shipping (overview, workers, actions, sync, cancellation), sales.
- 0.3 Report anything already red before starting.

### Phase 1 — shared pure logic (TDD) — `apps/erp/src/lib/pagination.ts`
- 1.1 `pageNumbers(current, totalPages)` → `[1, "gap", 4, 5, 6, "gap", 125]`; 1 page, 2 pages, near start/end; a gap
  never hides a single page (show the page instead).
- 1.2 `clampPage`, `totalPagesOf(total, size)`, `visibleRange(page, more, size, total)` → "صفحة 5 من 125" /
  "الصفحات 5–7 من 125".
- 1.3 Load-more: `canLoadMore` (stops at 100 visible rows or the last page), التالي after load-more = `page + more + 1`,
  السابق = `page − 1`; any page jump clears load-more.
- 1.4 `parseListState` / `serializeListState` with per-list schema (filters, sort keys); defaults omitted; junk ignored.
- 1.5 `lib/table-sort.ts` extracted; existing `use-table-sort` tests unchanged and green.
- 1.6 `packages/shared`: `PageMeta`, `Paged<T>`, `PAGE_SIZES`, `MAX_VISIBLE_ROWS`.

### Phase 2 — the hook (TDD) — `apps/erp/src/hooks/use-paginated-list.ts`
- 2.1 Initial state: URL → session → defaults; URL rewritten with `replace`.
- 2.2 Search / filter / sort / size changes reset page + load-more.
- 2.3 Debounced search for URL and remote query.
- 2.4 Local mode `slice(rows)`; clamps when rows shrink.
- 2.5 Remote mode: `query` out, `meta` in (clamps on total).
- 2.6 Session memory per `listId`; storage errors ignored.
- 2.7 Deep links keep working (`/orders?payment=pending` from the dashboard is now just a URL key).

### Phase 3 — the bar (TDD) — `apps/erp/src/components/admin/smart-pagination.tsx`
- 3.1 Where am I (+ load-more range text), page numbers with gaps, current page marked.
- 3.2 السابق/التالي disabled at ends; page click; typed page (Enter/blur, clamped, ignores non-digits).
- 3.3 Size select 20/50/100; تحميل المزيد on top with busy state, hidden at 100 rows / last page / size 100.
- 3.4 Hidden when everything fits; phone layout; RTL; a11y. Tests check behaviour and roles, not styling.

### Phase 4 — browser-paged pages (one slice each; each updates its existing page test)
4.1 products → 4.2 offers + collections (shared `use-bundles-list`) → 4.3 advices → 4.4 staff →
4.5 trash tabs (products / categories / offers / collections) → 4.6 sales "تفصيل الطلبات" → 4.7 reconciliation (both
lists) → 4.8 order details imports `features/shipping/lib/labels.ts` (§9.4).
Per page: state moves into `usePaginatedList`; table gets the sliced rows; header count = filtered total; reorder arrows
checked at page edges; test: page 2 shows rows 21–40, a filter resets to page 1, memory survives a remount.

### Phase S — shipping "needs attention" saved in the database (blocker for shipping paging)
Today "needs attention" is worked out on every request from work items + open review flags, so the database can't filter
or count it. Fix: save it, keep it updated in one place.
- S.1 Schema + migration: `shipments.needs_attention BOOLEAN NOT NULL DEFAULT false` (return/exchange rows and outgoing
  rows that have a shipment) and `orders.shipping_needs_attention BOOLEAN NOT NULL DEFAULT false` (the outgoing row,
  which exists before any shipment). Indexes for the list filter.
- S.2 One function `refreshShippingAttention(tx, orderId)` (TDD) that recomputes both flags for the order with the
  **existing** rules (`pickWorkItem`, `isExpectedStop`, open flags) — the rules move out of the overview repository into
  a shared module so the list and the saved value can never disagree.
- S.3 Call it inside every transaction that changes a work item, a review flag or a shipment row for an order:
  `shipping-dispatch-worker`, `shipping-dispatch.repository`, `shipping-sync-worker`, `shipping-sync.repository`,
  `shipping-cancellation-worker`, `shipping-cancellation.repository`, `shipping-edit.repository`,
  `shipping-action.repository`, `shipping-state.repository`, `order-review-flag.repository`, `orders/order/write.ts`
  (and any other writer found while doing it).
- S.4 Safety net test: shipping test suites assert after each scenario that the saved flags equal the computed ones for
  every order, so a future writer that forgets the call fails a test.
- S.5 Backfill: a one-off script computes the flags for existing orders; run once after the migration
  (`pnpm --filter @capella/database db:migrate`, then the script). Command given to you at that step.

### Phase 5 — server paging (API TDD first, then the ERP page)
- 5.1 API `lib/pagination.ts` (schema builder, `pageMeta`, LIKE escaping) + unit tests.
- 5.2 Reviews: controller moves to the shared schema (adds `pages`, sizes 20/50/100); route tests green. ERP reviews page
  → remote mode + bar + memory. Trash reviews tab → remote mode (drops the fetch-every-page loop).
- 5.3 Orders API: `page/pageSize/pages/q/payment/from/to/sort/dir`; payment filter in SQL mirrors
  `orderMatchesPaymentStatusFilter` exactly (Paymob → provider status, COD → staff status) with a parity test; sort keys
  `code, customer, email, total, payment, date`. Route tests: each filter, each sort, search fields, totals, stable
  order, invalid params → 400, permissions.
- 5.4 Orders ERP → remote mode; `orders` removed from the store's bulk load (`lib/store/core.ts`).
- 5.5 Dashboard payment numbers: small endpoint returning `{ accepted, pending, denied }` (all-time and since a date),
  same rule in SQL; dashboard switches to it. Tests on both sides.
- 5.6 Shipping API: cursor → page/pageSize/pages + `q/section/status/payment/from/to/sort/dir`, all in SQL over orders +
  shipments using the saved flags from Phase S; per-row details (work item, open flag types) still loaded only for the
  rows on the page. Route tests as in 5.3.
- 5.7 Shipping ERP → remote mode; bulk select (max 50) and refresh work on the visible rows.
- 5.8 Remove dead code: cursor parsing/loop, `fetchShippingOverview(cursor)`, the old reviews السابق/التالي.

Order of work: 0 → 1 → 2 → 3 → 4 → S → 5 → 6 → 7.

### Phase 6 — browser verification (Playwright)
Every touched page at 1920 / 1440 / 390, light + dark. States: loading, empty, one page (bar hidden), many pages,
load-more up to the 100-row limit, typed page out of range, back/forward, refresh, return via the sidebar, long names.

### Phase 7 — whole repo green + docs
Full lint / typecheck / build / tests for API, ERP, shared, database. Pagination rule added to `apps/erp/DESIGN.md` §6.
This temp file deleted.

## 7. Files

New: `packages/shared` types · `apps/api/src/lib/pagination.ts` · shipping attention module + migration + backfill
script · `apps/erp/src/lib/pagination.ts` · `apps/erp/src/lib/table-sort.ts` ·
`apps/erp/src/hooks/use-paginated-list.ts` · `apps/erp/src/components/admin/smart-pagination.tsx` · tests for each.

Changed (main): API reviews controller, orders controller + `order/read.ts`, shipping overview route + repository, every
shipping writer in S.3, new payment-counts route, admin routes · ERP `use-table-sort.ts`, `lib/store/core.ts`, every list
page in Phases 4–5 and their hooks (`use-products-page`, `use-bundles-list`, `use-trash-page`), dashboard page + metrics ·
`packages/database` schema · `apps/erp/DESIGN.md`.

## 8. Out of scope
- Categories page (tree).
- Discounts page pickers.
- Moving sales analytics (dashboard pulse / best sellers / stock alerts) to the server — `/api/erp/sales` still returns
  every recognised order. Separate task if wanted.
- Infinite scroll — "تحميل المزيد" is an explicit button.

## 9. Problems noticed while planning
1. **Shipping search/filters miss unloaded rows (bug).** Fixed by Phases S + 5.6.
2. **All orders downloaded on every ERP load.** Fixed by 5.3–5.4.
3. **Sales endpoint returns every recognised order with items.** Not fixed here (§8).
4. **Duplicated shipping labels.** `features/orders/components/order-details-view.tsx:27-28` re-declares the carrier and
   custody Arabic labels instead of importing `features/shipping/lib/labels.ts`; they can drift apart. Included (slice 4.8).

## 10. Still open
Nothing. Waiting for your review and go-ahead.
