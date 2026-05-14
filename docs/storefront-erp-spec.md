# Capella Storefront + ERP Specification

## Summary

This document is the source of truth for the Capella storefront and ERP system.

Locked stack:
- `Next.js` for the storefront
- `Express.js` for the backend API
- `MySQL` as the shared database
- One monorepo

Core business rule:
- The storefront reads data from the ERP-backed API.
- Storefront and ERP share one database.
- The storefront only sees the public, storefront-safe subset of the data.
- The ERP controls the full data model.

## Architecture

Recommended monorepo shape:

```text
capella/
├─ apps/
│  ├─ storefront/      # Next.js customer-facing app
│  └─ api/             # Express.js API for storefront + ERP
├─ packages/
│  ├─ shared/          # shared DTOs, validation schemas, constants
│  └─ database/        # Drizzle schema, migrations, seed, DB client
├─ docs/
│  └─ storefront-erp-spec.md
├─ cat.txt
└─ package.json
```

Architecture rules:
- The storefront must read data through the API only.
- The storefront must not read MySQL directly.
- The ERP is part of the backend system and uses the same API/database domain.
- Shared business-safe schemas and DTOs should live in `packages/shared`.
- Database schema, migrations, seed, and DB client should live in `packages/database`.
- `Drizzle ORM` is the chosen database layer for MySQL access and migrations.

## Languages

Storefront language rules:
- Storefront supports `ar` and `en`.
- Static content supports both languages.
- Dynamic content supports both languages where relevant.
- Search behavior follows the current storefront language.
  - Arabic search queries match Arabic product names.
  - English search queries match English product names.

ERP language rules:
- ERP default language is Arabic.
- ERP is not required to be bilingual as an interface.
- ERP must allow entering storefront-facing bilingual product and offer content where required.

Fallback rule:
- If English storefront text is missing, storefront may fall back to Arabic text.

Activation rule:
- Draft data may be partial.
- A record cannot be activated until required storefront fields are complete in both Arabic and English where applicable.

## Authentication

### ERP

ERP auth rules:
- One ERP user only
- One role only: `admin`
- Standard login screen
- No role matrix in v1
- No audit log in v1

### Storefront Customers

Customer auth rules:
- Signup supported
- Login supported
- Immediate login after signup
- No email verification in v1
- No forgot/reset password in v1

Signup fields:
- name
- email
- password

Guest behavior:
- Guest checkout is allowed
- Guest checkout is allowed even if the email already belongs to an existing account

Wishlist auth rule:
- Wishlist requires login
- If guest clicks wishlist:
  - show warning that wishlist requires login
  - provide redirect button to `/login`

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
- `/` redirects to the main product listing experience
- `/products` exists as the all-products listing
- `/category/[slug]` shows a category-filtered product listing
- `/offers` shows all offers
- `/offers/[slug]` shows a purchasable offer details page

Homepage rule:
- The main page is the e-commerce product page
- No separate marketing homepage is required in v1

## Storefront Features

Confirmed storefront features:
- Arabic/English support for static and dynamic data
- search
- filters
- sorting
- cart
- wishlist
- checkout
- offers browsing
- category browsing

Search rules:
- Search by product name only
- Search respects storefront language

Filter rules:
- category
- price

Product card/detail behavior:
- Product URLs are slug-based
- Product detail page includes breadcrumb
- Product detail page includes offer badges if the product is included in one or more offers

Wishlist rules:
- Logged-in users only
- Stored in database
- Persists across devices/accounts

Cart rules:
- Works for guests and logged-in users
- Stored in local storage in v1
- No DB-backed cart in v1

## Checkout

Checkout methods:
- Cash on Delivery
- PayMob

Checkout flow:
- Both payment methods use the same checkout form
- Both payment methods create the same order record format
- For online payment, create the order first with pending payment state

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
- notes

Validation rules:
- All checkout fields are required
- Phone number must follow Egyptian phone number format
- Currency is `EGP` only

Known v1 limitation:
- Orders are saved in DB
- ERP order-management UI is intentionally not implemented yet

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

Current v1 decision:
- Save orders in DB only
- Do not build ERP orders module in v1

## Catalog Model

### Products

Product rules:
- A product represents one sellable item family
- Variants are size-based only in v1
- No other variant dimensions in v1
- Each product belongs to exactly one leaf category
- Each product has one main image only
- Product status is only:
  - `active`
  - `inactive`
- `active` means visible on storefront
- `inactive` means hidden from storefront
- Soft delete is required

Product fields:
- database ID
- SKU
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
- created timestamps
- updated timestamps
- soft delete fields

Identity rules:
- DB ID is internal numeric index
- SKU is a separate unique business field
- Example SKU format: `BODY-LOTION-ROSE-200ML`
- SKU is used in invoices, reports, orders, and business references

Slug rules:
- Product slug is generated from English name
- Once created, the slug remains unchanged

Publishing rules:
- Product can be saved as partial draft/incomplete record
- Product cannot be activated until required fields are complete

Required fields for activation:
- name in Arabic
- name in English
- buying price
- at least one size variant
- category selection
- keywords
- photo

### Product Variants

Variant rules:
- Variants represent sizes only
- Each variant has its own selling price
- Each variant has its own stock quantity
- Stock is an integer
- Negative stock is not allowed
- If stock is `0`, add-to-cart is blocked for that variant
- Stock editing in v1 is direct-number editing only
- No stock movement history in v1

Variant fields:
- variant ID
- product ID
- size label such as `100ml`, `200ml`
- selling price
- stock quantity
- optional sort order

Display rules:
- Storefront cards/lists show price range when a product has multiple variant prices
- ERP list shows price range or equivalent range display

Availability rules:
- Product remains visible if at least one variant is in stock
- If all variants are out of stock and product is active:
  - storefront still shows the product page
  - product is marked out of stock

### Categories

Category rules:
- Category CRUD is allowed
- The current category tree from `cat.txt` is the initial business category tree
- ERP product form uses chained dropdowns
- Product must belong to exactly one leaf category
- Category slug is generated from English name
- Category slug remains unchanged after creation
- Soft delete is required

Delete protection:
- If a category has linked products, it cannot be deleted
- ERP should show warning telling the admin to move linked products first, then retry deletion

### Offers

Offer rules:
- Offers are fixed-price bundles
- Offers are purchasable as their own sellable entities
- An offer can contain multiple products
- Offer composition is variant-specific, not product-generic
- A product/variant may belong to multiple offers
- No start/end date in v1
- No active scheduling in v1
- Soft delete is required

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
- status if needed by implementation
- included variants with quantities
- created timestamps
- updated timestamps
- soft delete fields

Offer slug rules:
- Generated from English name
- Remains unchanged after creation

Offer stock rules:
- Offer is purchasable only if all included variants have enough stock
- When an offer is bought, included variant stock is deducted
- If included quantity is greater than `1`, deduct the exact quantity
- Example: if bundle includes `2` units of the same variant, purchasing the offer deducts `2`

Offer storefront rules:
- `/offers` lists offers
- `/offers/[slug]` shows offer detail page
- Offer has its own image, slug, and detail page

## Recipes, Socials, Branches

Recipes:
- Keep empty for now

Socials:
- Keep empty for now

Branches:
- Keep empty for now
- Branches are informational only in v1

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
- Soft-deleted products disappear from default list
- Admin can view them through trash/deleted filtering

### ERP Categories Module

Required capabilities:
- create category
- edit category
- delete category when safe
- soft delete category

ERP category constraints:
- Categories may evolve later
- Do not hard-freeze category editing in the system
- Enforce delete protection for linked products

### ERP Offers Module

Required capabilities:
- create offer
- edit offer
- soft delete offer
- upload/replace offer image
- select included variants and quantities

Offer image behavior:
- Uploading a new image replaces the old image automatically

## Media Storage

Image storage rules:
- Images are stored on Hostinger file storage
- Product image count is one per product
- Offer image count is one per offer
- Uploading a new image replaces the previous one automatically

## Search and Filtering Rules

Search:
- Search only by product name
- Search follows current storefront language

Keywords:
- Stored for search use only
- Not required to appear visually on storefront

Filters:
- category
- price

## Deletion and Visibility Rules

Soft delete is required for:
- products
- categories
- offers

ERP default list behavior:
- Soft-deleted items are hidden from default lists
- Deleted items appear through a trash/deleted filter

Storefront visibility rules:
- Only active and non-deleted records are visible
- Inactive records are hidden
- Deleted records are hidden

## Deferred / Explicitly Out of Scope for V1

The following are intentionally not part of v1:
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

## Initial Category Tree From `cat.txt`

The current source file is not fully normalized, so the implementation should treat the following as the initial intended category structure.

### Main Categories

- New
- Bestseller
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

- All
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

- All
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

- All
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

- All
- Foundations & Concealers
- Lips
- Eyeliners & Eyebrows
- Cheeks
- Bronzing

### Fragrances

- All
- For Her
- For Him

### Accessories & Tools

- All
- Body
- Skin
- Hair

## Open Flags

These are not undefined; they are consciously deferred:
- ERP orders module exists later, but not in v1
- Recipes/socials/branches stay empty for now
- English storefront fallback to Arabic is allowed
