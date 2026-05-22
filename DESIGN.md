# Capella Cares — Design System

## Palette (committed strategy)
Source colors (sRGB hex, also expressed in OKLCH as CSS vars):

| Token | sRGB | OKLCH | Role |
|---|---|---|---|
| `--ink` | `#8E3200` | `oklch(0.422 0.149 41)` | Brand, headings, footer, Arabic display, sidebar (ERP) |
| `--ink-2` | derived | `oklch(0.42 0.05 45)` | Body text on cream |
| `--ink-3` | derived | `oklch(0.55 0.04 50)` | Captions, meta, placeholders |
| `--accent` | `#A64B2A` | `oklch(0.499 0.142 38)` | CTAs (Add to cart, Place order, Save), price, focused state |
| `--accent-soft` | derived | `oklch(0.92 0.04 40)` | Pressed/hover surfaces of accent buttons |
| `--warm` | `#D7A86E` | `oklch(0.748 0.106 70)` | Chips, dividers, decorative borders, "New" badge bg |
| `--warm-soft` | derived | `oklch(0.92 0.05 75)` | Subtle decorative wash |
| `--canvas` | `#FFEBC1` | `oklch(0.94 0.06 85)` | Page background tint |
| `--surface` | derived | `oklch(0.975 0.024 85)` | Card surface, input field, table row |
| `--text` | derived | `oklch(0.22 0.04 45)` | Body copy — very dark warm brown, not pure black |
| `--hairline` | derived | `oklch(0.86 0.04 75)` | 1px borders |
| `--error` | `#B23A1F` | `oklch(0.499 0.165 32)` | Form validation, destructive confirms |
| `--success` | derived | `oklch(0.55 0.07 130)` | Order placed, restore confirmations (used sparingly) |

**Proportional mix:**
- 60% canvas + surface — page bg, cards
- 30% ink — text, headings, sidebar
- 7% warm — chips, badges, dividers
- 3% accent — CTAs, prices, focused state

Strategy: **Committed** for storefront (cream carries the whole brand). **Restrained** for ERP (cream-on-cream surfaces, ink type, accent only on save/primary actions).

## Typography
- **Display (storefront, Latin)**: Cormorant Garamond — serif italics for "c" mark, regular for headings.
- **Display (storefront, Arabic)**: Tajawal 700 — geometric humanist; pairs with Cormorant's warmth without competing.
- **Body (Latin)**: Inter, system stack.
- **Body (Arabic)**: Tajawal 400/500.
- **ERP body**: Tajawal exclusively (Arabic-only UI). Slightly denser scale (14px base) to match data-heavy admin work.
- **Mono (ERP only)**: JetBrains Mono — for SKUs and codes.

Scale (storefront): 12, 13, 14, 16, 20, 24, 32, 44, 64 (display). Ratio ≥1.4 between hierarchy steps.
Scale (ERP): 11, 12, 13, 14, 16, 20, 22, 26.

## Radii
- `--radius-sm` 6px (inputs, small chips)
- `--radius` 10px (cards, buttons, larger chips)
- `--radius-lg` 16px (panels, hero surfaces)
- `--radius-pill` 9999px (badges, qty steppers, search field)

Storefront uses larger radii (panels feel softer). ERP uses smaller radii (data feels precise).

## Elevation
Single-tier shadows. Warm-tinted, never gray.
- `--shadow-1`: `0 1px 2px oklch(0.42 0.05 45 / 0.04), 0 6px 16px oklch(0.42 0.05 45 / 0.06)`
- `--shadow-2`: `0 12px 32px oklch(0.42 0.05 45 / 0.10)`

No glassmorphism. Backdrop-blur only on the sticky storefront header during scroll.

## Spacing rhythm
Vary, don't normalize. Storefront page sections breathe at 64–96px; cards pad at 24px; form fields at 12–16px. ERP toolbars and tables at 12–14px; cards at 20px; the page padding 28px.

## Components (Tailwind v4 utility classes — all defined in globals.css)
- `.btn` (variants `--primary`, `--ghost`, `--soft`, `--block`, `--sm`, `--lg`, `--danger`, `--success`)
- `.card` / `.pcard` (product card with ribbon corners)
- `.chip` (variants `--active`, `--accent`, `--warm`, `--sage`, `--gold`)
- `.badge` (variants `--offer`, `--new`, `--bestseller`)
- `.input` / `.select` / `.textarea` / `.field` / `.field-error`
- `.table` (sticky head in ERP)
- `.status` (variants `--active`, `--inactive`, `--draft`, `--deleted`, `--pending`, `--accepted`)
- `.sidebar` / `.topbar` / `.page` / `.toolbar` (ERP shell)

## Motion
Ease-out-expo for transforms. 120–200ms range. Never animate layout properties. No bounce, no spring. Hover lifts cards by 2px max.

## Banned
- Glassmorphism as decoration.
- Gradient text.
- Side-stripe borders > 1px.
- Hero-metric SaaS template.
- Identical card grids with icon+heading+text repeated indefinitely.
- Pure `#000` or `#fff` anywhere — every neutral tinted toward `--ink` hue.

## File anchors
- Storefront tokens: `apps/storefront/src/app/globals.css`
- ERP tokens: `apps/erp/src/app/globals.css`
- Storefront primitives: `apps/storefront/src/components/ui/*`
- ERP primitives: `apps/erp/src/components/ui/*`
- i18n copy: `packages/shared/src/i18n/{ar,en}.ts`
