# Capella ERP — design system ("Tester Tray")

The ERP's visual language, the binding rules the user has already given, and how to work on it. Read this
first in every new session so the user never has to repeat themselves; keep it updated when a rule changes.
Every page in `apps/erp` is built from this base; new pages reuse it rather than invent their own.

Related files (read them too):
- `AGENTS.md` (repo root) — working rules (no commits / no sub-agents without permission, ask when unsure, be concise, no polling).
- `apps/erp/PRODUCT.md` — who uses the ERP and why (non-technical staff, Arabic-only RTL, phone + tablet + desktop).
- `apps/erp/.impeccable/surfaces/src-app.md` — design direction contract ("Tester Tray").

## 1. The world

A warm, parchment-toned admin: a white "well" (card) floating on a canvas, with a dark ink rail down the
side, nude-tan accents borrowed from the logo, and one warm neutral ramp doing all the greys. Everything is
full width beside the rail, RTL, Arabic-only, Arabic feminine address ("ابحثي"). Light is the default theme
until the viewer picks one; the rail stays dark in both themes.

## 2. Tokens

All tokens are defined in `src/app/globals.css` (`:root` + `[data-theme="dark"]`). Use tokens only — **never
raw colours** (no hex/oklch outside the token file; no `text-white` except on the rail).

- **Sand ramp** `--sand-0 … --sand-950`: the only neutral source. Inverts under `[data-theme=dark]`.
- **Semantic roles**: `--canvas`, `--surface`, `--sunken`, `--hover`, `--line`, `--line-control`,
  `--line-strong`, `--text`, `--text-strong`, `--text-2`, `--text-muted`, `--icon-faint`, `--focus`, `--overlay`.
- **Brand**: `--nude`, `--nude-strong`, `--nude-soft` (accent washes).
- **State**: `--success/-soft`, `--warning/-soft`, `--danger/-soft`, `--info/-soft`.
- **Rail** (dark in both themes): `--rail`, `--rail-hover`, `--rail-active`, `--rail-text`, `--rail-strong`,
  `--rail-muted`, `--rail-line`, `--rail-accent`.
- **Shape/depth**: `--radius-control` (10), `--radius-well` (14), `--radius-thumb` (10); `--shadow-well`
  (one ring + 1px contact shadow), `--shadow-float` (popovers/menus), `--shadow-inset`.
- **Motion**: `--ease-out`, `--dur-fast`, `--dur`.

Exposed to Tailwind via `@theme inline` as `bg-surface`, `text-text-muted`, `shadow-well`, `rounded-well`, etc.
The base layer also sets selection, focus, scrollbars, `option { Canvas/CanvasText }` and removes number spinners.

## 3. Typography, numbers & copy

- UI font: `--font-sans` (Tajawal). Digits: `--font-num` (Roboto) — apply the `num` class on **digits only**
  (Roboto has no Arabic glyphs).
- **Latin tabular digits everywhere** via `lib/format.ts`: `formatNumber`, `formatMoney`, `formatMoneyRange`.
  Never `formatPrice(..., "ar")`. Dates use the `ar-EG-u-nu-latn` locale so they keep Latin digits.
- Copy is Arabic-only, feminine address. No English labels ("Percentage", "Name (English)" → Arabic).
- No numbered section labels (01/02…), no eyebrow/kicker text above headings.
- Number inputs have no spin arrows (global rule); units via `InputWithAddon` ("ج.م", "%").
- Switches sit right next to their label (`SwitchField`).

## 4. Layout & width (binding)

- **Every page is full width**: 90% of the area beside the rail (`AdminShell` main uses `lg:px-[5%]`). **Never cap or
  shrink page/editor width** (no `max-w-*` on pages, no centered narrow editors). The user rejected this many times.
  When fields look too wide, fix it with structure (aligned two-column grids), not by narrowing the page.
- Fields line up **vertically and horizontally**: inside form cards use one two-column grid
  `grid gap-x-4 gap-y-5 @lg:grid-cols-2` (container queries, `@container` on the card body). Reference the user liked:
  the product "الوصف والمحتوى" block — bilingual pairs (AR | EN) side by side, rows aligned. Prefer single-line inputs so
  paired cells have equal height.
- No half-empty rows next to a short element; if two sections share a row, each takes half and fills it (e.g. related
  items | status). Lists inside a half-width section are one column.
- `AdminShell` has no `width` prop — every page is full width.

## 5. Components

`src/components/ui/`: `button` (primary/secondary/ghost/danger/danger-ghost; sm/md/lg/icon/icon-sm; `asChild`) ·
`input` (`Input`, `Textarea`, native `Select`, `InputWithIcon`, `InputWithAddon`, `controlClass`) · `field` (label + hint +
error) · `switch` (`Switch`, `SwitchField`) · `alert` · `badge` (`Badge`, `Swatch`) · `card` (`Card`, `CardHeader`,
`CardBody`, `CardFooter`) · `table` (`Table`, `THead`, `TBody`, `TR`, `TH`, `SortableTH`, `TD`) · `thumb` (the tray's
signature, with first-letter fallback) · `empty-state` · `skeleton` (`Skeleton`, `FormSkeleton`) · `row-menu` · `modal`
(Radix Dialog; bottom sheet on phones) · `file-button`. Icons: lucide-react only.

`src/components/admin/`: `admin-list-header` (+ `tableSortSelect`, `ACTIVE_STATUS_FILTER_OPTIONS`), `list-table`,
`permission-gate` (+ `ForbiddenPage`), `status-badge`, `reorder-buttons`, `stepper`, `editor-layout`,
`form-save-bar`, `admin-confirm-modal`, `erp-forbidden-state`, `shipping-actions`.

`src/components/shell/`: `admin-shell.tsx` (rail + mobile drawer + page header: breadcrumb, title, description,
actions), `theme-menu.tsx`.

Shared form parts (`src/components/forms/`, used by product/offer/collection/category/advice forms):
`editor-form-parts.tsx` (`BilingualNameFields`, `BilingualEditorField`), `lang-tag.tsx` (the ع/EN chip),
`status-choice.tsx`, `category-picker.tsx`, `media-frame.tsx`, `image-actions.tsx`, `entity-media-upload.tsx`,
`hover-image-upload.tsx`, `single-image-field.tsx`, `related-items-field.tsx`.

Dashboard: cards in `src/features/dashboard/components/`; calculations in `src/features/dashboard/lib/metrics.ts`
(tests: `tests/features/dashboard/lib/metrics.test.ts`). It is a daily overview — attention strip (reconciliation, flagged orders, pending
payments → `/orders?payment=pending`, sold-out sizes → `#stock`), sales pulse (today / 7 / 30-day tabs), best sellers +
slow movers, stock alerts ranked by 30-day sales, discounts ending within 7 days, catalog health score, and a
permission-aware "+ جديد" menu. The API sales report tags each order item with `productId` + `variantId`.

## 6. Patterns

### List page (reference: `/products` — `app/products/page.tsx` + `features/products/components/products-table.tsx`)
- Never show SKU in lists.
- Toolbar = `AdminListHeader`: exactly **one search + one "تصفية" filter control + the count on the same row** (count
  also beside them on mobile). Sorting is covered by the sortable headers. Search inputs are `type="search"`.
  - Desktop (≥768px): cascading menu (one submenu per filter showing its current value, ✓ on selected, reset item).
  - Phones: Popover "تصفية النتائج" with labelled selects + "ترتيب حسب" + reset (user: keep this on mobile).
  - Active filters = removable nude chips; "مسح الكل" when >1. Filters get an `icon` and short labels ("الحالة", "القسم").
- `Card` wraps a `Table`. Every data column sortable with `SortableTH` + `hooks/use-table-sort.ts`: 3 clicks =
  asc → desc → back to neutral. Sort state lives in the page; manual reorder arrows hide while a sort or filter is active.
- Rows become stacked cards below `md` (`data-cell="lead"`, `data-cell="actions"` bottom bar, others `data-label`).
- Loading = skeleton rows (never a false "0 items"/empty state; use the store's `loaded` flag). Empty = `EmptyState`.
- Row actions = `RowMenu` (+ `RowMenuItem` / `RowMenuLink` / `RowMenuSeparator`). Destructive confirm =
  `AdminConfirmModal tone="danger"`.

### New / edit page = wizard (reference: `features/products/components/product-form.tsx`)
The user designed this from their own mockup after rejecting: 2-column form, sticky side guide, capped width, tabs,
Shopify ⅔/⅓.
- `Stepper` card on top: equal-width step columns; the progress rule spans exactly those columns so its edge sits
  **at the step being viewed** (not at "completed" steps). Labels hide on phones.
- One `Card` per step: question-style title + one-line description; "الخطوة n من N" (`StepCount`) in the card header.
- Footer: `إلغاء` (start) … `السابق` · `حفظ كمسودة` · `التالي` (end); last step shows the final save.
- **Creating:** steps unlock in order; "التالي" checks that step's required fields (`checkRequirements(keys)` in the
  form hook; requirements carry a `target` = step id) and marks errors; "حفظ كمسودة" saves from any step
  (`save({ asStatus: "inactive" })`).
- **Editing:** every step clickable; "حفظ التعديلات" on every step.
- **No review/summary step** (user removed it). The last step ends with one aligned row:
  related items | status (status tiles + "مطلوب قبل النشر" chips that jump to the step + badge switches).
- Product steps: 1 الأساسيات (names, description, category, keywords) · 2 الوسائط (media + hover) ·
  3 المقاسات والأسعار (sizes + buying price) · 4 التفاصيل والنشر (ingredients/how-to/warnings, SKU, YouTube, related | status).
- Image slots (media + hover) are always horizontal `LangSlotRow`s (`media-frame.tsx`): Arabic and English **side by
  side on one line**; media rows add an order column (number, "الأساسية" on the first, up/down). Single optional images
  use `single-image-field.tsx`.
- Related items picker = "+ إضافة عنصر" button → searchable 360px popover (`related-items-field.tsx`), never a native select.
- SKU stays in the form (optional, auto `SKU-<timestamp>`), labelled "رمز المنتج (SKU)". Ask before hiding it.
- Pages with no settings (product discount) use `EditorLayout` (cards + sticky `FormSaveBar`), full width.

## 7. Theme & accessibility

- Dark mode on every page. **The rail (sidebar) stays dark in both themes** (user reverted an inverted-sidebar request).
- Theme menu (فاتح / داكن / حسب الجهاز) in the rail footer, stored in localStorage `capella-erp-theme`; light is the
  default until chosen, and an explicit "system" choice persists. Files: `lib/theme.ts` (client),
  `lib/theme-script.ts` (boot script, server-safe).
- Prefer real semantics: `<section aria-label>` regions (order detail), `role="status"` for loaders,
  labelled controls, and lucide icons (no icon font).

## 8. Other files

- Formatting: `lib/format.ts`. Sorting: `hooks/use-table-sort.ts`. Reorder: `hooks/use-list-reorder.ts` + `lib/array.ts`.
  Wizard steps: `hooks/use-wizard-steps.ts`. Image upload: `hooks/use-image-upload.ts` + `lib/media.ts`.
  Media queries: `hooks/use-media-query.ts`. `lib/utils.ts` — `cn` with custom tailwind-merge groups.
- Offers and collections are the same editor/list (`features/bundles/*`); `features/offers` and `features/collections`
  hold only their `*-config.ts`, thin `*-form.tsx`/`use-*-form.ts` wrappers, and `types.ts`.
- Tests run with `NODE_ENV=test` (see `vitest.config.ts` + `tests/setup.ts`).
  Typecheck: `cd apps/erp && npx tsc -p tsconfig.json --noEmit`.

## 9. How to work (so the user doesn't have to say it again)

- Act on the user's feedback directly; don't re-ask settled things (sections 2–7 are settled). If a design choice
  is genuinely open, offer 2–3 options with small ASCII mockups and a recommendation.
- Verify every page in the browser (Playwright MCP) at **1920 and 1440 desktop and 390 phone, light + dark**, before
  saying it is done. Check real states: loading, empty, errors, long names.
- Tell the user about any bug you notice (plain language), even outside the current page.
- No commits, no sub-agents/background agents without explicit permission.

Known issue: `lib/errors.ts` falls back to the raw backend `message` (often English) in toasts when no Arabic
`reason` mapping exists.

## 10. Environment & gotchas

- Dev: `npx turbo run dev --filter=@capella/erp --filter=@capella/api` (ERP :3001 with `--webpack`, API :4000).
  Login: admin@capella.eg / password in the local `.env`. Check whether servers are already running before starting.
  If the API returns 500 "unknown column", run `pnpm --filter @capella/database db:migrate`.
- Playwright MCP is one shared browser; save screenshots under the repo-root `.playwright-mcp/` (git-ignored), e.g.
  `filename: ".playwright-mcp/x.png"`, then Read `D:/Documents/work/capella/capellastore/.playwright-mcp/x.png`.
  Radix tabs/menus open on `pointerdown`, not `click`, when driven from `browser_evaluate`.
- Windows: the dev server sometimes misses edits to `globals.css`; `touch src/app/globals.css` then reload.
- Bash heredocs with Arabic + quotes often break; write Python edit scripts to the scratchpad and run them.
- Native `<select>` dropdown lists can't paint oklch colours (rows render blank) — the global `option` rule handles it;
  don't remove it.
- Container queries (`@lg:` etc.) only respond to an ancestor's `@container`, never the element itself.
- lucide-react v1: some names differ (`Ellipsis`, not `MoreHorizontal`).
