# Capella Mobile App (Expo / React Native) — Combined Storefront + ERP

> Status: **plan only — nothing implemented yet.**
> Decisions: React Native via **Expo** (App Store / Google Play distribution), **one combined app** (customer storefront + ERP admin unlocked by staff login), **full parity** with the web apps — the same styling, routes, functionality, data, permissions, languages, and known unfinished functionality; nothing product-level is added, removed, or redesigned for mobile. Native controls and layouts adapt the same design to phone interaction without changing behavior.
>
> Build order: the phases below are strictly sequential slices — each one is small, verifiable, and leaves the repo green. A phase is "done" only when its **Exit criteria** pass.

## Context

The monorepo ships three web workspaces today:

| Workspace | Stack | Role |
|---|---|---|
| `apps/api` | Express 4 REST, Drizzle/MySQL, port 4000 | Backend (`/api/v1` storefront, `/api/erp` admin) |
| `apps/storefront` | Next.js 16, Tailwind 4, ar/en + RTL | Customer shop |
| `apps/erp` | Next.js 16, Arabic-only | Staff admin |
| `packages/shared` | Raw TS (types, i18n, zod schemas, dto, constants) | Shared by all |

There is no mobile code anywhere. The new app lives at `apps/mobile` (picked up automatically by the `apps/*` pnpm workspace glob and Turborepo).

### Resolved implementation decisions

- The combined storefront + ERP app is intentional. Customer and admin authentication remain independent, and the authenticated ERP route tree is permission-aware.
- Use the **current stable Expo SDK at implementation time** and let `expo install` select its compatible React and React Native versions. Do not retain stale hard-coded SDK versions merely to use Expo Go.
- Use an installable Expo development build for reliable Android/iOS testing. Expo Go may be used for checks it supports, but it is not an acceptance environment for dynamic RTL switching.
- Mobile participates in the repository's complete validation suite with `build`, `lint`, `typecheck`, and `test` scripts. Every phase runs all applicable validation and leaves the repository green, not merely typechecked.
- Checkout and contact are known unfinished web/API functionality. Their mobile implementation is explicitly deferred until the existing implementation works; mobile then reproduces it exactly rather than inventing mobile-only behavior.

### Verified constraints (from code exploration)

1. **`@capella/shared` ships raw TS** — its `exports` map points at `.ts` source and internal imports use NodeNext-style `./x.js` specifiers. Metro needs a custom `resolveRequest` that strips the `.js` extension so the `.ts` file resolves. The root export (types, i18n, dto, schemas, constants, ordering) is pure TS + zod and fully reusable. **`@capella/shared/ui` is DOM-only (Radix/Tailwind) — must not be imported on mobile.**
2. **Auth is the one API blocker.** Refresh tokens live exclusively in httpOnly cookies (`capella_refresh` / `capella_admin_refresh`); `POST /api/v1/auth/refresh` and the admin twin read `req.cookies` only (`apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/admin/auth/admin-auth.controller.ts`). Native apps have no cookie jar → Phase 0 adds a small, backward-compatible token-based variant.
3. **API base URL**: `resolveApiBase()` in `packages/shared/src/api/base.ts` branches on `window` — mobile needs its own resolver from `EXPO_PUBLIC_API_URL`. A device can't reach `localhost`; the Android emulator uses `10.0.2.2`.
4. **i18n**: `packages/shared/src/i18n` (`getDict`, `isRtl`, `dir`, complete ar/en dictionaries including legal pages as `{h|p|ul}` block arrays under `dict.pages`) is framework-agnostic — reuse as-is. Storefront default language is `ar`.
5. **Styling source of truth**: the Parchment OKLCH palette in `apps/storefront/src/app/globals.css` (`--canvas: #f1f0ed`, ink near-black, white surfaces, radii 6/10/16/24, fonts Roboto / Tajawal / Lobster). React Native doesn't parse OKLCH → convert once to hex constants in a mobile `theme.ts`.
6. **Data layer to mirror** (pure functions, copy + adapt): `apps/storefront/src/lib/api/client.ts` + `client/{http,normalizers,selectors,types}.ts`, `apps/storefront/src/lib/cart.ts` (cart is client-side `CartLine[]` under storage key `capella.cart.v1`), checkout payload = `checkoutSchema` in `packages/shared/src/schemas/checkout.schema.ts` (uses `GOVERNORATES` + `EG_PHONE_REGEX` from shared constants).
7. Locale reaches the API via the `x-lang` header. Wishlist/orders/reviews are Bearer-authed under `/api/v1`; admin endpoints live under `/api/erp` behind a separate login + permissions middleware. CORS is irrelevant for native clients (no Origin header).

---

## Phase 0 — API: token-based auth for mobile (backend prerequisite)

Small, backward-compatible; web responses stay byte-for-byte identical.

**Files**

| File | Change |
|---|---|
| `apps/api/src/modules/auth/mobile-client.ts` | **new** — `isMobileClient(req)` (checks `x-client: mobile` header) and `extractRefreshToken(req, cookieName)` (cookie ?? `x-refresh-token` header ?? `body.refreshToken`) |
| `apps/api/src/modules/auth/auth.controller.ts` | login/refresh additionally return `refreshToken` in JSON **only when** `isMobileClient(req)`; refresh/logout read the token via `extractRefreshToken` |
| `apps/api/src/modules/admin/auth/admin-auth.controller.ts` | same three edits for the admin flow |

`express.json()` is already global so body parsing works; rate limits and cookies unchanged. (This exact change was validated once against `pnpm --filter @capella/api typecheck` before being reverted.)

**Exit criteria**
- `pnpm --filter @capella/api typecheck` green; `pnpm test` green (web auth tests unaffected).
- API integration tests cover customer and admin mobile login, refresh-token rotation, logout/revocation, rejected old tokens, and confirmation that ordinary web responses never expose refresh tokens.
- `curl -X POST /api/v1/auth/login -H "x-client: mobile"` returns `refreshToken` in the body; without the header it does not.

---

## Phase 1 — Workspace scaffold & build infra

The app boots to a placeholder screen; Metro proves it can bundle `@capella/shared` through pnpm symlinks. **Riskiest phase — do first, verify hard.**

**Files (all new unless noted)**

| File | Purpose |
|---|---|
| `apps/mobile/package.json` | `@capella/mobile`; current stable Expo SDK with Expo-selected compatible React/React Native versions; expo-router, expo-secure-store, `@react-native-async-storage/async-storage`, expo-image, expo-font + `@expo-google-fonts/{roboto,tajawal,lobster}`, expo-localization, expo-updates, react-native-safe-area-context, react-native-screens, React Native WebView for the same advice-video presentation, icons, and `"@capella/shared": "workspace:*"`; scripts `dev`, `build` (bundle/export both native platforms), `lint`, `typecheck`, and `test` so Turbo validates the app; Expo-compatible TypeScript, lint, and React Native test dependencies are installed directly for pnpm's isolated layout |
| `apps/mobile/app.json` | name "Capella Care", scheme `capella`, splash/background `#f1f0ed`, `supportsRTL`, bundle ids `com.capellacare.app`, plugins expo-router / expo-secure-store / expo-localization, `newArchEnabled` |
| `apps/mobile/metro.config.js` | `watchFolders=[repo root]`, `nodeModulesPaths` (app + root), `disableHierarchicalLookup: true`, `unstable_enablePackageExports: true`, and the `.js`→extensionless `resolveRequest` shim for shared's NodeNext imports |
| `apps/mobile/babel.config.js` | `babel-preset-expo` |
| `apps/mobile/tsconfig.json` | extends `expo/tsconfig.base`, `@/*` → `./src/*` alias (same convention as the web apps) |
| `apps/mobile/expo-env.d.ts`, `apps/mobile/.gitignore`, `apps/mobile/.env.example` | Expo types; ignore `.expo/ android/ ios/ dist/ .env`; document `EXPO_PUBLIC_API_URL` per target. Emulator (`http://10.0.2.2:4000`) and iOS simulator (`http://localhost:4000`) may be inferred in dev; **a physical device (`http://<LAN-IP>:4000`) and every production build must set the variable explicitly** — neither can reach a `localhost` fallback |
| `apps/mobile/app/_layout.tsx` | minimal root `<Stack>` |
| `apps/mobile/app/index.tsx` | temporary placeholder that imports something from `@capella/shared` (e.g. `getDict("ar").brand`) to prove shared-package bundling. **Deleted in Phase 6**, where `(tabs)/index.tsx` takes over `/` — the `(tabs)` group adds no URL segment, so the two files would otherwise both claim the root route |
| `turbo.json` (edit) | declare `EXPO_PUBLIC_API_URL` for the mobile tasks that consume it, especially `build` and `test`, so Turbo environment isolation and cache invalidation are correct |

**Exit criteria**
- `pnpm install` succeeds; `pnpm --filter @capella/mobile exec expo install --check` clean (run `--fix` once to snap exact SDK versions).
- `pnpm --filter @capella/mobile lint`, `typecheck`, and `test` are green.
- Both Android and iOS exports bundle without resolver errors ← proves the shared-TS/Metro integration on both targets.
- An installable development build opens on an emulator/simulator or physical device and shows the placeholder with a dict string.

---

## Phase 2 — Core foundation: theme, language/RTL, storage

No screens yet — the primitives everything else imports.

**Files**

| File | Purpose |
|---|---|
| `apps/mobile/src/theme.ts` | Parchment palette OKLCH→hex: canvas `#f1f0ed`, ink `#0e0d0b`, ink-2 `#3a3833`, ink-3 `#6d6a62`, accent `#46433c`, accent-deep `#201e1a`, warm-soft `#eae5d4`, hairline `#c5bda6`, error `#b13f2c`, success `#2e7d4f`, surface `#ffffff`; radii {6,10,16,24}; spacing scale; font families keyed by language (Roboto latin / Tajawal arabic / Lobster wordmark) |
| `apps/mobile/src/constants/storage.ts` | AsyncStorage/SecureStore keys — reuse web names: `capella.cart.v1`, `capella.auth.v1`, plus `capella.lang.v1`, secure keys for refresh tokens |
| `apps/mobile/src/lib/lang.tsx` | `LangProvider` + `useLang()`: language (`ar` default) + `getDict`/`dir` from `@capella/shared/i18n`, persisted; switching updates `I18nManager.allowRTL/forceRTL` and reloads the installed app with the SDK-supported app reload API so layout flips natively. Dynamic RTL is verified in a development build, not Expo Go |
| `apps/mobile/app/_layout.tsx` (edit) | load fonts (expo-font + google-font packages), keep splash until ready, wrap in `LangProvider` + SafeArea |

**Exit criteria**: build/lint/typecheck/tests green; a development build boots in Arabic with Tajawal, toggling to English reloads LTR with Roboto, and toggling back restores RTL.

---

## Phase 3 — Data layer: API client

Pure TS, no UI. Ported from the storefront (`apps/storefront/src/lib/api/`) minus Next-isms (`next: { revalidate }`, `NEXT_PUBLIC_API_URL`).

**Files**

| File | Purpose |
|---|---|
| `apps/mobile/src/lib/api/base.ts` | `API_BASE` = `EXPO_PUBLIC_API_URL`, falling back to the emulator/simulator URL by `Platform.OS` **only when `__DEV__`**; in a production build a missing variable is a startup error, never a dev-URL fallback |
| `apps/mobile/src/lib/api/http.ts` | `getJSON` / `authedGetJSON` / `authedMutationJSON` with the same 401 → refresh → retry-once logic; `x-lang` from lang state instead of `document`. The retry is opt-out per call: `POST /api/v1/checkout` passes `retryOn401: false` (the caller surfaces a re-login prompt instead) so an expired token can never place the same order twice. If checkout retry is wanted later it must go through a client-generated idempotency key honoured by the API — that is an API change, not a client one |
| `apps/mobile/src/lib/api/types.ts`, `normalizers.ts`, `selectors.ts` | ported verbatim; media URLs resolved against `API_BASE` |
| `apps/mobile/src/lib/api/client.ts` | all fetchers: products, categories, offers, collections, advices, shop-media-sections, orders, reviews, wishlist, checkout |

**Exit criteria**: build/lint/typecheck/tests green; a temporary debug call on the placeholder screen lists real products from a running local API.

---

## Phase 4 — State providers: customer auth & cart

**Files**

| File | Purpose |
|---|---|
| `apps/mobile/src/lib/auth/token-store.ts` | access token in memory with subscribe/listener + single-flight `refreshPromise` (same pattern as `apps/storefront/src/lib/auth-provider.api.ts`); **refresh token in `expo-secure-store`**; all auth calls send `x-client: mobile`, refresh sends `x-refresh-token`. Every successful refresh persists the newly rotated refresh token before publishing the new access token; rejection/logout clears both tokens locally |
| `apps/mobile/src/lib/auth/auth-context.tsx` | `AuthProvider` + `useAuth()`: login/signup/logout/bootstrap-from-storage; user profile in AsyncStorage (`capella.auth.v1` shape) |
| `apps/mobile/src/lib/cart.tsx` | `CartProvider` + `useCart()`: `CartLine[]` in AsyncStorage under `capella.cart.v1`, reusing `normalizeCartLine` validation from `apps/storefront/src/lib/cart.ts`; add/update/remove/clear; totals via `getEffectiveVariantPrice` from `@capella/shared` |
| `apps/mobile/app/_layout.tsx` (edit) | mount `AuthProvider` + `CartProvider` |

**Exit criteria**: build/lint/typecheck/tests green; login against local API survives an app reload, at least two consecutive token rotations, and a forced 401; rejected refresh/logout clears the local session; cart lines persist across restarts.

---

## Phase 5 — Design-system components

Native equivalents of the web look, all styled from `theme.ts`. Icons via `@expo/vector-icons` (lucide is DOM-only).

**Files** — `apps/mobile/src/components/`: `screen.tsx` (safe-area + canvas bg), `button.tsx` (primary/outline/ghost, pressed = accent-deep), `input.tsx`, `price-text.tsx` (EGP + strikethrough original), `rating-stars.tsx`, `badge.tsx` (new/bestseller/offer from `dict.badges`), `qty-stepper.tsx`, `media-image.tsx` (bilingual `EntityMedia` → url by lang, expo-image), `product-card.tsx`, `section-header.tsx` (eyebrow style), `empty-state.tsx`.

**Exit criteria**: build/lint/typecheck/tests green; a temporary gallery screen renders every component in ar (RTL) and en (LTR).

---

## Phase 6 — Customer slice A: browse (first real screens)

**Files** — `apps/mobile/app/`:
- `app/index.tsx` — **deleted** (Phase 1 placeholder); `(tabs)/index.tsx` becomes `/`
- `(tabs)/_layout.tsx` — tab bar: Home, Shop, Cart, Orders, Account (labels from `dict.nav`)
- `(tabs)/index.tsx` — Home: shop-media hero sections, new arrivals, bestsellers, offers/sets rails (mirrors web home/shop)
- `(tabs)/shop.tsx` — search + category chips + product grid (mirrors `/shop` + `/products`)
- `new.tsx` and `bestsellers.tsx` — dedicated filtered product lists matching the current `/new` and `/bestsellers` routes
- `category/[slug].tsx` — grid filtered via `getCategoryBySlug`/`categoryId`
- `product/[slug].tsx` — media gallery with dots, size/variant selector, discount pricing, description/ingredients/how-to-use/warnings sections, related items, add-to-cart (reviews & wishlist buttons land in Phase 8)
- Shop/products advice cards reproduce the current advice content and YouTube/Instagram presentation using native navigation and WebView/external-link handling as appropriate to the same source URL.

**Exit criteria**: build/lint/typecheck/tests green; browse every current catalog route end-to-end in a development build, both languages, RTL correct; advice presentation works; add-to-cart updates the tab badge.

---

## Phase 7 — Customer slice B: cart & checkout (checkout deferred upstream)

> **Known unfinished upstream functionality:** checkout does not currently work end-to-end in the existing app. The cart is implemented in this phase, but mobile checkout remains visibly unavailable and is not represented as working. Finish and validate the existing web/API checkout first; then implement the same contract and behavior here without mobile-only product changes.

**Files** — `(tabs)/cart.tsx` (lines joined against fetched products/offers/collections, qty steppers, totals, mirrors `cart-view.tsx`), `checkout.tsx` (full form: governorate picker from `GOVERNORATES`, `EG_PHONE_REGEX` validation, notes, COD block, POST `/api/v1/checkout`, success state clears cart — mirrors web checkout), plus an `order-success` state/screen.

**Exit criteria**: cart behavior and tests match the web app. After the upstream checkout blocker is resolved, a real COD order placed from the phone appears in the ERP web app and validation errors match web copy in both languages. Until then, checkout is explicitly recorded as deferred rather than passing this criterion.

---

## Phase 8 — Customer slice C: accounts, orders, wishlist, reviews

**Files** — `login.tsx`, `signup.tsx` (mirror web auth forms), `(tabs)/orders.tsx` + `order/[id].tsx` (history + detail incl. item snapshots, statuses from `dict.orders`), `(tabs)/account.tsx` (profile, language switch, links, admin entry, logout), `wishlist.tsx` (list/add/remove via `/api/v1/wishlist`, heart on cards/detail), reviews on `product/[slug]` (list + submit + prompt-claim via `/api/v1/reviews`). The same review components are wired into the offer and collection detail screens in Phase 9, where those screens first exist.

**Exit criteria**: guest→login→order history→wishlist→submit review full loop works; logged-out states show the same login-required messaging as web.

---

## Phase 9 — Customer slice D: offers, collections, static pages

**Files** — `offers/index.tsx` + `offer/[slug].tsx`, `collections/index.tsx` + `collection/[slug].tsx` (bundle contents, savings badge, add-bundle-to-cart, unavailability states, plus the Phase 8 review list/submit components on both detail screens), `page/[key].tsx` (generic renderer for `dict.pages.{about,privacy,terms,termsSale,returns,shipping}` `{h|p|ul}` blocks, including working inline internal/external links), `contact.tsx` (deferred unfinished functionality; after the existing contact flow is completed, reproduce its fields, validation, attachment selection/preview, submission, and result states).

**Exit criteria**: every working storefront web route has a mobile equivalent reachable from tabs/account and the storefront parity checklist passes. Contact is explicitly recorded as deferred until its existing implementation actually submits messages; the mobile app must not show a false successful-delivery state.

---

## Phase 10 — Admin (ERP) slice

Arabic-only regardless of app language (matches web ERP; "nothing new" rule).

**Files**
- `apps/mobile/src/lib/admin/auth.ts` — admin token store twin (own SecureStore key) using Phase 0's mobile flow against `/api/erp/auth`
- `apps/mobile/src/lib/admin/client.ts` — `/api/erp` fetch wrappers
- `apps/mobile/app/admin/_layout.tsx` — **Arabic RTL boundary**: while this route tree is mounted it uses the `ar` dictionary, Tajawal, right-aligned text/writing direction, RTL row ordering, and mirrored directional controls regardless of customer language. It does not mutate the customer's global language. The layout allows unauthenticated access only to `admin/login.tsx`; permission-aware staff guards protect every authenticated admin route
- `admin/login.tsx`, `admin/index.tsx` (dashboard), `admin/orders.tsx` + `admin/order/[id].tsx` (list, detail, payment-status updates — parity with `apps/erp` orders module)
- Explicit sequential ERP increments cover every current module and action: dashboard; orders; products and discounts; categories; offers; collections; advices; shop media; reviews moderation; sales; staff and effective permissions; trash/restore; uploads and media selection. Each increment inventories the matching web routes, API endpoints, permission keys, mutations, validation, empty/loading/error states, and touch adaptation before implementation

**Exit criteria**: build/lint/typecheck/tests green; every existing ERP route and permitted action has a mobile equivalent; Arabic layout remains truly RTL even when the customer app is English; permission-based navigation and route guards match web ERP; customer and admin sessions coexist independently.

---

## Phase 11 — Store readiness (needs user accounts)

EAS build config (`eas.json`, dev/preview/production profiles), real icon + splash assets, Android adaptive icon, iOS privacy manifest, store listings; `EXPO_PUBLIC_API_URL=https://api.capellacares.com` baked into production builds. Requires Apple Developer + Google Play accounts — user action.

**Exit criteria**: `eas build` produces installable .aab/.ipa; internal-track/TestFlight installs pass the complete parity checklist against the production API. Checkout and contact join this checklist only after their explicitly recorded upstream blockers are resolved.

---

## Target file tree (end state, abridged)

```
apps/mobile/
├── app.json  package.json  metro.config.js  babel.config.js  tsconfig.json  .env.example
├── app/
│   ├── _layout.tsx                    # fonts, splash, Lang/Auth/Cart providers, Stack
│   ├── (tabs)/_layout.tsx  index  shop  cart  orders  account
│   ├── new  bestsellers
│   ├── product/[slug]  category/[slug]  offers/  offer/[slug]
│   ├── collections/  collection/[slug]  checkout  login  signup
│   ├── wishlist  order/[id]  contact  page/[key]
│   └── admin/_layout  login  index  orders  order/[id]
└── src/
    ├── theme.ts  constants/storage.ts
    ├── lib/lang.tsx  cart.tsx
    ├── lib/api/{base,http,types,normalizers,selectors,client}.ts
    ├── lib/auth/{token-store.ts,auth-context.tsx}
    ├── lib/admin/{auth.ts,client.ts}
    └── components/{screen,button,input,price-text,rating-stars,badge,
        qty-stepper,media-image,product-card,section-header,empty-state}.tsx
```

## Out of scope (flagged, not planned)

- Push notifications, web→app deep links, payment methods beyond COD (web is COD-only)
- The ERP's desktop-grade tables/uploads UX will be adapted to touch — identical content and actions, phone-friendly layout
