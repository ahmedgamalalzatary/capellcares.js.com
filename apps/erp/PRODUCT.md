# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Capella Care's owner and staff, several roles (catalog, offers, orders, shipping, reviews, staff management). Non-technical. They run the store's daily operations from this tool. Access is per-role via the staff permission model.

## Product Purpose
The Capella ERP is the admin back office for the Capella Care storefront and mobile app: manage the catalog (products, sizes, categories, offers, collections, discounts), store content (advices, shop media), and operations (orders, payment reconciliation, shipping, reviews, sales, staff, trash). Success: staff complete daily tasks quickly and confidently without technical help.

## Operating Context
- Used on desktop, tablet, and phone; every page must be fully usable on all of them.
- Data is managed only through the API; the ERP never touches the database directly.
- Storefront-facing content is entered bilingually (Arabic + English fields), while the ERP UI itself is Arabic-only.

## Capabilities and Constraints
- Stack: Next.js 16 (app router), Tailwind CSS v4, shadcn/Radix primitives, sonner toasts, lucide icons.
- UI language: Arabic-only, right-to-left. Copy addresses staff in the feminine form (e.g. "ابحثي").
- Orders: list/detail and read-only payment reconciliation; only Cash on Delivery payment status is editable (with permission). Paymob status is provider-managed.
- Currency: EGP.

## Brand Commitments
- Same brand family as the Capella Care storefront (apps/storefront): warm parchment canvas, near-black ink, white surfaces. Tuned into a calm, dense work tool rather than a marketing surface.
- Logo assets: apps/storefront/public (capella logo*.png, logoblack.jpg).

## Product Principles
1. Non-technical staff first: plain Arabic, no raw technical text, obvious primary action.
2. One consistent system: every page built from the same shared components and tokens.
3. Fully responsive: no task requires a desktop.
4. Calm density: lots of data, little noise; brand shows in precise details, not decoration.

## Accessibility & Inclusion
WCAG AA contrast for text and controls; visible keyboard focus; touch targets ≥ 44px on touch devices.
