# Capella Mobile App (Expo / React Native) — Combined Storefront + ERP

> Status: **implementation active — Phase 0 is complete; Phase 1 is code-complete with device acceptance deferred to Phase 2.**
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
- Customer account deletion does not exist anywhere yet, but both app stores require it (see Phase 11). It is a third recorded upstream blocker: add to API + web first, then mirror on mobile before store submission.

### Verified constraints (from code exploration)

1. **`@capella/shared` ships raw TS** — its `exports` map points at `.ts` source and internal imports use NodeNext-style `./x.js` specifiers. Metro needs a custom `resolveRequest` that strips the `.js` extension so the `.ts` file resolves. The root export (types, i18n, dto, schemas, constants, ordering) is pure TS + zod and fully reusable. **`@capella/shared/ui` is DOM-only (Radix/Tailwind) — must not be imported on mobile.**
2. **Auth is the one API blocker.** Refresh tokens live exclusively in httpOnly cookies (`capella_refresh` / `capella_admin_refresh`); `POST /api/v1/auth/refresh` and the admin twin read `req.cookies` only (`apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/admin/auth/admin-auth.controller.ts`). React Native cookie authentication is unstable and unsuitable as the session source of truth → Phase 0 adds a small, backward-compatible token-based variant that is independent of native cookie behavior.
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
| `apps/api/src/modules/auth/mobile-client.ts` | **new** — `isMobileClient(req)` requires `x-client: mobile` with no browser `Origin`; `extractRefreshToken(req, cookieName)` keeps transports separate: web uses its cookie only, while mobile uses `x-refresh-token` then `body.refreshToken` and ignores any retained cookie; the disclosure guard permits JSON refresh-token output only for accepted mobile header/body transport |
| `apps/api/src/modules/auth/auth.controller.ts` | mobile login/refresh return `refreshToken` in JSON and do not issue cookies; mobile refresh/logout use header/body tokens; web login/refresh/logout remain cookie-only and byte-for-byte compatible |
| `apps/api/src/modules/admin/auth/admin-auth.controller.ts` | same three edits for the admin flow |

`express.json()` is already global so body parsing works; rate limits are unchanged. Web cookie behavior is unchanged, while explicit mobile requests never issue refresh cookies, so SecureStore rotation cannot be disrupted by unstable native cookie retention.

**Exit criteria**
- `pnpm --filter @capella/api typecheck` green; `pnpm test` green (web auth tests unaffected).
- API integration tests cover customer and admin mobile login, refresh-token rotation, logout/revocation, rejected old tokens, browser-origin spoofing, mixed cookie/header requests, and confirmation that ordinary web responses never expose refresh tokens.
- `curl -X POST /api/v1/auth/login -H "x-client: mobile"` returns `refreshToken` in the body; without the header it does not.

---

## Phase 1 — Workspace scaffold & build infra

The app boots to a placeholder screen; Metro proves it can bundle `@capella/shared` through pnpm symlinks. **Riskiest phase — do first, verify hard.**

**Files (all new unless noted)**

| File | Purpose |
|---|---|
| `apps/mobile/package.json` | `@capella/mobile`; current stable Expo SDK with Expo-selected compatible React/React Native versions; expo-router, expo-dev-client, expo-secure-store, `@react-native-async-storage/async-storage`, expo-image, expo-font + `@expo-google-fonts/{roboto,tajawal,lobster}`, expo-localization, expo-updates, react-native-safe-area-context, react-native-screens, React Native WebView for the same advice-video presentation, icons, and `"@capella/shared": "workspace:*"`; scripts `dev`, `build` (bundle/export both native platforms), `lint`, `typecheck`, and `test` so Turbo validates the app; Expo-compatible TypeScript, lint, and React Native test dependencies are installed directly for pnpm's isolated layout |
| `apps/mobile/app.json` | name "Capella Care", scheme `capella`, splash/background `#f1f0ed`, `supportsRTL`, bundle ids `com.capellacare.app`, plugins expo-router / expo-secure-store / expo-localization; use SDK 57's default New Architecture (the removed `newArchEnabled` config key is not valid in its schema) |
| `apps/mobile/metro.config.js` | extend `expo/metro-config` and keep SDK 52+ automatic pnpm-monorepo resolution; add only a scoped `.js`→extensionless `resolveRequest` shim for shared's NodeNext imports, with fallback to real `.js` files |
| `apps/mobile/babel.config.js` | `babel-preset-expo` |
| `apps/mobile/tsconfig.json` | extends `expo/tsconfig.base`, `@/*` → `./src/*` alias (same convention as the web apps) |
| `apps/mobile/expo-env.d.ts`, `apps/mobile/.gitignore`, `apps/mobile/.env.example` | Expo types; ignore `.expo/ android/ ios/ dist/ .env`; document `EXPO_PUBLIC_API_URL` per target. Emulator (`http://10.0.2.2:4000`) and iOS simulator (`http://localhost:4000`) may be inferred in dev; **a physical device (`http://<LAN-IP>:4000`) and every production build must set the variable explicitly** — neither can reach a `localhost` fallback |
| `apps/mobile/app/_layout.tsx` | minimal root `<Stack>` |
| `apps/mobile/app/index.tsx` | temporary placeholder that imports something from `@capella/shared` (e.g. `getDict("ar").brand`) to prove shared-package bundling. **Deleted in Phase 6**, where `(tabs)/index.tsx` takes over `/` — the `(tabs)` group adds no URL segment, so the two files would otherwise both claim the root route |
| `packages/shared/package.json`, web app manifests (edit) | keep DOM-only UI libraries as optional peers of shared and direct dependencies of the storefront/ERP, so a mobile install of the pure shared exports cannot pull in a second React/Radix tree |
| `turbo.json` (edit) | declare `EXPO_PUBLIC_API_URL` for the mobile tasks that consume it, especially `build` and `test`, so Turbo environment isolation and cache invalidation are correct |

**Exit criteria**
- `pnpm install` succeeds; `pnpm --filter @capella/mobile exec expo install --check` clean (run `--fix` once to snap exact SDK versions).
- `pnpm --filter @capella/mobile lint`, `typecheck`, and `test` are green.
- Both Android and iOS exports bundle without resolver errors ← proves the shared-TS/Metro integration on both targets.
- An installable development build opens on an emulator/simulator or physical device and shows the placeholder with a dict string.

Implementation verification: Expo Doctor, dependency compatibility, lint, typecheck, tests, and Android/iOS exports are green. A device launch remains an external environment check because this workspace has no Android SDK/emulator/device and runs on Windows without an iOS toolchain.

### EAS development-build status and future device workflow

- **Connected:** `apps/mobile` is linked to Expo account `alzatary`, EAS project `@alzatary/capella-care` (`4849c50d-3d67-4bca-9bdd-316605f03fa2`). `app.json` contains the owner/project link and `eas.json` contains Android/iOS development, preview, and production profiles.
- **Not yet completed:** no cloud development build has been requested, no Capella Care development APK has been installed, and the Phase 1 device-launch criterion remains pending.
- **Build once:** from `apps/mobile`, run `pnpm dlx eas-cli@latest build --platform android --profile development`. EAS uploads the project, builds an installable development APK in the cloud, and returns a build page/download link. Free-plan builds may wait in a low-priority queue.
- **Install once:** open the EAS build link or scan its installation QR code on the Android phone, download the APK, allow installation from that browser when Android asks, and install **Capella Care**. It is a separate app from Expo Go; Expo Go may remain installed but is not the acceptance environment.
- **Daily development:** from the repository root, run `pnpm --filter @capella/mobile exec expo start --dev-client`. Keep the PC and phone on the same network, then scan the Metro QR code and open it with the installed Capella Care development client. Use Expo's tunnel option only when LAN discovery cannot connect.
- **Rebuild only when native inputs change:** JavaScript/TypeScript, styles, and ordinary screen changes load through Metro without another cloud build. Request a new EAS build after changing native dependencies, Expo config/plugins, bundle identifiers, or other native configuration.
- **API testing on a phone:** before phases that call the API, set `EXPO_PUBLIC_API_URL` to the PC's LAN-reachable API address; a physical phone cannot use the PC's `localhost`.
- **iOS:** EAS can cloud-build iOS, but installing on a physical iPhone requires Apple signing/device registration, and an iOS Simulator still requires macOS. Android remains the practical acceptance device for this Windows workspace.

**Deferred acceptance decision:** Do not wait for an EAS build merely to verify the temporary Phase 1 placeholder. Treat Phase 1 as code-complete, but not 100% accepted, until the device-launch criterion passes. Complete the Android build/install workflow above no later than Phase 2 acceptance, where Arabic fonts and live RTL/LTR switching require a development build; do not defer it until the full storefront is finished.

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

## Phase 6 — Customer slice A: browse & catalog (first real screens)

Merged slice (former Phases 6 + 9): all read-only customer surfaces land together — browse, offers, collections, and static pages — so the whole catalog navigation graph is verified in one pass.

**Files** — `apps/mobile/app/`:
- `app/index.tsx` — **deleted** (Phase 1 placeholder); `(tabs)/index.tsx` becomes `/`
- `(tabs)/_layout.tsx` — tab bar: Home, Shop, Cart, Orders, Account (labels from `dict.nav`)
- `(tabs)/index.tsx` — Home: shop-media hero sections, new arrivals, bestsellers, offers/sets rails (mirrors web home/shop)
- `(tabs)/shop.tsx` — search + category chips + product grid (mirrors `/shop` + `/products`)
- `new.tsx` and `bestsellers.tsx` — dedicated filtered product lists matching the current `/new` and `/bestsellers` routes
- `category/[slug].tsx` — grid filtered via `getCategoryBySlug`/`categoryId`
- `product/[slug].tsx` — media gallery with dots, size/variant selector, discount pricing, description/ingredients/how-to-use/warnings sections, related items, add-to-cart (reviews & wishlist buttons land in Phase 7)
- `offers/index.tsx` + `offer/[slug].tsx`, `collections/index.tsx` + `collection/[slug].tsx` — bundle contents, savings badge, add-bundle-to-cart, unavailability states (review list/submit components are wired in during Phase 7)
- `page/[key].tsx` — generic renderer for `dict.pages.{about,privacy,terms,termsSale,returns,shipping}` `{h|p|ul}` blocks, including working inline internal/external links
- Shop/products advice cards reproduce the current advice content and YouTube/Instagram presentation using native navigation and WebView/external-link handling as appropriate to the same source URL.

**Exit criteria**: build/lint/typecheck/tests green; browse every current read-only storefront route (home, shop, new, bestsellers, categories, products, offers, collections, static pages) end-to-end in a development build, both languages, RTL correct; advice presentation works; add-to-cart and add-bundle-to-cart update the tab badge.

---

## Phase 7 — Customer slice B: cart, checkout, accounts, orders, wishlist, reviews

Merged slice (former Phases 7 + 8): everything that mutates state or needs a customer session.

> **Known unfinished upstream functionality:** checkout and contact do not currently work end-to-end in the existing app. The cart is implemented in this phase, but mobile checkout and contact remain visibly unavailable and are not represented as working. Finish and validate the existing web/API implementations first; then reproduce the same contract and behavior here without mobile-only product changes.

**Files**
- `(tabs)/cart.tsx` — lines joined against fetched products/offers/collections, qty steppers, totals, mirrors `cart-view.tsx`
- `checkout.tsx` + `order-success` — **post-blocker deliverables**: until the upstream checkout flow works, mobile exposes only an unavailable checkout state; afterwards, the full form (governorate picker from `GOVERNORATES`, `EG_PHONE_REGEX` validation, notes, COD block, POST `/api/v1/checkout`, success state clears cart) mirrors web checkout
- `login.tsx`, `signup.tsx` — mirror web auth forms
- `(tabs)/orders.tsx` + `order/[id].tsx` — history + detail incl. item snapshots, statuses from `dict.orders`
- `(tabs)/account.tsx` — profile, language switch, links, admin entry, logout
- `wishlist.tsx` — list/add/remove via `/api/v1/wishlist`, heart on cards/detail
- Review components (list + submit + prompt-claim via `/api/v1/reviews`) wired into the `product/[slug]`, `offer/[slug]`, and `collection/[slug]` detail screens (all exist since Phase 6)
- `contact.tsx` — deferred unfinished functionality; after the existing contact flow is completed, reproduce its fields, validation, attachment selection/preview, submission, and result states

**Exit criteria**: cart behavior and tests match the web app; guest→login→order history→wishlist→submit review full loop works; logged-out states show the same login-required messaging as web; every working storefront web route now has a mobile equivalent reachable from tabs/account and the storefront parity checklist passes. Checkout and contact are explicitly recorded as deferred until their upstream implementations work: once the checkout blocker is resolved, a real COD order placed from the phone must appear in the ERP web app with validation errors matching web copy in both languages, and the mobile app must never show a false successful-delivery state for contact.

---

## Phase 8 — ERP slice A: admin foundation, dashboard, orders

The former single "Admin (ERP) slice" is now three phases (8–10) — it is roughly as much work as the whole customer side. All of it is Arabic-only regardless of app language (matches web ERP; "nothing new" rule). Every module increment in Phases 8–10 inventories the matching web routes, API endpoints, permission keys, mutations, validation, empty/loading/error states, and touch adaptation before implementation; the ERP's desktop-grade tables and upload UX are adapted to touch with identical content and actions.

**Files**
- `apps/mobile/src/lib/admin/auth.ts` — admin token store twin (own SecureStore key) using Phase 0's mobile flow against `/api/erp/auth`
- `apps/mobile/src/lib/admin/client.ts` — `/api/erp` fetch wrappers
- `apps/mobile/app/admin/_layout.tsx` — **Arabic RTL boundary**: while this route tree is mounted it uses the `ar` dictionary, Tajawal, right-aligned text/writing direction, RTL row ordering, and mirrored directional controls regardless of customer language. It does not mutate the customer's global language. The layout allows unauthenticated access only to `admin/login.tsx`; permission-aware staff guards protect every authenticated admin route
- `admin/login.tsx`, `admin/index.tsx` (dashboard), `admin/orders.tsx` + `admin/order/[id].tsx` (list, detail, payment-status updates — parity with `apps/erp` orders module)

**Exit criteria**: build/lint/typecheck/tests green; admin login/refresh/logout works against `/api/erp/auth` and customer/admin sessions coexist independently; dashboard and the complete orders module reach parity with the web ERP; Arabic layout remains truly RTL even when the customer app is English; permission-based navigation and route guards match web ERP.

---

## Phase 9 — ERP slice B: catalog management

Uploads and media selection come first — every catalog form depends on them — then the modules in sequential increments: **products and discounts; categories; offers; collections**.

**Files** — `admin/products*`, `admin/categories*`, `admin/offers*`, `admin/collections*` route trees plus shared admin form/table/media-picker components under `src/components/admin/`, mirroring the corresponding `apps/erp` modules (list, create, edit, delete, discounts, bilingual media management).

**Exit criteria**: build/lint/typecheck/tests green; every route and permitted action of the four modules (plus uploads/media selection) has a mobile equivalent; a create→edit→delete round-trip performed from the phone against the local API shows up correctly in both the web ERP and the storefront.

---

## Phase 10 — ERP slice C: operations & administration

Remaining modules in sequential increments: **advices; shop media; reviews moderation; sales; staff and effective permissions; trash/restore**.

**Files** — `admin/advices*`, `admin/shop-media*`, `admin/reviews*`, `admin/sales*`, `admin/staff*`, `admin/trash*` route trees mirroring the corresponding `apps/erp` modules.

**Exit criteria**: build/lint/typecheck/tests green; every existing ERP route and permitted action now has a mobile equivalent and the full ERP parity checklist passes; permission-restricted staff accounts see exactly the same navigation and guards as on web.

---

## Phase 11 — Store readiness (needs user accounts)

EAS build config (`eas.json`, dev/preview/production profiles), real icon + splash assets, Android adaptive icon, iOS privacy manifest, store listings; `EXPO_PUBLIC_API_URL=https://api.capellacares.com` baked into production builds. Requires Apple Developer + Google Play accounts — user action.

### Store review requirements (combined customer + admin app)

- **Review credentials**: Apple (guideline 2.1) and Google Play (the "App access" declaration in Play Console) both require working credentials for every login-gated area of the app. Prepare a demo **customer** account and a demo **staff** account (least-privileged permissions that still demonstrate the admin area) against an API that stays reachable for the entire review window.
- **Disclose the admin mode**: an undocumented staff area risks rejection under Apple 2.3.1 (hidden features). The App Review notes must state that the app contains a staff-only ERP section and explain how to reach it with the demo staff credentials; the Play "App access" declaration must list it the same way.
- **Account deletion — recorded upstream blocker**: both stores require in-app account deletion when the app offers account creation (Apple 5.1.1(v); Google Play additionally requires a web deletion link declared in the Data safety form). The API has no deletion endpoint today (`apps/api/src/modules/auth/auth.routes.ts` exposes only signup/login/refresh/logout). Like checkout and contact, this must be added upstream (API + web account page) first and then mirrored on mobile — store submission cannot pass without it.
- **Data disclosure forms**: Apple privacy nutrition labels + the iOS privacy manifest; Google Play Data safety form (account data, order/address data, no third-party tracking SDKs). A public privacy-policy URL is mandatory on both stores.
- **Payments**: COD for physical goods is exempt from in-app purchase requirements on both stores — no IAP work needed.

**Exit criteria**: `eas build` produces installable .aab/.ipa; internal-track/TestFlight installs pass the complete parity checklist against the production API; demo customer + staff review accounts exist and are documented in both consoles; the account-deletion blocker is resolved upstream and mirrored on mobile. Checkout and contact join this checklist only after their explicitly recorded upstream blockers are resolved.

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
│   └── admin/_layout  login  index  orders  order/[id]  products  categories  offers
│       collections  advices  shop-media  reviews  sales  staff  trash
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
