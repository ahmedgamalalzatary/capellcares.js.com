# Capella ERP redesign — handoff

Read this first in every new session. It holds the plan, what is done, and every rule the user has already
given, so they never have to repeat themselves. Keep it updated at the end of each page group.

Related files (read them too):
- `AGENTS.md` (repo root) — working rules (no commits / no sub-agents without permission, ask when unsure, be concise, no polling).
- `apps/erp/PRODUCT.md` — who uses the ERP and why (non-technical staff, Arabic-only RTL, feminine address "ابحثي", phone + tablet + desktop).
- `apps/erp/.impeccable/surfaces/src-app.md` — design direction ("Tester Tray") + the same binding rules in short form.

---

## 1. The task

Full UI redesign of `apps/erp` (Next.js 16, Arabic RTL) from scratch on a new design base: Tailwind v4 + shadcn/Radix,
storefront colours. The old styling is disposable. Work page group by page group, **stop after each group** for the
user's review, then continue.

**Do not run tests** until the whole UI task is finished (user: "keep tests failing until we finish"). Typecheck must
pass: `cd apps/erp && npx tsc -p tsconfig.json --noEmit`.

## 2. Progress

| # | Group | Pages | State |
|---|---|---|---|
| 1 | Products | list · new · edit · product discount | **Done, approved** ("more than happy") |
| 2 | Categories | list · new · edit | **Done — awaiting review** (tree list; 2-step wizard form) |
| 3 | Offers | list · new · edit | **Done — awaiting review** (4-step wizard; status + draft) |
| 4 | Collections | list · new · edit | **Done — awaiting review** (4-step wizard; status + draft) |
| 5 | Discounts | discounts | **Done — awaiting review** (master-detail, `discounts.css` deleted) |
| 6 | Orders & sales | orders · order detail · reconciliation · shipping · sales | **Done — awaiting review** (`order-details.css` + `order-format.ts` deleted) |
| 7 | Store content | advices (list/new/edit) · shop media · reviews | **Done — awaiting review** |
| 8 | Admin | dashboard · staff (list/new/edit) · trash · login | **Done — awaiting review** |

**End of project — done:** legacy CSS removed (`styles/legacy.css`, `app/discounts/discounts.css`,
`components/orders/order-details.css`) along with `ui/icons.tsx`, `image-upload`, `entity-avatar` and
`admin-status-badge`; the test suite is migrated to the redesign and **49/49 files pass** (`NODE_ENV=test`,
`tsc` green); `DESIGN.md` written. The review/documenter agents still need explicit permission to run.

Group 1 leftovers to do before/at the start of Group 2:
- Phone (390) + dark-mode check of the product wizard and the discount page (not re-checked after the last changes).
- Two open bugs — **ask the user** whether to fix now or after the redesign:
  1. Opening a product edit page directly shows "Admin auth required" and disables related items: the detail fetch
     races the token refresh (`lib/api/client.ts` only refreshes on "Invalid admin token", not "Admin auth required").
  2. Discount page: turning a discount on then off without dates leaves an inactive discount with empty dates →
     `hasInvalidDiscount` keeps Save disabled.
- Also known: `lib/errors.ts` shows raw backend (English) messages in toasts.

## 3. Rules the user already gave (binding on every page)

### Layout & width
- **Every page is full width**: 90% of the area beside the rail (`AdminShell` main uses `lg:px-[5%]`). **Never cap or
  shrink page/editor width** (no `max-w-*` on pages, no centered narrow editors). The user rejected this many times.
  When fields look too wide, fix it with structure (aligned two-column grids), not by narrowing the page.
- Fields line up **vertically and horizontally**: inside form cards use one two-column grid
  `grid gap-x-4 gap-y-5 @lg:grid-cols-2` (container queries, `@container` on the card body). Reference the user liked:
  the product "الوصف والمحتوى" block — bilingual pairs side by side, rows aligned. Prefer single-line inputs so paired
  cells have equal height.
- No half-empty rows next to a short element; if two sections share a row, each takes half and fills it (e.g. related
  items | status). Lists inside a half-width section are one column.

### Lists (reference: `/products`, `app/products/page.tsx` + `components/products-table.tsx`)
- Never show SKU in lists.
- Every data column sortable with `SortableTH` + `hooks/use-table-sort.ts`: 3 clicks = asc → desc → back to neutral.
  Sort state lives in the page; manual reorder arrows hide while a sort is active.
- Toolbar `components/admin/admin-list-header.tsx`: exactly **one search + one "تصفية" filter control + the count on the
  same row** (count also beside them on mobile). Sorting is covered by the sortable headers.
  - Desktop (≥768px): cascading menu (one submenu per filter showing its current value, ✓ on selected, reset item).
  - Phones: Popover "تصفية النتائج" with labelled selects + "ترتيب حسب" + reset (user: keep this on mobile).
  - Active filters = removable nude chips; "مسح الكل" when >1. Filters get an `icon` and short labels ("الحالة", "القسم").
- Rows become stacked cards below `md` (`data-cell="lead"`, `data-cell="actions"` bottom bar, others `data-label`).
- Loading = skeleton rows (never a false "0 items"/empty state; use the store's `loaded` flag). Empty = `EmptyState`.
- Row actions = `RowMenu` (+ `RowMenuItem` / `RowMenuLink` / `RowMenuSeparator`). Destructive confirm =
  `AdminConfirmModal tone="danger"`.

### New / edit pages = wizard (reference: `components/forms/product-form.tsx`)
The user designed this from their own mockup after rejecting: 2-column form, sticky side guide, capped width, tabs,
Shopify ⅔/⅓. Pattern:
- `Stepper` (`components/admin/stepper.tsx`) card on top: equal-width step columns; the progress rule spans exactly
  those columns so its edge sits **at the step being viewed** (not at "completed" steps). Labels hide on phones.
- One `Card` per step: question-style title + one-line description; "الخطوة n من N" (`StepCount`) in the card header.
- Footer: `إلغاء` (start) … `السابق` · `حفظ كمسودة` · `التالي` (end); last step shows the final save.
- **Creating:** steps unlock in order; "التالي" checks that step's required fields (`checkRequirements(keys)` in the
  form hook) and marks errors; "حفظ كمسودة" saves from any step (`save({ asStatus: "inactive" })`).
- **Editing:** every step clickable; "حفظ التعديلات" on every step.
- **No review/summary step** (user removed it). The last step ends with one aligned row:
  related items | status (status tiles + "مطلوب قبل النشر" chips that jump to the step + badge switches).
- Product steps: 1 الأساسيات (names, description, category, keywords) · 2 الوسائط (media + hover) ·
  3 المقاسات والأسعار (sizes + buying price) · 4 التفاصيل والنشر (ingredients/how-to/warnings, SKU, YouTube, related | status).
- Image slots (media + hover) are always horizontal `LangSlotRow`s (`components/forms/media-frame.tsx`): Arabic and
  English **side by side on one line**; media rows add an order column (number, "الأساسية" on the first, up/down).
- Related items picker = "+ إضافة عنصر" button → searchable 360px popover (`related-items-field.tsx`), never a native select.
- SKU stays in the form (optional, auto `SKU-<timestamp>`), labelled "رمز المنتج (SKU)". Ask before hiding it.
- Pages with no settings (product discount) use `EditorLayout` (`components/admin/editor-layout.tsx`, cards + sticky
  `FormSaveBar`), full width.

### Theme & look
- Dark mode on every page. Tokens only (no raw colours; no `text-white` except on the rail). Sand ramp inverts under
  `[data-theme=dark]`. **The rail (sidebar) stays dark in both themes** (user reverted an inverted-sidebar request).
  Theme menu in the rail footer (فاتح / داكن / حسب الجهاز), stored in localStorage `capella-erp-theme`.
- Numbers: Latin tabular digits via `lib/format.ts` (`formatNumber`, `formatMoney`, `formatMoneyRange`) + `num` class
  on the digits only (Roboto has no Arabic glyphs). Never `formatPrice(..., "ar")`.
- Arabic-only UI copy, feminine address. No English labels ("Percentage", "Name (English)" → Arabic).
- No numbered section labels (01/02…), no eyebrow/kicker text above headings.
- Number inputs have no spin arrows (global rule); units via `InputWithAddon` ("ج.م", "%").
- Switches sit right next to their label (`SwitchField`).

## 4. The design base (where things are)

- `src/app/globals.css` — tokens (`:root` + `[data-theme=dark]`), `@theme inline`, base layer (selection, focus,
  scrollbars, `option { Canvas/CanvasText }`, no number spinners). `src/styles/legacy.css` = old classes still used by
  unmigrated pages (delete rules as pages migrate).
- `src/components/ui/`: `button` (primary/secondary/ghost/danger/danger-ghost; sizes sm/md/lg/icon/icon-sm; `asChild`),
  `input` (`Input`, `Textarea`, `Select` native, `InputWithIcon`, `InputWithAddon`, `controlClass`), `field` (`Field`
  label+hint+error), `switch` (`Switch`, `SwitchField`), `alert`, `badge` (`Badge`, `Swatch`), `card` (`Card`,
  `CardHeader`, `CardBody`, `CardFooter`), `table` (`Table`, `THead`, `TBody`, `TR`, `TH`, `SortableTH`, `TD`),
  `thumb`, `empty-state`, `skeleton` (`Skeleton`, `FormSkeleton`), `row-menu`, `modal` (Radix Dialog; bottom sheet on
  phones), `file-button`. `icons.tsx` = old icons (to delete at the end; use lucide-react).
- `src/components/admin/`: `admin-list-header`, `stepper`, `editor-layout` (+ `ReadinessStatus`, `scrollToSection`),
  `form-save-bar`, `admin-confirm-modal`, `erp-forbidden-state`.
- `src/components/shell/admin-shell.tsx` — rail + mobile drawer + page header (breadcrumb, title, description, actions).
  `theme-menu.tsx`.
- Shared form parts (also used by offer/collection/category forms): `editor-form-parts.tsx` (`BilingualNameFields`,
  `BilingualEditorField` with ع/EN tags, `ImageFieldCard`, `EditorActions`), `category-picker.tsx`, `media-frame.tsx`,
  `product-media-upload.tsx` (`EntityMediaUpload`), `hover-image-upload.tsx`, `related-items-field.tsx`.
- Hooks: `use-table-sort.ts`, `use-media-query.ts`, `forms/use-product-form.ts` (requirements carry a `target` = step id;
  `save({ asStatus })`, `checkRequirements(keys)`).
- `lib/format.ts`, `lib/theme.ts` (client), `lib/theme-script.ts` (boot script, server-safe), `lib/utils.ts` (`cn` with
  custom tailwind-merge groups).

## 5. How to work (so the user doesn't have to say it again)

- One group at a time; stop at the end of each group with a short summary and wait for review.
- Act on the user's feedback directly; don't re-ask settled things (all of section 3 is settled). If a design choice
  is genuinely open, offer 2–3 options with small ASCII mockups and a recommendation.
- Verify every page in the browser (Playwright MCP) at **1920 and 1440 desktop and 390 phone, light + dark**, before
  saying it is done. Check real states: loading, empty, errors, long names.
- Tell the user about any bug you notice (plain language), even outside the current page.
- No commits, no sub-agents/background agents without explicit permission.

## 6. Environment & gotchas

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
