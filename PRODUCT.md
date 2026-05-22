# Capella Cares — Product Context

## Register
**brand** (storefront) + **product** (ERP). The repo holds both. When working in `apps/storefront`, treat the surface as brand (design is part of the product). When working in `apps/erp`, treat it as product (design serves the admin's job).

## What is it
Bilingual (Arabic/English) e-commerce storefront for a beauty and personal-care brand based in Egypt. Categories include Body Care, Skin Care, Hair Care, Men's, Kid's, Organic Oils, Soap, Candles, Fragrances, Fresheners, Makeup, Accessories & Tools.

Companion Arabic-only ERP for the admin (one role, one user in v1). The ERP manages products, categories, offers, and "Capella Advices" (editorial routine tips). Order management is deferred.

Checkout: Cash on Delivery only in v1. Currency: EGP only. Egyptian phone validation.

## Users
- **Customer**: Egyptian women (primary), shopping bilingual content (Arabic dominant). Mobile-first. Wants a calm, "natural / handmade / botanical" feeling, not pharmacy-clinical. Browses by category, by offer bundle, or by search.
- **Admin**: single Arabic-speaking operator running the entire catalog. Works in Arabic-only desktop UI. Day job is creating/editing products, managing variants and stock, building offer bundles, organizing the category tree, and writing advice posts.

## Strategic principles
- **Warm earthy palette, not pharmacy white.** Cream canvas dominates. Burnt-sienna ink for type. Rare rust-red accent for CTAs. Amber for decoration.
- **Arabic typography is first-class.** Arabic display weight on brand surfaces, not an afterthought.
- **Restraint on the accent color.** One accent action per viewport — "Add to cart", "Place order", "Save". Everything else lives in ink, warm, or canvas.
- **No SaaS cliché.** Avoid hero-metric templates, identical card grids, glassmorphism, gradient text, side-stripe borders.
- **Offer bundles are first-class.** A separate top-nav entry; their own slug page; visible on product detail when relevant.
- **Wishlist is gated behind login**, cart is not.

## Anti-references
- Generic Shopify/Shopify-clone product grid in pure white.
- Pharmacy-blue / sanitary clinical aesthetic.
- Loud Sephora-style bold typography that fights the product photography.
- AI-generated "wellness" gradients and pastel blobs.

## Locked stack
Next.js 15 (storefront + ERP), Express API, MySQL + Drizzle, Tailwind v4, shadcn primitives over Radix, lucide-react, tw-animate-css.
