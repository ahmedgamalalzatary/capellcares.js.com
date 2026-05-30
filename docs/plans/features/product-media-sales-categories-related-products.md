# Capella Feature Plan

## Summary

Implement four related feature areas while preserving current app boundaries: ERP uses `/api/erp`, storefront uses `/api/v1`, API owns DB access, and Drizzle owns schema changes.

Known issues to account for during implementation:

- Some backend modules/docs are stale or unmounted; change the actual mounted routes, especially `modules/admin/admin.controller.ts`, `repositories/*`, and mounted storefront product routes.
- Product media is image-only today across UI, env, schemas, upload service, and DB.
- Product URLs require globally unique slugs, so repeated grandchild display names need generated path-based slugs.

## Key Changes

- **Grandchild category naming**
  - Allow duplicate grandchild names under different parent subcategories, but reject duplicates under the same parent.
  - Keep main/sub category behavior unchanged unless touched by this flow.
  - Generate unique path-based slugs for repeated grandchildren, for example `her-skin-dry` and `his-skin-dry`.
  - Add API conflict handling with a clear reason such as `category-name-conflict`.

- **ERP Sales tab**
  - Add `/sales` to ERP navigation.
  - Add a protected `/api/erp/sales` endpoint returning all-order analytics.
  - Count all orders, regardless of payment status.
  - Expand offer order lines into their underlying product variants, multiplied by offer quantity.
  - Show top summary metrics, product/variant totals, revenue totals, and a per-order breakdown table.

- **Product media gallery**
  - Add ordered product media support: first image is primary, second image is hover image on product cards.
  - Support uploaded video media using env-configured MIME types and larger upload limits.
  - Keep `imagePath` as backward-compatible primary image output, but add a `media` array to product DTO/type/API responses.
  - Update ERP product form to upload, preview, reorder, and remove multiple images/videos.
  - Update storefront product cards/detail gallery to render real media instead of repeated placeholder thumbnails.

- **Related products**
  - Add one-way related products: if A selects B, only A shows B.
  - ERP product create/edit gets a "related products" selector using existing non-deleted products, excluding the current product.
  - Storefront product detail page shows related products only inside `/products/[slug]` product detail, not globally/list pages.
  - Storefront only displays active, non-deleted related products.

## API / DB / Type Changes

- Add DB tables:
  - `product_media`: product id, media type `image|video`, URL/path, sort order.
  - `product_related_products`: product id, related product id, sort order.
- Add shared product types/contracts:
  - `ProductMedia { id, type, url, sortOrder }`
  - `Product.media: ProductMedia[]`
  - `Product.relatedProducts?: Product[]` or a compact related-product card DTO.
- Add upload MIME support for video in `.env.example`, `.env.docker`, and `docker-compose.yml`, likely `video/mp4,video/webm`.
- Keep existing `youtubeUrl` as legacy data, but new uploaded video support uses the media gallery.

## Test Plan

- API route tests:
  - Grandchild duplicate name is allowed under different parents and rejected under the same parent.
  - Product upsert persists ordered media and related product ids.
  - Sales endpoint expands offer bundles into variant counts.
  - Upload rejects unsupported video MIME and accepts configured video MIME.
- ERP Vitest:
  - Product form renders media gallery controls and related product selector.
  - Sales page renders summary and order/product counts.
  - Admin shell includes Sales navigation.
- Storefront Vitest/contracts:
  - Product API contract includes `media`.
  - Product card swaps to second image on hover when present.
  - Product detail renders image/video gallery and related products.
- Verification commands:
  - Targeted API tests for categories/products/orders or new sales route.
  - Targeted ERP/storefront Vitest files.
  - `pnpm lint` or `pnpm build` if schema/type surface is broad.

## Assumptions

- Sales means all orders, not only accepted orders.
- Offer sales count toward the underlying product variants.
- Related products are one-way.
- Related products appear only on product detail pages.
- Product gallery order controls primary/hover behavior.
