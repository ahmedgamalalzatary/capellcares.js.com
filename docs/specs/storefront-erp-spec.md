# Minikoshk Storefront + ERP Specification

## Summary

This document is the product and architecture source of truth for the Minikoshk storefront and ERP system.

Locked stack:
- `Next.js` for the storefront.
- `Next.js` for the ERP frontend.
- `Express.js` for the backend API.
- `MySQL` as the shared database.
- `Drizzle ORM` for schema, migrations, seeds, and database access.
- One monorepo.

Core business rules:
- Storefront reads data from the ERP-backed API.
- ERP manages catalog data through the API.
- Storefront and ERP share one MySQL database.
- Storefront only sees the public, storefront-safe subset of data.
- ERP controls the full catalog model.
- Static UI translation is centralized in `packages/shared/src/i18n` for now.
- Dynamic storefront content is stored as bilingual data and served by API DTOs.

## Architecture

Recommended monorepo shape:

```text
minikoshk/
├─ apps/
│  ├─ storefront/      # Next.js customer-facing app
│  ├─ erp/             # Next.js Arabic-only ERP/admin app
│  └─ api/             # Express.js API for storefront + ERP
├─ packages/
│  ├─ shared/          # shared DTOs, Zod schemas, constants, i18n, safe types
│  └─ database/        # Drizzle schema, migrations, seed, DB client
├─ docs/
│  ├─ storefront-erp-spec.md
│  ├─ folder-structure.md
│  └─ bugs.md
└─ package.json
```

Architecture rules:
- The storefront must read data through the API only.
- The storefront must not read MySQL directly.
- The ERP must manage data through the API only.
- The ERP must not read or write MySQL directly from the frontend.
- Shared business-safe schemas, DTOs, constants, i18n dictionaries, and shared types live in `packages/shared`.
- Database schema, migrations, seed, and DB client live in `packages/database`.
- Storefront API and ERP API route groups must remain separated.
- Frontend API clients may stay centralized in `client.ts` until splitting creates real value.

## Languages

Storefront language rules:
- Storefront supports `ar` and `en`.
- Static content supports both languages through `packages/shared/src/i18n`.
- Dynamic content supports Arabic and English fields where relevant.
- API responses should use `x-lang` where response shaping is language-specific.
- If English storefront text is missing, storefront may fall back to Arabic.

Dynamic content rules:
- Products, categories, and offers store bilingual storefront-facing fields.
- API DTOs may return localized display fields based on `x-lang`, but ERP/admin DTOs must preserve both Arabic and English fields.

Search language rule:
- Search is based on the query language, not the current website language.
- Arabic queries should match Arabic names/keywords.
- English queries should match English names/keywords.
- Mixed search should be handled pragmatically by matching both Arabic and English searchable fields.

ERP language rules:
- ERP UI is Arabic-only for v1 and future versions unless explicitly changed.
- ERP must allow entering bilingual storefront-facing product/category/offer content where required.

Activation rule:
- Draft data may be partial.
- Exact draft persistence schema is an open implementation decision.
- Until draft persistence is fully specified, implementation should enforce activation rules and avoid overbuilding draft behavior.
- A record cannot be activated until required storefront fields are complete.

## Authentication

### ERP

ERP auth rules:
- One ERP user only in v1.
- One role only: `admin`.
- Admin user is stored in the database.
- Standard login screen.
- `/api/erp/*` must reject unauthenticated requests.
- Hardcoded test credentials may temporarily remain for development only, must be clearly flagged with warnings, and must not be treated as production auth.
- No role matrix in v1.
- No audit log in v1.

### Storefront Customers

Customer auth rules:
- Signup supported.
- Login supported.
- Immediate login after signup.
- No email verification in v1.
- No forgot/reset password in v1.
- Passwords must be hashed with a suitable password-hashing algorithm such as bcrypt or Argon2.
- Preferred auth approach: JWT access token plus refresh token stored in an HTTP-only secure cookie, with server-side verification for protected API routes.

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

Confirmed routes:
- `/`
- `/products`
- `/products/[slug]`
- `/category/[slug]`
- `/offers`
- `/offers/[slug]`
- `/cart`
- `/checkout`
- `/wishlist`
- `/login`
- `/signup`

Route behavior:
- `/` redirects to the main product listing experience.
- `/products` exists as the all-products listing.
- `/category/[slug]` shows a category-filtered product listing.
- `/offers` shows visible offers.
- `/offers/[slug]` shows a purchasable offer details page when the offer is visible.

Homepage rule:
- The main page is the e-commerce product page.
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
- Category browsing.

Search rules:
- Search is server-side.
- Search matches product names and keywords.
- Search language follows the query language, not strictly the current storefront language.

Filter rules:
- Category.
- Price.
- Price filtering may remain client-side in v1 while data size is small.
- Sorting may remain client-side in v1 while data size is small.

Product card/detail behavior:
- Product URLs are slug-based.
- Product detail page includes breadcrumb.
- Product detail page includes offer badges if the product variant is included in one or more visible offers.
- Buying price is never visible on storefront.

Wishlist rules:
- Logged-in users only.
- Stored in database.
- Persists across devices/accounts.
- Wishlist stores products only, not offers.

Cart rules:
- Works for guests and logged-in users.
- Stored in local storage in v1.
- No DB-backed cart in v1.
- Cart item IDs use DB variant IDs and offer IDs.
- Stock is validated again at checkout.

## Checkout

Checkout method:
- Cash on Delivery only in v1.

Removed from v1:
- PayMob and online payment integration are intentionally removed from current documentation and implementation scope until a separate careful payment plan exists.

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

Validation rules:
- Required checkout fields must be present.
- Phone number must follow Egyptian phone number format.
- Currency is `EGP` only.
- API computes prices from the database and ignores frontend-submitted prices.
- Shipping cost is ignored in v1.
- Tax/VAT is ignored in v1.

Checkout flow:
- Checkout creates an order record in the database.
- Cash on Delivery order payment status starts as `pending`.
- Registered checkout links the order to `customerId`.
- Guest checkout does not require or create a customer account.
- Checkout supports product variant lines and offer lines.

Known v1 limitation:
- Orders are saved in DB.
- ERP order-management UI is intentionally not implemented yet.

## Orders

Order storage is required in the database even though ERP order management is deferred.

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
- Orders must support product variant items and offer items.
- Order items should store enough snapshot data to preserve order history if product/offer names or prices change later.
- Suggested snapshot fields: item type, product/offer ID where applicable, variant ID where applicable, display name, size label when applicable, unit price, quantity, line total.

Current v1 decision:
- Save orders in DB only.
- Do not build ERP orders module in v1.
- Do not build customer order history in v1.

## Catalog Model

### Products

Product rules:
- A product represents one sellable item family.
- Variants are size-based only in v1.
- No other variant dimensions in v1.
- Each product belongs to exactly one leaf category.
- Each product has one main image only.
- Product status is only:
  - `active`
  - `inactive`
- `active` means visible on storefront.
- `inactive` means hidden from storefront.
- Soft delete is required.
- `New` and `Bestseller` are not categories.
- `New` is a product badge/filter based on manual flag plus created-date logic.
- `Bestseller` is a manual product flag in v1.

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
- status
- leaf category reference
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

Publishing rules:
- Product can be saved as partial draft/incomplete record.
- Exact draft schema is unresolved.
- Product cannot be activated until required activation fields are complete.

Required fields for activation:
- Arabic name
- English name
- SKU
- buying price
- at least one size variant
- category selection
- keywords
- photo

Optional for activation:
- descriptions
- ingredients
- how-to-use
- warnings
- YouTube URL

### Product Variants

Variant rules:
- Variants represent sizes only.
- Each variant has its own selling price.
- Each variant has its own stock quantity.
- Stock is an integer.
- Negative stock is blocked at API/database validation level.
- If variant stock is `0`, add-to-cart is blocked for that variant.
- Stock editing in v1 is direct-number editing only.
- No stock movement history in v1.

Variant fields:
- variant ID
- product ID
- size label such as `100ml`, `200ml`
- selling price
- stock quantity
- optional sort order

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
- The initial business category tree is documented in this spec.
- ERP product form uses chained dropdowns.
- Product must belong to exactly one leaf category.
- Category slug is generated from English name.
- Category slug remains unchanged after creation.
- Soft delete is required.
- `All` is not a database category. It is UI text meaning no category filter.
- `New` and `Bestseller` are not database categories.

Category storefront behavior:
- Category pages/filters include descendant products.
- Example: selecting `Body Care` shows products assigned to `Body Lotion`, `Body Butter`, and other descendants.
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
- No start/end date in v1.
- No active scheduling in v1.
- Soft delete is required.

Offer visibility/status rules:
- Offers have a visibility/status control in ERP.
- Visible offers appear on storefront even if out of stock.
- Hidden offers do not appear on storefront even if they have stock.
- Out-of-stock visible offers are shown as out of stock and cannot be purchased.

Offer fields:
- database ID
- slug
- Arabic name
- English name
- Arabic description
- English description
- main image path
- fixed selling price
- computed original total for display
- visibility/status
- included variants with quantities
- created timestamps
- updated timestamps
- soft delete fields

Offer slug rules:
- Generated once from English name.
- Remains unchanged after creation.

Offer stock rules:
- Offer is purchasable only if all included variants have enough stock.
- When an offer is bought, included variant stock is deducted.
- If included quantity is greater than `1`, deduct the exact quantity.
- Example: if bundle includes `2` units of the same variant, purchasing the offer deducts `2`.

Offer storefront rules:
- `/offers` lists visible offers.
- `/offers/[slug]` shows visible offer detail page.
- Offer has its own image, slug, and detail page.

## Recipes, Socials, Branches

Recipes:
- Keep empty for now.

Socials:
- Keep empty for now.

Branches:
- Keep empty for now.
- Branches are informational only in v1.

## ERP Modules

Confirmed v1 ERP modules:
- products
- categories
- offers

Deferred modules:
- recipes
- socials
- physical branches
- order management
- supplier management
- purchase orders
- accounting
- reporting beyond basic lists

### ERP Products Module

Required capabilities:
- create product
- edit product
- activate/deactivate product
- soft delete product
- upload/replace product image
- manage product variants
- manage stock by direct numeric edit
- manage manual `isNew` flag
- manage manual `isBestseller` flag

ERP product form behavior:
- category selection uses chained dropdowns
- one leaf category only
- one image only
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

### ERP Categories Module

Required capabilities:
- create category
- edit category
- delete category when safe
- soft delete category

ERP category constraints:
- Categories may evolve later.
- Do not hard-freeze category editing in the system.
- Enforce delete protection for linked products and active child categories.

### ERP Offers Module

Required capabilities:
- create offer
- edit offer
- hide/show offer
- soft delete offer
- upload/replace offer image
- select included variants and quantities

Offer image behavior:
- Uploading a new image replaces the old image reference.
- Deleting the old physical image file is not required in v1.

## Media Storage

Image storage rules:
- Target storage is Hostinger file storage.
- Implementation should keep upload/storage details behind `image.service.ts`.
- Environment placeholders are acceptable until Hostinger credentials/details are available.
- Product image count is one per product.
- Offer image count is one per offer.
- Uploading a new image replaces the previous image reference.
- Max upload size is 4MB.
- Allowed image types: PNG, JPG/JPEG, WEBP.
- Stored image values should be easy for storefront rendering; public URLs are preferred when practical.

## Search and Filtering Rules

Search:
- Search is server-side.
- Search matches product names and keywords.
- Search follows the query language rather than only the active storefront language.

Keywords:
- Stored for search use.
- Not required to appear visually on storefront.

Filters:
- category
- price
- `New` product flag/date filter
- `Bestseller` product flag

Category filtering:
- Hierarchical category filtering includes descendant products.

Price filtering:
- May remain client-side in v1 while data size is small.

Sorting:
- May remain client-side in v1 while data size is small.

## Deletion and Visibility Rules

Soft delete is required for:
- products
- categories
- offers

ERP default list behavior:
- Soft-deleted items are hidden from default lists.
- Deleted items appear through a trash/deleted filter.

Storefront visibility rules:
- Only active, visible, and non-deleted records are visible where applicable.
- Inactive products are hidden.
- Hidden offers are hidden.
- Visible offers can still appear when out of stock.
- Deleted records are hidden.

## Deferred / Explicitly Out of Scope for V1

The following are intentionally not part of v1:
- PayMob or any online payment gateway
- forgot password
- reset password
- email verification
- ERP role matrix
- multi-admin support
- audit logs
- order management UI
- shipping fee engine
- shipping zones
- delivery time estimation
- tax/VAT handling
- barcode support
- purchase history for buying price
- stock movement history
- non-size product variants
- SEO meta fields
- DB-backed cart
- customer order history page
- customer saved addresses page
- product gallery with multiple images
- old image physical deletion on replacement

## Initial Category Tree

This is the initial intended category structure. `cat.txt` is not required and should not be treated as a source file.

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

These require future product/technical decisions before implementation beyond the current scope:
- Exact partial draft persistence schema.
- Payment gateway design, provider choice, and payment lifecycle.
- Whether order numbers need a human-readable format beyond numeric DB ID.
