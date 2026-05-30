# Phase 02 — API & Shared Contracts

> **Status:** AUDITED (2026-05-30) — strong existing coverage across auth, catalog, checkout,
> platform, and shared contracts. Remaining [T0] gaps: **transactional rollback, concurrent
> oversell, snapshot-survives-edit** (section C). Other gaps are [T1]/[T2] breadth.
> **Scope:** "API / Database Critical Rules", "CRUD Coverage For Catalog Entities",
> "Auth And Authorization Coverage", "Checkout And Orders Coverage", "Cart And Wishlist Coverage"
> (wishlist API), "Localization, Routing, And SEO Coverage" (x-lang), "Security And Data-Leak Coverage",
> "Contracts And Shared Package Coverage".
> **Depends on:** 01.

## Goal
Prove every server-side business rule at the layer closest to truth: auth boundaries,
catalog CRUD (response **and** DB state), the money path, cross-cutting platform rules,
and that shared DTO schemas match real responses with no leaked fields.

## Current state (2026-05-30)
API runner: `apps/api/scripts/run-tests.mjs`; DB migration via `packages/database` `pretest`.
Helpers: `apps/api/tests/helpers/{admin-auth,database,request}.ts`.

Existing API tests:
- **Auth:** `routes/auth.routes`, `routes/admin-auth.routes`, `services/admin-auth.service`, `unit/auth.middleware`.
- **Catalog:** `routes/admin-products`, `admin-offers`, `admin-categories`, `advices`;
  `services/admin-products.service`; `repositories/admin-products`, `related-item`; `unit/offer-mapper`.
- **Checkout/orders:** `routes/checkout`, `orders`, `sales`; `services/checkout.service`; `unit/checkout.schemas`.
- **Platform:** `routes/wishlist`, `x-lang`, `route-truth`; `services/uploads`; `unit/storefront-revalidation`;
  `contracts/storefront-contracts`.

Shared contracts: `packages/shared/tests/contracts/` holds `index.ts`, `helpers.ts`, and
`{product,offer,category,advice,related-item}.contract.ts` — consumed by
`apps/api/tests/contracts/storefront-contracts.test.ts` and
`apps/storefront/tests/contracts/storefront-client.contract.test.ts` (via `assertConformsTo`,
`assertForbiddenFieldsAbsent`). No standalone shared `.test.ts` runner, but the contract
definitions are real and exercised.

> **AUDIT COMPLETED 2026-05-30** — checkboxes below were verified by reading actual test contents
> (not filenames). `[x]` = a real passing assertion exists; `[ ]` = genuine gap; `[~]` = partial.
> Coverage is strong; the real remaining work is concentrated in section C (rollback/concurrency/snapshots).

---

## A. Auth & Authorization

### Authorization boundaries [T0]
- [x] Admin auth protects **all** `/api/erp` routes; customer token rejected. *(route-truth: erp products/orders/uploads → 401)*
- [~] Customer routes reject access to another customer's wishlist or orders. *(orders cross-customer rejected → 404; **wishlist cross-customer not tested**)*
- [x] Admin-only endpoints unreachable through public route aliases. *(route-truth: legacy /api/v1/catalog/* → 404)*
- [x] Admin login uses the single configured admin account; old fallback headers never accepted. *(admin-auth: x-admin-basic rejected even with flag on)*
- [ ] Customer cannot mutate another customer's wishlist/order/profile/session. *(read-side covered for orders; mutation/wishlist gap)*

### Tokens & sessions [T0/T1]
- [x] [T0] Refresh token rotation rejects replayed/old refresh tokens. *(auth.routes: rotate + old cookie → 401)*
- [x] [T0] Logout revokes the current session and clears refresh cookie correctly. *(customer + admin)*
- [x] [T1] Refresh issues a new access token only for a valid refresh cookie.
- [~] [T1] Token errors. *(auth.middleware: no-token→401, invalid-token→401, non-integer sub→401, valid→assigns req.user; optionalAuth leaves user unset on bad token. **Expired / wrong-secret / wrong-subject specifics not separately asserted.**)*
- [ ] [T1] Multiple sessions behave as intended (current-only vs all-sessions logout).

### Signup / login [T1]
- [~] Signup accepts valid data; **duplicate email/phone + invalid Egyptian phone not tested at route level** *(valid signup 201 covered)*.
- [~] Login returns access token + refresh cookie for valid creds; **invalid-creds rejection not tested at route level** *(service-level covered below)*.
- [x] Admin login rejects wrong creds and missing configured admin creds. *(admin-auth.service: /invalid/ + /not configured/; success → role=admin, type=admin_access)*
- [~] [T2] Auth middleware doesn't throw on malformed headers *(invalid token → 401, handled not thrown)*; cookie secure/httpOnly/sameSite per env not asserted.

---

## B. Catalog CRUD (Products, Offers, Categories)

**Cross-cutting [T0]:** every mutation test asserts **both** API response **and** DB state;
storefront visibility verified after mutation for active/inactive/deleted entities.

### Products
- [~] [T0] Storefront hides inactive/deleted/OOS products; public detail 404s for them. *(offer detail 404-on-inactive covered; **product detail 404-on-inactive not explicitly tested**; inactive related targets hidden — covered)*
- [x] [T1] toggle (flips DB) / soft-delete (shown in ERP trash) / hard-delete (cascades variants+wishlists+file) / hard-delete-not-in-trash → 404.
- [x] [T1] Duplicate slug conflict (categories tested; products via SKU unique). *(slug immutability on edit not explicitly asserted)*
- [x] [T1] Activation enforces required fields server-side. *(rejects missing variants/keywords/image/en/ar; inactive incomplete allowed)*
- [x] [T1] Media + related links preserved on unrelated edits; related rank order preserved; media ordering + dedicated hover persisted.
- [x] [T2] Edit variant in place (preserves offer link); reject removing offer-linked variant (409 linked-to-offers); whitespace normalized.
- [x] [T2] Delete behavior with wishlists/offer items: hard-delete cascades wishlists; soft+hard delete reject offer-linked (409).
- [ ] [T1] Negative stock/price, zero/negative selling-price rejection at route level. *(builder rejects qty>stock; price-sign not seen)*

### Offers
- [x] [T1] create (+ storefront visibility) / list shape / toggle (flips DB + storefront hide + detail 404).
- [x] [T0] Preserve offer item ids on edit; no duplicate items (regression `dd81ce1`): "updates items in place when ids provided" + "merges duplicate variant rows".
- [x] [T1] Related mirroring + preserve-on-omit. *(also: related-item.repository fully covers mirroring, self-ref rejection, empty-list unlink, per-source rank independence, append-to-end, product↔offer + offer↔offer cross-type, offer-mapper shape)*
- [ ] [T1] Reject items referencing deleted/inactive products; reject zero/negative qty and **empty item list**. *(not tested)*
- [ ] [T1] Stock availability from included variant stock × item qty (storefront read). *(deduction tested in C; availability surfacing not asserted here)*
- [ ] [T2] Soft-delete/trash/restore/hard-delete flows for offers. *(not tested)*

### Categories
- [x] [T0] Delete blocked by linked products (409 has-products) and active children (409 has-active-children).
- [x] [T1] Duplicate same-parent name rejected (409 category-name-conflict); same name under different parents → path-based slugs (her-skin-dry / his-skin-dry); duplicate slug → 409 slug-conflict; nesting marks parent non-leaf.
- [ ] [T1] Parent cycle prevention; cannot move under own descendant; move to new parent keeps descendants. *(not tested)*
- [ ] [T1] update / descendant resolution. *(create+delete+nesting covered; update + descendant-resolution gap)*
- [ ] [T2] Safe behavior with deleted children; trash/hard-delete for descendants + linked products.

### Advices (was unaudited)
- [x] [T1] CRUD persists + updates; storefront returns only active, sorted by sortOrder; delete removes; toggle-status flips; rejects invalid payload (400) / invalid id (400) / missing advice (404). *(advices.routes.test.ts — fully covered)*

### Repository-level (product id-injection)
- [x] [T1] `createAdminProductRepo` ignores a caller-supplied `id` and assigns a fresh one (admin-products.repository); service-layer payload shape mapping covered (admin-products.service).

---

## C. Checkout, Orders & Stock — **highest [T0] density**

### Server-trusted pricing & ownership [T0]
- [x] Recompute every line price + total server-side. *(checkout.schemas: builder totalAmount = "100.00")*
- [x] Ignore client-provided `customerId` — uses authenticated id. *(checkout.routes: body customerId+999 ignored)*
- [~] Ignore client price/total/paymentStatus. *(total recomputed; builder doesn't read client total, but no negative test feeding a bogus total)*
- [x] Authenticated checkout → registered order; guest checkout works (incl. existing email).
- [x] Order list returns only current customer's orders; detail rejects another customer's order (404).
- [ ] Delivery snapshot preserved independently of later profile changes. *(not tested)*

### Stock integrity [T0]
- [x] Deduct product variant stock exactly once. *(service: 10 → 8 for qty 2)*
- [x] Deduct each offer included variant by `offerItem.qty × requestedOfferQty`. *(service: offer qty 2 → both variants drop)*
- [ ] **Transactional: partial failure creates no order and no half-deduction.** — **GAP confirmed, not tested.**
- [ ] **Concurrent checkout for the last item cannot oversell.** — **GAP confirmed, not tested.**
- [~] Negative stock blocked. *(builder rejects qty > stock; concurrent/DB-level race not covered)*

### Order state & snapshots [T0/T1]
- [x] [T0] COD orders start `paymentStatus = pending`. *(route + service + smoke; verified against DB row)*
- [ ] [T0] Order item snapshots keep names/prices/qty/media/refs **after later edits/deletes.** — **GAP: snapshot persists at create (orderItems createdAt asserted), but no "edit product then re-read order" test.**
- [x] [T1] ERP payment status: update persists; rejects invalid status (400 "Invalid payment status"); rejects invalid id (400).
- [~] [T1] Validate quantities/ids; reject qty>stock (builder), invalid phone, unknown payment method. *(empty cart, fractional/negative qty, mixed cart not all covered)*
- [x] [T2] Sales aggregation. *(sales.routes: product+offer lines, units, revenue=140; all payment statuses incl. denied counted; offer qty expanded by offerItem.qty × order qty → 8 units; per-variant + per-order breakdown)*

---

## D. Platform Rules

### Data-leak prevention [T0]
- [x] Public `/api/v1` never exposes buying price. *(storefront-contracts: `assertForbiddenFieldsAbsent(product, ["buyingPrice"])`)*
- [~] Inactive/deleted records hidden from public. *(offer toggle → storefront hidden + detail 404; inactive related hidden; **product detail 404-on-inactive gap**)*
- [ ] API errors never leak stack traces, SQL, paths, JWT secrets, DB URLs, env values. *(not tested)*
- [ ] Repositories never query deleted rows without explicit trash option; scope customer data by authed id. *(orders scoping covered in C; wishlist/general repo scoping not asserted)*

### Wishlist API [T1]
- [x] add/list/remove require auth (401 unauth) and work for authed customer.
- [ ] Idempotent on duplicate add / already-removed; list hides deleted/non-visible products. *(not tested)*

### Contracts, validation & locale [T1]
- [x] `x-lang` missing → Arabic default; `en`/`ar` return correct fields (categories + products).
- [x] JSON 404 on unknown/legacy routes (route-truth); health endpoint stable.
- [x] Storefront product/offer/category conform to shared contracts (`assertConformsTo`); media array shape asserted.
- [ ] Consistent envelopes across all verbs; pagination stable (first/last/empty/out-of-range); sorting/filters reject invalid input. *(not tested)*
- [ ] Validation strips/rejects unknown fields; search Arabic/English/mixed/empty + locale mismatch. *(not tested)*

### Upload & revalidation [T1/T2]
- [x] [T1] Upload: accepts valid image/video payloads; **rejects unsupported mime** (.exe); **rejects oversized** (maxBytes); saves file + returns public URL/path; preserves extension. *(uploads.test.ts)* **Gap: path-traversal filename not explicitly tested.**
- [x] [T1] Revalidation: posts correct slug to `/api/revalidate` with `x-revalidate-secret` header + `{entity,slug}` body. *(storefront-revalidation.test.ts)* **Gap: wrong/missing-secret rejection is storefront-side, not tested here.**
- [ ] [T2] Upload collisions/extension-mime mismatch; delete/replace doesn't orphan; revalidation failure doesn't fail ERP mutation; path-traversal filename rejection.
- [ ] [T2] CORS/cookie per env; FKs block orphans; numeric/date serialization.

---

## E. Shared Contracts (`packages/shared`)

> **Correction:** contracts are NOT missing. `packages/shared/tests/contracts/` defines
> `storefrontProductContract/OfferContract/CategoryContract/RelatedItemContract` (+ advice) plus
> `assertConformsTo` and `assertForbiddenFieldsAbsent`, consumed by API + storefront contract tests.

### Schema ↔ real response [T0/T1]
- [x] [T0] Forbidden field (buyingPrice) absent from storefront product contract.
- [x] [T1] Product/offer/category/related-item shapes validated against real API responses via `assertConformsTo`.
- [ ] [T1] Extend contract coverage to wishlist, checkout, auth, orders (currently product/offer/category/related/advice).
- [ ] [T1] Broaden forbidden-field checks beyond `buyingPrice` (admin notes, non-public deleted flags, cost data).

### Validation & constants [T1]
- [x] Checkout schema rejects invalid Egyptian phone + unknown payment method; accepts valid COD (`checkout.schemas.test.ts`).
- [ ] Other shared validation schemas reject invalid + accept valid examples.
- [ ] Shared constants (statuses, payment methods, languages, soft-delete) match API usage; i18n key coverage.

> The contract pattern is already the right one (runtime `assertConformsTo` on real payloads, not snapshots).
> Remaining work is breadth, not infrastructure.

## Definition of done
All [T0] across A–E have passing tests against **real route handlers** (not mocks); mutations assert
DB + response; concurrency/rollback and data-leak negatives are explicit; shared schemas parse real payloads.
