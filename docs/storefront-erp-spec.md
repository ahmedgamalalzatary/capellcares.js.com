# Capella Storefront + ERP Specification

## Summary

This document is the product and architecture source of truth for the Capella storefront and ERP system.

Locked stack:
- `Next.js` (App Router) for the storefront.
- `Next.js` (App Router) for the ERP frontend.
- `Express.js` for the backend API.
- `MySQL` as the shared database.
- `Drizzle ORM` for schema, migrations, seeds, and database access.
- `React Native`/`Expo` for the mobile client, consuming the same API.
- One monorepo, pnpm workspaces + Turborepo.

Core business rules:
- Storefront and mobile read data from the ERP-backed API only.
- ERP manages catalog data through the API.
- All apps share one MySQL database through `packages/database`.
- Storefront only sees the public, storefront-safe subset of data (buying price and internal timestamps are stripped from storefront DTOs).
- ERP controls the full catalog model.
- Static UI translation is centralized in `packages/shared/src/i18n`.
- Dynamic storefront content is stored as bilingual data and served by API DTOs.

## Architecture

Monorepo shape:

```text
capella/
├─ apps/
│  ├─ storefront/      # Next.js customer-facing app (locale-prefixed routes)
│  ├─ erp/             # Next.js Arabic-only ERP/admin app
│  ├─ api/             # Express.js API for storefront + ERP
│  └─ mobile/          # Expo/React Native client reusing the storefront contracts
├─ packages/
│  ├─ shared/          # shared DTOs, Zod schemas, constants, i18n, UI primitives
│  └─ database/        # Drizzle schema, migrations, seed, DB client
├─ docs/
│  ├─ storefront-erp-spec.md
│  ├─ mobile-app-plan.md
│  └─ docker.md
└─ package.json
```

Repository boundaries:
- `apps/api` owns all backend behavior for storefront, ERP, and mobile, organised by domain module (`catalog`, `checkout`, `orders`, `cart`, `wishlist`, `reviews`, `payments`, `shipping`, `shop-media`, `announcements`, `uploads`, `auth`, `admin`, `app-policy`), with shared cross-cutting services at the app root.
- `apps/storefront` must not contain ERP pages; `apps/erp` must not contain storefront customer pages. The ERP organises code per business module (pages, then module features/components/hooks).
- Public catalog modules and ERP admin modules stay separate; they may only share explicitly shared mappers/helpers.
- ERP features do not import each other. Offers and collections share the bundle editor/list implementation. Reusable components live in the ERP shared component folders, reusable hooks in the ERP hooks folder, and reusable helpers/store/API access in the ERP lib folder. Cross-folder imports use the `@/` alias; relative imports stay within a folder.
- `apps/mobile` is an Expo Router client reusing the storefront contracts, its own auth token store, cart, i18n, media, and persistence modules.
- `packages/shared` holds shared DTOs, Zod validation schemas, constants, i18n dictionaries, business-safe types, shared UI primitives, and the shared HTTP base client. Per-app `components/ui` folders hold only app-specific primitives.
- `packages/database` holds the Drizzle schema, relations, migrations, seeds, and the DB client.
- Tests live outside `src` in each app (`tests/{unit,routes,services,modules,contracts}` for the API; `tests/{app,components,features,hooks,lib}` for the frontends; `__tests__` plus `e2e` for mobile). Feature tests live under the feature folder even when the tested page lives in the app routes folder.
- Build artifacts (`node_modules`, `dist`, `.next`, `.turbo`), editor folders, and local env files are not part of the tracked layout.

Architecture rules:
- The storefront must read data through the API only.
- The storefront must not read MySQL directly.
- The ERP must manage data through the API only.
- The ERP must not read or write MySQL directly from the frontend.
- Shared business-safe schemas, DTOs, constants, i18n dictionaries, and shared types live in `packages/shared`.
- Database schema, migrations, seed, and DB client live in `packages/database`.
- Storefront API routes are mounted under `/api/v1`; ERP API routes are mounted under `/api/erp` and stay separated.
- The root router composes both route groups plus `/health` and `/app-config`; the carrier webhook is mounted ahead of the general JSON body parser, and local media is served from `/uploads`.
- ERP resource routes sit behind the staff auth guard; privileged reads and mutations are further gated by the ERP permission middleware and service.
- Storefront routes use customer auth where required (wishlist, cart sync, customer orders); provider callbacks use their own signature verification.
- `GET /health` at the API root reports DB reachability and is cached `no-store`.
- ERP catalog mutations trigger storefront ISR revalidation through the storefront revalidation endpoint.
- Frontend API clients may stay centralized in `client.ts` until splitting creates real value; splitting them is optional, not required.
- Do not collapse `storefront`, `erp`, and `api` into fewer apps without an explicit product decision.
- Do not expose staff management or permission editing without the API-side permission enforcement.

## API Surface

Storefront routes (`/api/v1`, locale middleware + feature-compatibility gate applied):
- `/auth` — signup, login, refresh, logout
- `/products` — list and product-by-slug
- `/categories`, `/offers`, `/offers/:slug`
- `/collections`, `/collections/:slug`
- `/cart` — customer cart sync
- `/wishlist`
- `/orders` — customer order list, detail, cancel
- `/checkout` — submit, shipping availability, shipping quote, status polling, retry
- `/payments/paymob` — provider callbacks
- `/reviews` — list, submit, prompt claim
- `/advices`, `/announcements`, `/shop-media-sections`

ERP routes (`/api/erp`):
- `/auth` — staff login/refresh/logout (public).
- Everything else requires a staff session; each route additionally requires a permission from the `erp-permissions` model.

App policy:
- `GET /app-config` returns the mobile release registry: current/previous release per platform, recommended update, and the minimum feature requirements a client must meet. The registry is driven by `APP_RELEASE_POLICY_JSON` with a built-in prelaunch default; storefront traffic passes through the same feature-compatibility gate so a client that is below the required release sees the reduced feature set rather than a broken experience.

## Languages

Storefront language rules:
- Storefront supports `ar` and `en`.
- Storefront routes are locale-prefixed (`/[lang]/...`); `/` redirects to the default locale.
- Static content supports both languages through `packages/shared/src/i18n`.
- Dynamic content supports Arabic and English fields where relevant.
- The API applies a locale middleware and uses the `x-lang` request header where response shaping is language-specific.
- If English storefront text is missing, storefront may fall back to Arabic.

Dynamic content rules:
- Products, categories, offers, collections, advices, announcements, and shop media store bilingual storefront-facing fields.
- API DTOs may return localized display fields based on `x-lang`, but ERP/admin DTOs must preserve both Arabic and English fields.

Search language rule:
- Search is based on the query language, not the current website language.
- The API picks the Arabic name column for queries containing Arabic characters and the English name column otherwise, and always also matches the shared keywords column.
- Mixed search should be handled pragmatically by matching both Arabic and English searchable fields.

ERP language rules:
- ERP UI is Arabic-only for v1 and future versions unless explicitly changed.
- ERP must allow entering bilingual storefront-facing product/category/offer/collection content where required.

## Authentication

### ERP

ERP auth rules:
- Multiple ERP staff accounts are stored in the database (`admin_users`), each with a role (`admin`/`staff`) and an explicit permission set (`permissions`, `admin_user_permissions`).
- The first administrator is provisioned from `ADMIN_EMAIL`/`ADMIN_PASSWORD` at startup; there are no hardcoded test credentials in the authentication path. Runtime secrets (JWT secrets) fall back to development values only outside production and fail closed in production.
- Standard login screen, with refresh-token session rotation.
- `/api/erp/*` rejects unauthenticated requests.
- Permission checks are applied per route (`requireErpPermission`).
- Staff management (create/edit/deactivate staff and assign permissions) is an ERP module.
- No audit log in v1.

### Storefront Customers

Customer auth rules:
- Signup supported.
- Login supported.
- Immediate login after signup.
- No email verification in v1.
- No forgot/reset password in v1.
- Passwords are hashed with bcrypt.
- Access model: short-lived JWT access token plus a rotating refresh session stored hashed in `auth_sessions`. The refresh token is set as an HTTP-only secure cookie for browsers; native mobile clients receive the refresh token in the response body instead.

Signup fields:
- name
- email
- password

Guest behavior:
- Guest checkout is allowed.
- Guest checkout is allowed even if the email already belongs to an existing account.

Wishlist auth rule:
- Wishlist requires login.
- If guest clicks wishlist:
  - show warning that wishlist requires login
  - provide redirect button/link to `/login`

## Storefront Routes

All storefront pages live under `/[lang]`.

Confirmed routes:
- `/[lang]/shop` — storefront home (the main product experience)
- `/[lang]/products` — all-products listing
- `/[lang]/products/[slug]`
- `/[lang]/new`
- `/[lang]/bestsellers`
- `/[lang]/search`
- `/[lang]/category/[slug]`
- `/[lang]/collections`
- `/[lang]/collections/[slug]`
- `/[lang]/offers`
- `/[lang]/offers/[slug]`
- `/[lang]/cart`
- `/[lang]/checkout`
- `/[lang]/checkout/payment-result`
- `/[lang]/orders`
- `/[lang]/orders/[id]`
- `/[lang]/wishlist`
- `/[lang]/login`
- `/[lang]/signup`
- `/[lang]/about`, `/[lang]/contact`
- `/[lang]/privacy-policy`, `/[lang]/terms-conditions`, `/[lang]/terms-of-sale`, `/[lang]/returns-refunds`, `/[lang]/shipping-handling`

Route behavior:
- `/` redirects to `/[defaultLanguage]`, which redirects to `/[lang]/shop`.
- `/[lang]/shop` is the storefront home: product listings plus curated offer/collection cards, shop media sections, and advice content.
- `/[lang]/products` is the full all-products listing with filters, sorting, and search.
- `/[lang]/category/[slug]` shows a category-filtered product listing including descendant products.
- `/[lang]/search` is the query-driven listing.
- `/[lang]/offers` shows visible offers.
- `/[lang]/offers/[slug]` shows a purchasable offer details page when the offer is visible.
- `/[lang]/orders` and `/[lang]/orders/[id]` require login.
- `/robots.ts` and `/sitemap.ts` are generated from storefront catalog data.

Homepage rule:
- The main page is the e-commerce shop page.
- No separate marketing homepage is required in v1.

## Storefront Features

Confirmed storefront features:
- Arabic/English support for static and dynamic data.
- Search.
- Filters.
- Sorting.
- Cart.
- Wishlist.
- Checkout.
- Offers browsing.
- Collections browsing.
- Category browsing.
- Product and bundle reviews with ratings.
- Announcements bar.
- Advice (video) content.
- Shop media sections (banners/rows with Arabic and English, desktop and mobile imagery).

Search rules:
- The API supports server-side search by `q`, matching Arabic or English product names (per query language) plus keywords.
- The listing UI additionally matches the already-loaded set client-side so header search previews and the grid agree.

Filter rules:
- Category (hierarchical, includes descendants).
- Price range (min/max, matched against the minimum variant price).
- `New` and `Bestseller` are separate curated pages, not filters inside the grid.
- Price filtering remains client-side while data size is small.
- Sorting remains client-side while data size is small: default (server order), newest, price ascending, price descending, name.

Product card/detail behavior:
- Product URLs are slug-based.
- Product detail page includes breadcrumb.
- Product detail page includes offer badges when the product variant is included in a visible offer.
- Hover images (Arabic and English variants) are supported for cards.
- Buying price is never exposed in storefront DTOs.

Wishlist rules:
- Logged-in users only.
- Stored in database.
- Persists across devices/accounts.
- Wishlist stores products, offers, and collections.

Cart rules:
- Works for guests and logged-in users.
- The cart is always persisted in local storage, so guests and signed-out browsing keep working offline of the API.
- When a customer is signed in, the cart additionally syncs to the DB-backed cart (`PUT/GET /api/v1/cart`). On sign-in, unsynced local additions are merged into the server cart; local lines from a previously signed-in account are never merged into another account.
- Cart item IDs use DB variant IDs, offer IDs, and collection IDs.
- Cart lines are pruned against live catalog data when the catalog loads.
- Stock and prices are validated again at checkout on the server.

## Checkout

Checkout method:
- Cash on Delivery and PayMob hosted checkout for cards and Egyptian mobile wallets.

Removed from v1:
- Other online payment gateways and saved-card flows remain deferred.

Checkout customer types:
- guest
- registered

Required checkout fields:
- full name
- phone
- email
- governorate
- city/area
- address line
- building/apartment
- payment method
- items

Optional checkout fields:
- notes
- shipping address (city/zone/district selection) when carrier shipping is enabled

Validation rules:
- Required checkout fields must be present.
- Phone number must follow Egyptian phone number format.
- Currency is `EGP` only.
- API computes prices from the database and ignores frontend-submitted prices.
- Checkout requires an `Idempotency-Key` header; retries with the same key return the same result.
- Shipping cost is computed from a carrier quote when shipping is enabled, and is `0` when the store is running without carrier shipping.
- Tax/VAT is ignored.

Checkout flow:
- Checkout is modeled as a checkout session: the cart is snapshotted, stock is reserved, and the session moves through `open → payment_pending → completed/failed/expired`.
- Stock is re-validated and deducted server-side from the reserved quantities.
- Cash on Delivery order payment status starts as `pending`.
- Registered checkout links the order to `customerId`.
- Guest checkout does not require or create a customer account.
- Checkout supports product variant lines, offer lines, and collection lines.
- Shipping fees are quoted before submit (`POST /api/v1/checkout/shipping/quote`) and snapshotted on the order as an immutable quote (charge, quote id, estimated shipment size). The server re-derives the quote on submit and rejects mismatches.
- After submitting, the storefront polls `GET /api/v1/checkout/:checkoutId/status`; unpaid sessions can be retried (`POST /api/v1/checkout/:checkoutId/retry`) while stock remains reserved.

## Payments

Paymob lifecycle:
- Paymob is the selected and implemented card/wallet provider. Checkout initiation creates a payment attempt (max 3 per session) bound to the checkout session.
- Provider callbacks are received on `/api/v1/payments/paymob`, HMAC-verified, durably recorded in a callback inbox before processing, and processed idempotently.
- Provider payment status is stored separately from the staff-facing `payment_status` (`pending`, `accepted`, `denied`) as `provider_payment_status` (`pending`, `succeeded`, `failed`, `partially_refunded`, `refunded`, `voided`).
- Missing or unresolvable callbacks are retried by a reconciliation worker and can be requeued by staff from the ERP reconciliation page.
- A paid Paymob order cannot be manually denied unless it is refunded at the provider.
- Paymob payment status is provider-managed; staff may only move an order to `denied`, which triggers cancellation/stock restoration.

## Orders

Order storage is required in the database.

Order identifiers:
- Every order gets a human-readable `orderCode` of the form `ABCD-123` (four letters derived from the order ID plus a zero-padded ID). A temporary `PEND-...` code exists only inside the creation transaction.

ERP order management:
- The order list displays the email entered at checkout and supports searching by that email, customer name, phone, or order code.
- The detail page shows customer/account information, the complete delivery address, customer notes, item snapshots and quantities, original and discounted prices, totals, refunds, and the net amount after refunds. Monetary values preserve piastres.
- Paymob orders show available transaction/order references, payment method, test/live environment, integration and merchant references, and the linked payment attempt. Checkout credentials are never included in this payment detail response.
- Recorded creation/update times and the pending Cash on Delivery review deadline are shown in Cairo time.
- Authorized staff can update Cash on Delivery payment status (`orders.update_payment_status`). For orders with carrier shipping, payment status is managed by the shipping pipeline instead.
- Order review flags (address review, expiry review, refund review, amount mismatch, custody review, cancellation pending, untouched paid) can be listed and resolved by staff.

Storefront order management:
- Storefront customers have an order list and detail page backed by the same order contract.
- Customers can request cancellation of their own eligible order; fulfilment state, shipping, and payment status remain read-only for them.

Shipping and fulfilment:
- Orders with carrier shipping are queued as shipping work items and dispatched through Bosta.
- Staff can create/retry/reconcile a delivery, edit a shipment, record a manual shipping state, request cancellation, and run bulk shipping actions.
- Provider state is normalized (`created`, `picked_up`, `in_transit`, `delivered`, `returned`, `cancelled`, `exception`) and combined with a staff `manual_state` history.
- Returned is reported by the carrier, not writable by staff.
- A paid order that is never touched raises a staff review flag at the fixed 96-hour deadline.

Minimum order data:
- customer type
- linked customer account when order is placed by a logged-in customer
- customer name
- customer email
- customer phone
- address fields
- order items
- payment method
- payment status
- total amount
- created time

Order item rules:
- Orders must support product variant items, offer items, and collection items.
- Order items store enough snapshot data to preserve order history if product/offer names, prices, or discounts change later.
- Snapshot fields include: item type, product/offer/collection ID where applicable, variant ID where applicable, Arabic and English display names, size label when applicable, base unit price, applied discount, quantity, line total, and expanded bundle components.

## Catalog Model

### Products

Product rules:
- A product represents one sellable item family.
- Variants are size-based only in v1.
- Each product belongs to exactly one category.
- Product status is only:
  - `active`
  - `inactive`
- `active` means visible on storefront.
- `inactive` means hidden from storefront.
- Soft delete is required.
- `New` and `Bestseller` are not categories.
- `New` is a manual product flag surfaced as the `/new` page.
- `Bestseller` is a manual product flag surfaced as the `/bestsellers` page.

Product fields:
- database ID
- SKU
- slug
- Arabic name
- English name
- buying price
- keywords
- Arabic description
- English description
- Arabic ingredients
- English ingredients
- Arabic how to use
- English how to use
- Arabic warnings
- English warnings
- YouTube video link
- main image path
- hover image path (Arabic and English)
- media list (images and video, bilingual image URLs)
- status
- category reference
- manual `isNew` flag
- manual `isBestseller` flag
- created timestamps
- updated timestamps
- soft delete fields

Identity rules:
- DB ID is internal numeric index.
- SKU is a separate unique business field.
- SKU is required when saving a product.
- Example SKU format: `BODY-LOTION-ROSE-200ML`.
- SKU is used in invoices, reports, orders, and business references.

Slug rules:
- Product slug is generated once from English name.
- Once created, the slug remains unchanged even if the English name changes.

Publishing and activation rules:
- A product is saved as a complete record; there is no separate partial-draft persistence layer. Incomplete content is saved as `inactive`.
- Activation is gated server-side: a product cannot be toggled to `active` until it has an Arabic name, an English name, a category, at least one image, at least one keyword, and at least one variant.

Required fields for activation:
- Arabic name
- English name
- category selection
- image
- keywords
- at least one size variant

Optional for activation:
- descriptions
- ingredients
- how-to-use
- warnings
- YouTube URL
- hover images

### Product Variants

Variant rules:
- Variants represent sizes only.
- Each variant has its own selling price.
- Each variant has its own stock quantity.
- Stock is an integer; negative stock is rejected.
- If variant stock is `0`, add-to-cart is blocked for that variant.
- Stock editing in v1 is direct-number editing only.
- No stock movement history in v1.
- A variant may carry an optional time-boxed discount (percentage or fixed) that is snapshotted onto order lines at purchase time.
- Removing a variant that is linked to an offer is blocked. A removed variant that was already sold is soft-deleted (it stays in order history); a removed variant with no sales and no offer link is hard-deleted.

Variant fields:
- variant ID
- product ID
- size label such as `100ml`, `200ml`
- selling price
- stock quantity
- optional sort order
- optional discount

Display rules:
- Storefront cards/lists show price range when a product has multiple variant prices.
- ERP list shows price range or equivalent range display.

Availability rules:
- Product remains visible if active and non-deleted.
- If all variants are out of stock and product is active:
  - storefront still shows the product page
  - product is marked out of stock
  - add-to-cart is blocked

### Categories

Category rules:
- Categories are hierarchical: parent, child, grandchild, and deeper levels if needed.
- Category CRUD is allowed.
- The initial business category tree is documented in this spec and seeded by `packages/database/src/seeds`.
- ERP product form uses chained dropdowns.
- Product must belong to exactly one category.
- Category slug is generated from English name.
- Category slug remains unchanged after creation.
- Soft delete is required.
- Category ordering is explicitly managed and persisted.
- `All` is not a database category. It is UI text meaning no category filter.
- `New` and `Bestseller` are not database categories.

Category storefront behavior:
- Category pages/filters include descendant products.
- Selecting a leaf category shows products directly assigned to that leaf.

Delete protection:
- If a category or any descendant category has linked products, it cannot be deleted.
- If a category has active child categories, it cannot be deleted.
- ERP should show a warning telling the admin to move linked products or child categories first, then retry deletion.

### Offers

Offer rules:
- Offers are fixed-price bundles.
- Offers are purchasable as their own sellable entities.
- An offer can contain multiple products through variant-specific items.
- Offer composition is variant-specific, not product-generic.
- A product/variant may belong to multiple offers.
- Every offer must belong to exactly one category; the ERP form selects a root category. Offers created before categories existed were deactivated by migration and never reach the storefront.
- No active scheduling in v1, but an offer may carry an optional time-boxed bundle discount.
- Soft delete is required.

Offer visibility/status rules:
- Offers have a status control (`active`/`inactive`) and a visibility control (`visible`/`hidden`) in ERP.
- Only `active` + `visible` + non-deleted offers appear on storefront, including when out of stock.
- Out-of-stock visible offers are shown as out of stock and cannot be purchased.

Offer fields:
- database ID
- slug
- Arabic name
- English name
- Arabic description
- English description
- YouTube link
- main image path
- hover image path (Arabic and English)
- media list
- fixed selling price
- computed original total for display
- status/visibility
- root category
- included variants with quantities
- optional bundle discount
- created timestamps
- updated timestamps
- soft delete fields

Offer slug rules:
- Generated once from English name.
- Remains unchanged after creation.

Offer stock rules:
- Offer is purchasable only if all included variants have enough stock.
- When an offer is bought, included variant stock is deducted by the exact included quantity multiplied by the purchased quantity.

Offer storefront rules:
- `/offers` lists visible offers.
- `/offers/[slug]` shows visible offer detail page.
- Offer has its own image, slug, detail page, rating, and reviews.

### Collections

Collection rules:
- Collections are fixed-price bundles with the same shape and behavior as offers: variant-specific composition, fixed price, status/visibility, own slug, image, hover images, media list, optional time-boxed bundle discount, soft delete, own detail page, ratings, and reviews.
- A collection must belong to exactly one category.
- A product/variant may belong to multiple collections.

### Related Items

- Products, offers, and collections can be linked to each other with an explicit ordered relation.
- ERP manages the links; storefront renders them on detail pages.

## Advices, Announcements, Shop Media

Advices:
- Video-only editorial content with Arabic/English title and description, an `active`/`inactive` status, and manual ordering.
- Managed in ERP and rendered on the storefront shop page.

Announcements:
- A single announcement bar with ordered bilingual strings and an on/off setting, plus a global bar status.
- Managed in ERP and rendered at the top of the storefront.

Shop media:
- Ordered, on/off media sections ("slots") with per-item bilingual desktop and mobile images and a target (shop, new, bestsellers, products, a specific product, offers, a specific offer, collections, a specific collection, or a category).
- Managed in ERP and rendered on the corresponding storefront pages.

Recipes:
- Keep empty for now.

Socials:
- Keep empty for now.

Branches:
- Keep empty for now.
- Branches are informational only in v1.

## Reviews

- A customer can review a product, offer, or collection they purchased; each customer has at most one review per entity.
- Ratings are 1–5 and comments are length-checked at the database level.
- Storefront lists public active reviews and ratings, and prompts eligible customers to review delivered items (a prompt is claimed once per customer/order).
- ERP can list reviews and change their status, soft-delete, restore, and permanently delete them.

## ERP Modules

Confirmed v1 ERP modules:
- dashboard
- products
- categories
- offers
- collections
- orders (list, detail, payment status, reconciliation)
- shipping (overview, dispatch, manual states, cancellation, edits, flags, bulk actions)
- sales
- reviews
- discounts
- advices
- announcements
- shop media
- staff management
- trash (restore / permanently delete)

Deferred modules:
- recipes
- socials
- physical branches
- supplier management
- purchase orders
- accounting
- reporting beyond basic lists and sales summaries

ERP permissions:
- Access is granted per permission key, grouped by module: `products.*`, `categories.*`, `offers.*`, `collections.*`, `orders.*`, `shipping.*`, `sales.read`, `discounts.manage`, `reviews.*`, `advices.*`, `shop_media.*`, `staff.*`, `trash.read`, `dashboard.read`.
- Create vs update is distinguished so a read-only or create-only staff account is possible.
- Delete is split into `soft_delete`, `restore`, and `permanent_delete`.

### ERP Products Module

Required capabilities:
- create product
- edit product
- activate/deactivate product
- soft delete, restore, and permanently delete product
- upload/replace product image, hover images, and media
- manage product variants
- manage stock by direct numeric edit
- manage per-variant discounts
- manage manual `isNew` flag
- manage manual `isBestseller` flag
- reorder products within a scope

ERP product form behavior:
- category selection uses chained dropdowns
- one category only
- media list plus a primary image
- variant sizes only

ERP product list required columns:
- image
- Arabic name
- English name
- SKU
- category
- status
- price range
- stock summary

Soft delete behavior:
- Soft-deleted products disappear from default list.
- Admin can view them through trash/deleted filtering.
- A product cannot be soft- or hard-deleted while any of its variants is linked to an offer or a collection, or while it has been sold; it must be unlinked first. This protection is intentional and applies to both soft delete and permanent delete.

### ERP Categories Module

Required capabilities:
- create category
- edit category
- reorder categories
- delete category when safe
- soft delete, restore, and permanently delete category

ERP category constraints:
- Categories may evolve later.
- Do not hard-freeze category editing in the system.
- Enforce delete protection for linked products and active child categories.

### ERP Offers Module

Required capabilities:
- create offer
- edit offer
- reorder offers
- activate/hide offer
- soft delete, restore, and permanently delete offer
- upload/replace offer image, hover images, and media
- select included variants and quantities
- set an optional bundle discount

Offer image behavior:
- Uploading a new image replaces the old image reference.
- Deleting the old physical image file is not required when the reference is replaced; physical files are cleaned up when the record is permanently deleted.

### ERP Collections Module

Required capabilities:
- create collection
- edit collection
- reorder collections
- activate/hide collection
- soft delete, restore, and permanently delete collection
- upload/replace collection image, hover images, and media
- select included variants and quantities
- set an optional bundle discount

## Media Storage

Image and media storage rules:
- Uploads are sent to the API as base64 payloads on `/api/erp/uploads` and stored by the API under its local uploads directory, served back as public URLs.
- Storage details live behind the uploads service module; `HOSTINGER_PUBLIC_BASE_URL` overrides the public base URL when a hosted uploads location is used.
- Max upload size defaults to 20MB and is configurable via `UPLOAD_MAX_BYTES`.
- Allowed types: PNG, JPG/JPEG, WEBP images and MP4/WEBM video, configurable via `UPLOAD_ALLOWED_MIME_TYPES`.
- Product and collection media lists are ordered and bilingual (image URLs per language, or a single video URL).
- Products, offers, and collections each keep a primary image reference derived from the first image in their media list.
- Uploading a new image replaces the previous image reference.
- Physically deleting old files on replacement is not required; files are removed when the owning record is permanently deleted.

## Search and Filtering Rules

Search:
- Server-side search is available on the products endpoint via `q`.
- Search matches product names in the query language plus keywords.
- Search follows the query language rather than only the active storefront language.
- The listing UI also filters the loaded set client-side so header search and the grid agree.

Keywords:
- Stored for search use.
- Not required to appear visually on storefront.

Filters:
- category (hierarchical, includes descendants)
- price range
- `New` and `Bestseller` curated pages

Price filtering:
- Client-side in v1 while data size is small.

Sorting:
- Client-side in v1 while data size is small: default, newest, price ascending/descending, name.

## Deletion and Visibility Rules

Soft delete is required for:
- products
- categories
- offers
- collections
- reviews

ERP default list behavior:
- Soft-deleted items are hidden from default lists.
- Deleted items appear through a trash/deleted filter.
- Trash also allows restoring a soft-deleted item or permanently deleting it; permanent deletion is refused while linked records (offers, collections, orders) still reference the item.

Storefront visibility rules:
- Only active, visible, and non-deleted records are visible where applicable.
- Inactive products are hidden.
- Hidden or inactive offers and collections are hidden.
- Visible offers and collections can still appear when out of stock.
- Deleted records are hidden.

## Deferred / Explicitly Out of Scope

The following are intentionally not part of the current scope:
- forgot password
- reset password
- email verification
- audit logs
- supplier management
- purchase orders
- accounting
- tax/VAT handling
- barcode support
- purchase history for buying price
- stock movement history
- non-size product variants
- customer saved addresses page
- delivery time estimation (shipping quotes return price and size, not an ETA)

## Initial Category Tree

This is the initial intended category structure, seeded by `packages/database/src/seeds`. `cat.txt` is not required and should not be treated as a source file.

### Main Categories

- Body Care
- Skin Care
- Hair Care
- Men's
- Kid's
- Organic Oils
- Soap
- Candles
- Fragrances
- Fresheners
- Makeup
- Accessories & Tools

### Body Care

- Body Lotion
- Body Mist
- Body Oils
- Body Cream
- Body Butter
- Hand Care
- Foot Care
- Body Scrub
- Bubble Bath
- Body Wash & Shower Gel

### Skin Care

- Skin Serum
- Skin Oils
- Skin Cream
- Barrier Cream
- Exfoliators & Peels
- Cleansers & Toners
- Face Masks
- Eye Care
- Lip Care
- Skin Treatments
- Skincare Routines
- By Skin Type

### Skin Care > By Skin Type

- Oily Skin
- Dry Skin
- Combination Skin
- Sensitive Skin
- Normal Skin

### Hair Care

- Hair Serum
- Hair Oils
- Hair Masks
- Hair Tonic
- Shampoo
- Conditioner
- Hair Treatments
- Hair Routines
- By Hair Type

### Hair Care > By Hair Type

- Dry Hair
- Oily Hair
- Frizzy Hair
- Damaged Hair

### Makeup

- Foundations & Concealers
- Lips
- Eyeliners & Eyebrows
- Cheeks
- Bronzing

### Fragrances

- For Her
- For Him

### Accessories & Tools

- Body
- Skin
- Hair

## Open Flags

These require future product/technical decisions beyond the current scope:
- Whether delivery-time estimation should be added to shipping quotes.