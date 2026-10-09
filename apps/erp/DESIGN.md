# Capella ERP — design system ("Tester Tray")

The ERP's visual language after the redesign. Every page in `apps/erp` is built from this base; new
pages should reuse it rather than invent their own. The old `styles/legacy.css` and its classes are gone.

## 1. The world

A warm, parchment-toned admin: a white "well" (card) floating on a canvas, with a dark ink rail down the
side, nude-tan accents borrowed from the logo, and one warm neutral ramp doing all the greys. Everything is
full width beside the rail, RTL, Arabic-only, Arabic feminine address ("ابحثي"). Light is the default theme
until the viewer picks one; the rail stays dark in both themes.

## 2. Tokens

All tokens are defined in `src/app/globals.css` (`:root` + `[data-theme="dark"]`). Use tokens only — **never
raw colours** (no `text-white`, no hex/oklch outside the token file).

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

## 3. Typography & numbers

- UI font: `--font-sans` (Tajawal). Digits: `--font-num` (Roboto) — apply the `num` class on **digits only**.
- **Latin tabular digits everywhere** via `lib/format.ts`: `formatNumber`, `formatMoney`, `formatMoneyRange`.
  Never `formatPrice(..., "ar")`. Dates use the `ar-EG-u-nu-latn` locale so they keep Latin digits.
- Copy is Arabic-only; no English labels.

## 4. Components (`src/components/ui`)

`button` (primary/secondary/ghost/danger/danger-ghost; sm/md/lg/icon/icon-sm; `asChild`) · `input`
(`Input`, `Textarea`, `Select`, `InputWithIcon`, `InputWithAddon`, `controlClass`) · `field` (label + hint +
error) · `switch` (`Switch`, `SwitchField`) · `alert` · `badge` (`Badge`, `Swatch`) · `card` (`Card`,
`CardHeader`, `CardBody`, `CardFooter`) · `table` (`Table`, `THead`, `TBody`, `TR`, `TH`, `SortableTH`, `TD`)
· `thumb` (the tray's signature, with first-letter fallback) · `empty-state` · `skeleton` (`Skeleton`,
`FormSkeleton`) · `row-menu` · `modal` (Radix; bottom sheet on phones) · `file-button`.

Admin pieces (`src/components/admin`): `admin-list-header`, `stepper`, `editor-layout` (+ `FormSaveBar`),
`admin-confirm-modal`, `erp-forbidden-state`.

## 5. Patterns

### List page
- Full width. Toolbar = `AdminListHeader`: **one search + one "تصفية" control + the count**; desktop is a
  cascading menu, phones a panel of labelled selects (+ sort). Active filters echo as removable nude chips.
  Search inputs are `type="search"` (role `searchbox`).
- `Card` wraps a `Table`. Every data column is sortable (`SortableTH` + `hooks/use-table-sort.ts`): three
  clicks cycle asc → desc → neutral. Manual reorder arrows hide while a sort or filter is active.
- Rows stack into cards under `md` (`data-cell="lead"`, `data-cell="actions"`, others `data-label`).
- Row actions live in a `RowMenu` (hover/portals). Destructive confirm = `AdminConfirmModal tone="danger"`.
- Loading = skeleton rows (never a false empty state; use the store's `loaded`); empty = `EmptyState`.
- No SKU in lists.

### New / edit page = wizard
- `Stepper` on top, one `Card` per step (question title + one-line description + `StepCount`), footer
  `إلغاء … السابق · حفظ كمسودة · التالي`, the last step ending with **related | status** (status tiles +
  "مطلوب قبل النشر" chips that jump to the step).
- Creating: steps unlock in order; "التالي" gates that step via `checkRequirements(keys)`; "حفظ كمسودة"
  saves from any step. Editing: every step clickable; "حفظ التعديلات" everywhere; no review step.
- Fields sit on one two-column grid `grid gap-x-4 gap-y-5 @lg:grid-cols-2` (`@container` on the card body);
  paired cells line up, and there are no half-empty rows. Bilingual pairs (AR | EN) share a row.
- Image slots are horizontal `LangSlotRow`s (`media-frame.tsx`); single optional images use
  `forms/single-image-field.tsx`.
- Related items use a searchable popover (`related-items-field.tsx`), never a native select.

## 6. Theme & accessibility

- Theme menu (فاتح / داكن / حسب الجهاز) in the rail footer, stored in `capella-erp-theme`; light is the
  default until chosen, and an explicit "system" choice persists.
- Prefer real semantics: `<section aria-label>` regions (order detail), `role="status"` for loaders,
  labelled controls, and lucide icons (no icon font).

## 7. Files

- Tokens/theme: `src/app/globals.css`, `lib/theme.ts`, `lib/theme-script.ts`.
- Formatting: `lib/format.ts`. Sorting: `hooks/use-table-sort.ts`. Reorder: `hooks/use-list-reorder.ts`.
- Tests run with `NODE_ENV=test` (see `vitest.config.ts` + `tests/setup.ts`).
