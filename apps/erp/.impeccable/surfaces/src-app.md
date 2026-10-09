---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

Scope: the whole Capella ERP app shell and every admin page (Operate mode). Replacement visual world; product truth from PRODUCT.md.

## Direction contract

THESIS: The ERP is Capella's back-of-counter: a calm tester tray where every item sits in its own well at one fixed scale. Refuses the default grey shadcn admin and the old flat-grey, monospace, everything-hairlined look.

OWN-WORLD: Storefront parchment canvas, solid warm-ink side rail (committed shell colour), white wells with a soft inset edge instead of hairline boxes, one 11-step warm neutral ramp as the only neutrals, Capella nude (the logo face tan) as the accent for the active rail item, selection and focus, with ink primary buttons and the logo taupe for secondary text, swatch dots for state (green active, amber attention, red danger, ink-4 inactive). Tajawal for Arabic, Roboto tabular figures for numbers.

STORY: Staff open a page, see where they are (rail + page title), find the one primary action top-left, scan items by thumbnail + name + swatch, and edit in a form whose Save is always reachable.

FIRST VIEWPORT: Right: 248px ink rail (logo, grouped nav, user). Top: page title 24px with breadcrumb, primary action at the end. Body: toolbar (search + filters + count) then a white well table; each row starts with a 44px product thumbnail well and a status swatch.

FORM: tester tray, candidate 7 of 7, seed key a0f4a796. Signature move: thumbnail wells + swatch dots at one fixed scale in every list and picker.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## User-approved rules (binding for every page)

Full handoff (plan, progress, all rules, gotchas): `apps/erp/REDESIGN.md` — read it first in a new session.

Reference implementation: /products list (approved by the user). Copy its patterns.

- Page width: content fills 90% of the area beside the rail (`lg:px-[5%]`, no max-width cap) — set in AdminShell.
- Never show SKU in lists. (SKU field in the product form: SKU is optional, auto-generated as `SKU-<timestamp>` when empty — ask the user before hiding/moving it in forms.)
- Numbers: Latin tabular digits everywhere via `lib/format.ts` (`formatMoney`, `formatMoneyRange`, `formatNumber`) + `num` class. Never `formatPrice(..., "ar")`.
- Tables: every data column sortable via `SortableTH` + `hooks/use-table-sort.ts`, 3 states (asc → desc → original order). Sort state lives in the page; manual reorder arrows hide while a sort is active. Table rows become stacked cards below `md` (`data-cell="lead"`, `data-cell="actions"` bottom bar, other cells `data-label`).
- List toolbar (`AdminListHeader`, shared): exactly ONE search + ONE "تصفية" filter control + count on the same row (also on mobile). Desktop (≥768px): cascading DropdownMenu, one submenu per filter showing current value, ✓ on selected, reset item. Phones: Popover panel "تصفية النتائج" with labelled native selects + "ترتيب حسب" sort select + reset. Active filters show as removable nude chips below; "مسح الكل" when >1. Filters get an `icon` and short labels ("الحالة", "القسم").
- Dark mode: required for every page. Sand ramp inverts under `[data-theme=dark]`; components use tokens only (no raw colors, no `text-white` except on the rail). Rail stays dark in BOTH themes (light: ink rail; dark: lifted dark panel 0.20 + border-e). Theme menu (فاتح/داكن/حسب الجهاز) in rail footer, stored in localStorage `capella-erp-theme`.
- Loading: skeleton rows (never a false empty state). Empty: `EmptyState` with icon + title + hint.
- Row actions: `RowMenu` + `RowMenuItem`/`RowMenuLink`/`RowMenuSeparator` (Radix). Dialogs: `Modal` / `AdminConfirmModal tone="danger"` (bottom sheet on phones).
- New/edit pages = WIZARD (user-approved from their own mockup, after rejecting 2-col, sticky guide, capped width, tabs, Shopify ⅔/⅓): full page width (NEVER cap/shrink width — user: "give it bigger w, i don't know why u keep making it smaller"). `Stepper` (components/admin/stepper.tsx): equal-width step columns with the progress rule spanning exactly them, so the rule's edge sits at the step being viewed; "الخطوة n من N" (`StepCount`) lives in the step card header. One `Card` per step (question-style title + description), footer: إلغاء | السابق · حفظ كمسودة · التالي / final save. Creating: steps unlock in order, "التالي" runs `checkRequirements` for that step's keys; "حفظ كمسودة" = `save({ asStatus: "inactive" })` from any step. Editing: all steps clickable, "حفظ التعديلات" on every step. 4 steps (user removed the review step): last = التفاصيل والنشر — long text, SKU/YouTube, then one aligned row: العناصر المرتبطة | حالة المنتج (status tiles + "مطلوب قبل النشر" chips that jump to the step + badges). Inside steps: same two-column container-query grid so fields align (`grid gap-x-4 gap-y-5 @lg:grid-cols-2`). Image slots = horizontal `LangSlotRow`, AR+EN side by side.
- Native `<option>` lists use system colours (`Canvas`/`CanvasText`, global base rule) — OS dropdowns can't paint oklch.
- Components live in `src/components/ui/*` (button, input/select/textarea, badge/swatch, card, table, thumb, empty-state, skeleton, row-menu, modal). Old classes in `src/styles/legacy.css` — delete rules as pages migrate.

## Workflow (user instructions)

- Redesign page groups one at a time, STOP after each group for user review. Order: 1 Products (DONE, approved) → 2 Categories → 3 Offers → 4 Collections → 5 Discounts → 6 Orders & sales (orders, order detail, reconciliation, shipping, sales) → 7 Store content (advices list/new/edit, shop-media, reviews) → 8 Admin (dashboard, staff list/new/edit, trash, login).
- Do NOT run tests until the whole UI task is finished (user: "keep tests failing"); typecheck (`npx tsc -p tsconfig.json --noEmit` in apps/erp) must pass.
- Verify each page in Playwright at 1440/1920 desktop and 390 mobile, light + dark. Dev servers: ERP :3001, API :4000 (login admin@capella.eg / local .env password).
- No sub-agents and no commits without explicit permission (AGENTS.md).
