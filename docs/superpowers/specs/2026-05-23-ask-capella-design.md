# Ask Capella — Design Spec
**Date:** 2026-05-23

## Overview
A fixed floating button visible on all storefront pages that opens an elegant full-screen search overlay. Users type natural language queries; results appear live across products, categories, and offers. Bilingual (AR/EN). No new backend endpoints — uses existing `fetchProducts(?q=)` for products and client-side filtering for categories/offers.

---

## Entry Point

- Fixed button, bottom-right (EN) / bottom-left (AR)
- Label: "Ask Capella" (EN) / "اسألي كابيلا" (AR)
- Styled with `--accent` background, `--font-display` italic, `--radius-pill`
- Subtle pulse animation on first render to draw attention
- `z-50`, sits above all page content
- Present on every page via the `[lang]/layout.tsx` shell

---

## Overlay

- Full-screen backdrop: `bg-ink/40` with `backdrop-blur-sm`
- Centered panel: `max-w-[640px]`, `w-[92vw]`, `--radius-lg`, `--shadow-2`
- Top: search input, autofocused on open, placeholder varies by lang
- Results appear below the input as the user types
- Keyboard: `Escape` closes overlay, `Enter` on a result navigates
- Clicking backdrop closes overlay

---

## Search Behaviour

- Debounced 300ms after each keystroke
- On query change, run in parallel:
  - `fetchProducts({ q: query, lang })` — backend handles product text search
  - Filter categories client-side: match `pickLang(c.name, lang)` against query (case-insensitive substring)
  - Filter offers client-side: match `pickLang(o.name, lang)` against query
- Minimum query length: 2 characters (no results shown below that)
- Loading state: skeleton rows while products fetch

---

## Results Display

Three grouped sections inside the overlay panel, each with a small eyebrow label:

| Section | Item shows | Navigate to |
|---|---|---|
| Products | Thumbnail · Name · Price · New/Bestseller chip | `/[lang]/products/[slug]` |
| Categories | Name | `/[lang]/category/[slug]` |
| Offers | Name · Savings chip | `/[lang]/offers/[slug]` |

- Max 5 products, 4 categories, 3 offers shown
- Empty state (no results across all three): warm illustrated message + link to browse all products
- If query < 2 chars: show nothing (input hint only)

---

## Components

| File | Purpose |
|---|---|
| `components/search/ask-capella-button.tsx` | Fixed FAB trigger button |
| `components/search/ask-capella-overlay.tsx` | Full overlay with input + results |
| `components/search/ask-capella-result-item.tsx` | Single result row (shared across sections) |

The button + overlay are mounted in `app/[lang]/layout.tsx`.

---

## i18n

New keys added to `packages/shared/src/i18n/en.ts` and `ar.ts`:

```
ask: {
  button: "Ask Capella",
  placeholder: "What are you looking for?",
  sections: { products: "Products", categories: "Categories", offers: "Offers" },
  empty: "No results for \"{q}\"",
  browseAll: "Browse all products →"
}
```

Arabic equivalents in `ar.ts`.

---

## Constraints

- No new npm dependencies
- No new backend endpoints
- Must pass TypeScript strict checks
- RTL-safe: button position flips, text direction inherits from `html[dir]`
