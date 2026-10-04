# Capella Mobile App (Expo / React Native) — Customer Storefront (ERP stays web)

> Status: **implementation active; V1 launch contract audited against repository code on 2026-10-04.** Phase 0 auth transport is implemented; scaffold, theme/language/storage, and part of the API client exist. Customer providers and production storefront screens remain planned. Existing code is not proof of device acceptance or launch readiness; see the evidence ledger and launch gates below.
> Decisions: React Native via **Expo** (App Store / Google Play distribution), **storefront-only app** — the ERP stays on the web; its planned redesign will make it fully mobile-responsive and installable as a **PWA** for staff, and a native admin slice remains a possible later additive phase. **Full functional and visual parity** with the working customer storefront, adapted to native navigation and phone interaction. Parity preserves supported product behavior, not implementation defects or simulated success. Exceptions and additional launch requirements must be explicit in this contract.
>
> Build order: the phases below are strictly sequential slices — each one is small, verifiable, and leaves the repo green. A phase is "done" only when its **Exit criteria** pass.

## Current-code correction checkpoint — before further foundation implementation

The complete current mobile workspace audit is recorded in [mobile-code-audit.md](mobile-code-audit.md). It covers all 39 tracked mobile files, fresh mobile-only lint/typecheck/tests/both-platform exports, the failed Expo dependency check, and 11 focused failing diagnostic assertions.

Correct **B1–B9** in that record before expanding the existing foundation: Expo dependency alignment; structured API errors; checkout response typing; invalid-data handling; auth retry session ownership; startup RTL failure; language-switch concurrency; canonical theme colors; and production API URL validation. Preserve the audit's retained behaviors and add permanent regression coverage while fixing them. No fixes are completed by recording this checkpoint.

Complete the next slice's prerequisite integrations and the existing device-acceptance gates too. Future screens/providers, 1×1 asset replacement, OTA delivery setup and other scheduled work are recorded separately; their current absence is not labeled a broken implementation. Follow the audit's closure checklist, then continue the phase sequence.

## Context

The monorepo ships three web workspaces today:

| Workspace | Stack | Role |
|---|---|---|
| `apps/api` | Express 4 REST, Drizzle/MySQL, port 4000 | Backend (`/api/v1` storefront, `/api/erp` admin) |
| `apps/storefront` | Next.js 16, Tailwind 4, ar/en + RTL | Customer shop |
| `apps/erp` | Next.js 16, Arabic-only | Staff admin |
| `packages/shared` | Raw TS (types, i18n, zod schemas, dto, constants) | Shared by all |

The mobile workspace exists at `apps/mobile`, is included by the `apps/*` pnpm workspace glob and Turborepo, and currently boots a temporary product-list/language acceptance screen.

### Resolved implementation decisions

- **Storefront-only (decided 2026-08-13; supersedes the earlier combined-app decision).** The ERP is not part of the mobile app. Rationale: ~4 staff total; the ERP web app is getting a full redesign plus new domains (currency, countries, shipping), so mobile parity with today's ERP would be built twice; a web deploy reaches staff instantly with no store review; and a public store listing whose admin area serves one company's staff invites Apple 3.2 scrutiny.
- **Requirements this places on the ERP redesign**: full mobile responsiveness and a **PWA setup** — web manifest, icons, installable home-screen experience — so staff get an app-like entry point on their phones; web push for order notifications is an optional later addition. The Phase 0 mobile token flow for `/api/erp/auth` stays in place as unused groundwork for a possible future native admin slice. ERP redesign acceptance is separate from this customer-app launch.
- Use the **current stable Expo SDK at implementation time** and let `expo install` select its compatible React and React Native versions. Do not retain stale hard-coded SDK versions merely to use Expo Go.
- Use an installable Expo development build for reliable Android/iOS testing. Expo Go may be used for checks it supports, but it is not an acceptance environment for dynamic RTL switching.
- Mobile participates in the repository's complete validation suite with `build`, `lint`, `typecheck`, and `test` scripts. Every phase runs all applicable validation and leaves the repository green, not merely typechecked.
- Checkout is implemented upstream, including COD, Paymob, shipping quotes, total-change validation, payment status/retry, and fulfillment/cancellation. Mobile reproduces those contracts; checkout is a mandatory launch gate, not deferred functionality.
- **Contact/support (confirmed):** V1 uses the existing WhatsApp support link. No native contact-submission/attachment form is included. Map customer support/contact links to WhatsApp, with browser fallback where needed; never reproduce the web form's simulated success.
- Account deletion is absent upstream and is a launch blocker: implement the API and web deletion entry point, then mirror it in mobile before submission. Deletion/retention behavior is decision D9.
- Password recovery and email verification are explicitly excluded from upstream V1 (`docs/storefront-erp-spec.md`, Authentication). They remain excluded here unless scope is explicitly changed.
- **User decisions confirmed after audit:** support current, previous and review-candidate releases; block only incompatible features; launch on Android/iOS; play videos inside the app; ask for login again if the session cannot be recovered safely; revoke the server session immediately when logout reaches the API; retain guest cart/Ask Capella cache until cleared and signed-in carts in the DB; reset transient search/filter/checkout form state after restart; ship minimum account deletion and customer review-safety controls; staff review handling stays in ERP; notify the user about production failures. See D1–D12 for decisions and remaining technical details.

### Verified constraints (from code exploration)

1. **`@capella/shared` ships raw TS** — its `exports` map points at `.ts` source and internal imports use NodeNext-style `./x.js` specifiers. Metro needs a custom `resolveRequest` that strips the `.js` extension so the `.ts` file resolves. The root export (types, i18n, dto, schemas, constants, ordering) is pure TS + zod and fully reusable. **`@capella/shared/ui` is DOM-only (Radix/Tailwind) — must not be imported on mobile.**
2. **Mobile auth transport is implemented.** Explicit `x-client: mobile` requests without browser Origin use header/body refresh tokens and JSON token rotation; web remains cookie-based. This header selects transport, does not identify an app version, and is not authentication. Remaining auth correctness issues are tracked in the upstream register below.
3. **API base URL**: `resolveApiBase()` in `packages/shared/src/api/base.ts` branches on `window` — mobile needs its own resolver from `EXPO_PUBLIC_API_URL`. A device can't reach `localhost`; the Android emulator uses `10.0.2.2`.
4. **i18n**: `packages/shared/src/i18n` (`getDict`, `isRtl`, `dir`, complete ar/en dictionaries including legal pages as `{h|p|ul}` block arrays under `dict.pages`) is framework-agnostic — reuse as-is. Storefront default language is `ar`.
5. **Styling source of truth**: the Parchment OKLCH palette in `apps/storefront/src/app/globals.css` (`--canvas: #f1f0ed`, ink near-black, white surfaces, radii 6/10/16/24, fonts Roboto / Tajawal / Lobster). React Native doesn't parse OKLCH → convert once to hex constants in a mobile `theme.ts`.
6. **Data layer to mirror**: `apps/storefront/src/lib/api/client.ts` + `client/{http,normalizers,selectors,types}.ts`, search/filter helpers, and provider behavior. Guest cart is local `CartLine[]`; registered cart also synchronizes through GET/PUT `/api/v1/cart` with a persisted last-synced snapshot. Checkout uses the shared request/response schemas, shipping address/quote contracts, and `expectedAmountCents`; its response is a `cod_order` / `paymob_redirect` union, not always an order.
7. Locale reaches the API via the `x-lang` header. Wishlist/orders/reviews are Bearer-authed under `/api/v1`; admin endpoints live under `/api/erp` behind a separate login + permissions middleware. CORS is irrelevant for native clients (no Origin header).

### Evidence and source-of-truth ledger

The initial V1 scope audit read code/configuration and existing coverage without running checks. The subsequent [current-mobile-code audit](mobile-code-audit.md) records fresh mobile-only validation and reproduced defects. Neither inspected provider accounts or established production/device acceptance. Record commands, results, build/update identifiers, devices, OS versions and dates for each acceptance; do not treat historical green claims as current proof.

| Area | Code already answers | Remaining implementation/acceptance |
|---|---|---|
| Mobile foundation | Workspace, fonts, Arabic default, persisted language, native RTL reload, safe-area setup, API URL resolver, HTTP timeout/retry adapter | Device/release-build acceptance and lifecycle/error handling |
| API/auth | Customer and admin mobile transport, rotating refresh sessions, web cookie compatibility | Upstream auth register; mobile token-store/provider implementation |
| Checkout | Server pricing, idempotency, COD/Paymob union, shipping agreements, retry/status and unresolved-payment protection | Complete native client/UI and interrupted-payment acceptance |
| Cart | Local validation, server cart merge/snapshot/upload behavior and relevant web tests | Native port, account isolation, lifecycle and failed-sync acceptance |
| Orders/reviews | Fulfillment/refund states, eligible cancellation, item review eligibility, prompt claim, staff review controls | Native parity and public-content safety requirements |
| Release | EAS project linkage, build profiles, updates URL, appVersion runtime policy | Channels/environments, distribution evidence, rollout/rollback, store review |

`docs/storefront-erp-spec.md` still contains stale claims about no DB-backed cart, ignored shipping cost and read-only customer orders. Do not use those claims to remove working functionality. This plan's code-backed parity matrix governs mobile V1; reconcile conflicting upstream documentation separately. Freeze an accepted parity matrix against a recorded repository revision before release, and review subsequent storefront/API changes for mobile impact.

---

## Phase 0 — API: token-based auth for mobile (backend prerequisite)

This implemented transport addition preserves ordinary web auth responses. The separate auth correctness fixes in the upstream register must preserve supported successful flows, while deliberately correcting invalid-input/failure behavior; the transport requirement does not prohibit those fixes.

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

Previously recorded implementation verification: Expo Doctor, dependency compatibility, lint, typecheck, tests, and Android/iOS exports were green. Revalidate the current revision when accepting changes. A device launch was deferred because the workspace lacked an Android SDK/emulator/device and runs on Windows without an iOS toolchain; current tool/device availability must be checked before relying on that historical limitation.

### EAS development-build status and future device workflow

- **Connected:** `apps/mobile` is linked to Expo account `alzatary`, EAS project `@alzatary/capella-care` (`4849c50d-3d67-4bca-9bdd-316605f03fa2`). `app.json` contains the owner/project link and `eas.json` contains Android/iOS development, preview, and production profiles.
- **Acceptance evidence pending in this document:** the earlier record says no cloud development build or installed APK. The repository alone does not establish current EAS/device state; record the actual build/install evidence before marking acceptance complete.
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
| `apps/mobile/src/theme.ts` | Convert the actual Parchment CSS OKLCH values to canonical sRGB/hex; the previous draft hex list is incorrect for nine tokens (audit B8 gives measured conversions). Preserve matching canvas `#f1f0ed`/white surface, radii {6,10,16,24}, spacing and language fonts (Roboto / Tajawal / Lobster); complete existing storefront tokens when components need them. |
| `apps/mobile/src/constants/storage.ts` | AsyncStorage/SecureStore keys — reuse web names: `capella.cart.v1`, `capella.auth.v1`, plus `capella.lang.v1`, secure keys for refresh tokens |
| `apps/mobile/src/lib/lang.tsx` | `LangProvider` + `useLang()`: language (`ar` default) + `getDict`/`dir` from `@capella/shared/i18n`, persisted; switching updates `I18nManager.allowRTL/forceRTL` and reloads the installed app with the SDK-supported app reload API so layout flips natively. Dynamic RTL is verified in a development build, not Expo Go |
| `apps/mobile/app/_layout.tsx` (edit) | load fonts (expo-font + google-font packages), keep splash until ready, wrap in `LangProvider` + SafeArea |

**Additional foundation requirements**: validate persisted values before hydration; define versioned migrations and rollback-safe handling for approved caches, auth and payment recovery. Guest cart and Ask Capella conversation persist until explicitly cleared; signed-in cart reloads from the API/DB and retains safe pending-sync data. Search/filter choices and checkout form fields are RAM-only and reset on process restart/reload. Existing language preference and secure auth storage remain foundation state, not a browsing/form cache. Keep only the minimal technical checkout reference/idempotency state required to resolve an interrupted charge, not a persisted name/address/form draft; record this necessary recovery exception explicitly in D6. A cache-clear action must distinguish conversation/cart cache from credentials and unresolved payment recovery. Storage failure must not publish an unpersisted rotated token. Extend theme tokens as needed and validate conversions visually. Warn/defer a language-triggered reload during checkout/payment; do not silently interrupt a critical operation.

**Exit criteria**: build/lint/typecheck/tests green; a development build boots in Arabic with Tajawal, toggling to English reloads LTR with Roboto, and toggling back restores RTL. Verify first launch, persisted preference, failed storage/reload, larger text, and upgrade over existing saved data. Confirm the same language behavior in release builds before launch.

---

## Phase 3 — Data layer: API client

Pure TS, no UI. Ported from the storefront (`apps/storefront/src/lib/api/`) minus Next-isms (`next: { revalidate }`, `NEXT_PUBLIC_API_URL`).

**Files**

| File | Purpose |
|---|---|
| `apps/mobile/src/lib/api/base.ts` | `API_BASE` = `EXPO_PUBLIC_API_URL`, falling back to the emulator/simulator URL by `Platform.OS` **only when `__DEV__`**; in a production build a missing variable is a startup error, never a dev-URL fallback |
| `apps/mobile/src/lib/api/http.ts` | 15-second request/body timeout and 401 → refresh → retry-once adapter already exist. Complete structured errors preserving HTTP status, API code and safe message, including upstream `error`/`message` formats; supply language and approved version diagnostics. Checkout idempotency survives retries. Add authenticated PUT for server cart sync; never retry a non-idempotent mutation merely because the connection failed. |
| `apps/mobile/src/lib/api/types.ts`, `normalizers.ts`, `selectors.ts` | adapt boundary types/normalizers; media URLs resolved against `API_BASE`; category IDs disambiguate repeated slugs; do not assume TS casts validate network data |
| `apps/mobile/src/lib/api/client.ts` | catalog, advice, shop-media, announcements, orders/detail/cancel, reviews/prompt, wishlist, GET/PUT cart, checkout union, Paymob methods/status/retry, shipping availability/quote. Some exist already; announcements/cart/shipping/payment recovery/cancellation remain missing in the audited native client. |

**Exit criteria**: build/lint/typecheck/tests green; a temporary debug call lists real products from a running local API. Boundary tests cover all client operations, both checkout response kinds, structured shipping/payment errors, missing/malformed payloads, timeout during body reading, unauthorized/session-changed responses, and idempotency preservation. Screens must distinguish failed required reads from a successful empty result; optional decoration may fail without blocking the main task. Existing `getJSON` defaults can turn connection failure into null/empty arrays, so callers must deliberately choose the required-read behavior.

---

## Phase 4 — State providers: customer auth & cart

**Files**

| File | Purpose |
|---|---|
| `apps/mobile/src/lib/auth/token-store.ts` | access token in memory with session revision/listeners + single-flight refresh; refresh token in SecureStore; auth transport headers as Phase 0. Persist the rotated refresh token before publishing access. Genuine rejection/logout clears local credentials; transient network/server failure preserves recoverable state. If safe recovery fails, ask for login again. Logout requires immediate server-side invalidation of that session's access and refresh credentials, not just local clearing; see D5 for offline limitations. |
| `apps/mobile/src/lib/auth/auth-context.tsx` | `AuthProvider` + `useAuth()`: login/signup/logout/bootstrap-from-storage; user profile in AsyncStorage (`capella.auth.v1` shape) |
| `apps/mobile/src/lib/cart.tsx` | Local guest cart plus registered GET/PUT server sync. Port `normalizeCartLine`, last-synced snapshot/additions/merge behavior and serialized latest-snapshot uploads from the web provider. Preserve local cart on failed pull; never overwrite server cart before a successful pull. Preserve checkout clear against an older in-flight pull and isolate accounts. Totals reuse shared pricing; server checkout remains authoritative. |
| `apps/mobile/app/_layout.tsx` (edit) | mount `AuthProvider` + `CartProvider` |

**Exit criteria**: build/lint/typecheck/tests green; login survives reload, consecutive rotations, and forced 401; rejection/logout clears local session; transient failure does not masquerade as rejection. Test account switching with old requests in flight, cold start, foreground after expiry, logout while offline, token persistence failure, and the agreed lost-rotation recovery. Cart survives restarts and failed catalog/sync reads; web/mobile registered cart sync, guest merge, no doubled quantities on reload, serialized retry, account isolation, and clear-vs-pull races pass.

---

## Phase 5 — Design-system components

Native equivalents of the web look, all styled from `theme.ts`. Icons via `@expo/vector-icons` (lucide is DOM-only).

**Files** — `apps/mobile/src/components/`: `screen.tsx` (safe-area + canvas bg), `button.tsx` (primary/outline/ghost, pressed = accent-deep), `input.tsx`, `price-text.tsx` (EGP + strikethrough original), `rating-stars.tsx`, `badge.tsx` (new/bestseller/offer from `dict.badges`), `qty-stepper.tsx`, `media-image.tsx` (bilingual `EntityMedia` → url by lang, expo-image), `product-card.tsx`, `section-header.tsx` (eyebrow style), `empty-state.tsx`.

Also provide reusable loading/error/retry states, accessible modal/confirmation behavior, filter/sort/column controls, native sharing, and an entity gallery supporting images, uploaded video, linked video and full-screen viewing. Videos play inside the app (D4); select/test native playback for uploaded files and the appropriate embedded provider presentation. `expo-image` alone does not implement video playback. Failed playback shows a useful in-app error/retry; external playback is not the normal path.

**Exit criteria**: build/lint/typecheck/tests green; gallery renders components in ar/en. Verify VoiceOver/TalkBack labels, roles, selected/disabled states and focus; large system text, contrast, practical touch targets, keyboard-safe forms, safe areas/system bars, reduced motion and native Back/close behavior. Hover-only behavior is adapted to touch. Pause media/timers when hidden/backgrounded.

---

## Phase 6 — Customer slice A: browse & catalog (first real screens)

Merged slice (former Phases 6 + 9): all read-only customer surfaces land together — browse, offers, collections, and static pages — so the whole catalog navigation graph is verified in one pass.

**Files** — `apps/mobile/app/`:
- `app/index.tsx` — **deleted** (Phase 1 placeholder); `(tabs)/index.tsx` becomes `/`
- `(tabs)/_layout.tsx` — tab bar: Home, Shop, Cart, Orders, Account (labels from `dict.nav`)
- `(tabs)/index.tsx` — Home: shop-media hero sections, new arrivals, bestsellers, offers/sets rails (mirrors web home/shop)
- `(tabs)/shop.tsx` — catalog corresponding to web `/products`; Home corresponds to web `/shop` (web `/` redirects there). Preserve bilingual name/keyword search, category branches, price filters, default API merchandising order, newest/name/price sorting, reset behavior and one/two-column controls. Use category IDs for ambiguous slugs.
- `new.tsx` and `bestsellers.tsx` — dedicated filtered product lists matching the current `/new` and `/bestsellers` routes
- `category/[slug].tsx` — grid filtered via `getCategoryBySlug`/`categoryId`
- `product/[slug].tsx` — media gallery with dots, size/variant selector, discount pricing, description/ingredients/how-to-use/warnings sections, related items, add-to-cart (reviews & wishlist buttons land in Phase 7)
- `offers/index.tsx` + `offer/[slug].tsx`, `collections/index.tsx` + `collection/[slug].tsx` — bundle contents, savings badge, add-bundle-to-cart, unavailability states (review list/submit components are wired in during Phase 7)
- `page/[key].tsx` — generic renderer for `dict.pages.{about,privacy,terms,termsSale,returns,shipping}` `{h|p|ul}` blocks, including working inline internal/external links
- Shop/products advice cards reproduce the current advice content and YouTube/Instagram presentation using native navigation and WebView/external-link handling as appropriate to the same source URL.
- `search.tsx` plus native global-search/Ask Capella surfaces — reproduce search matching/results and error/empty states. Ask Capella remains the existing search interaction, not a new AI backend. The user-approved mobile exception is a conversation cached until explicitly cleared, rather than the web tab-session lifetime. Search/filter/form state remains transient (D6).
- Announcements, five shop-media slots and their exact placement/order, mobile/language image fallbacks, banner target mapping/deleted-target fallback, and support/social/legal navigation are explicit parity requirements.
- Detail/card behavior includes buy-now, cart-derived add/quantity controls with known stock limits, ratings, sharing, linked offers, and related products/offers/collections. Add-to-cart is a local mutation available in this slice; checkout/wishlist/review submission lands in Phase 7.

**Exit criteria**: build/lint/typecheck/tests green; the read-only rows of the parity matrix below and local cart actions work in both languages on-device. Test missing/deleted targets, repeated category slugs, unavailable stock, no results, required-read errors, media failures, banners, native share, static inline links and safe external-link fallback. Add-to-cart and bundle actions update cards/cart/tab badge; complete buy-now acceptance in Phase 7. Reachability must include global search and overlays, not only tabs/account.

---

## Phase 7 — Customer slice B: cart, checkout, accounts, orders, wishlist, reviews

Merged slice (former Phases 7 + 8): everything that mutates state or needs a customer session.

> **Known unfinished upstream functionality:** contact does not currently work end-to-end in the existing app. Checkout is implemented upstream, including COD and Paymob, so mobile must reproduce that contract and behavior without mobile-only payment changes.

**Files**
- `(tabs)/cart.tsx` — lines joined against fetched products/offers/collections, qty steppers, totals, mirrors `cart-view.tsx`
- `checkout.tsx` + `order-success` + `checkout/payment-result.tsx` — shipping availability, hierarchical destination selection/quote, total review, COD/Paymob, hosted checkout, pending recovery and polling/retry. Preserve the checkout idempotency key before submission and reuse it for the same attempt after an uncertain response; persist pending checkout before leaving the app. The provider return is not payment proof: only API-confirmed completion clears the cart. Changed totals/quotes require review, and unresolved evidence must never invite another charge. Follow the existing free-order behavior. Browser/WebView return strategy is D3.
- `login.tsx`, `signup.tsx` — mirror web auth forms
- `(tabs)/orders.tsx` + `order/[id].tsx` — historical item name/size/price snapshots and live-image fallback; payment and fulfillment/refund/return/exchange states, refresh, eligible cancellation/confirmation, unavailable-cancellation errors, and order-item review entry points. Eligibility comes from the API; mobile does not recreate carrier rules.
- `(tabs)/account.tsx` — read-only current customer identity, language, support/legal links, logout and in-app deletion. No profile editing, saved-address CRUD or password-management feature is implied by the word "profile"; these have no existing customer API contract.
- `wishlist.tsx` plus a shared native provider — product/offer/collection list/toggles, current availability, consistent hearts, loading/errors and safe rollback. Account/session guards prevent stale requests from replacing another customer's data. Fix the upstream race in U6 rather than copying it.
- Reviews — list/pagination, verified-purchase eligibility, submit, order-item entry points and optional global prompt claim; wire detail screens and order detail. Prompt failures must not interrupt browsing. Public-content reporting/moderation/blocking is U8/D11, not satisfied by star/comment validation alone.
- Contact/support is the WhatsApp link (D10); do not implement a native submission/attachment form in V1. Preserve reachability from account/legal/payment-support links.

**Exit criteria**: cart behavior and tests match the supported web behavior; guest→login→order history→wishlist→submit review full loop works; logged-out states show the same login-required messaging as web; the entire parity matrix is reachable from native navigation/search/overlays and passes. Real COD and Paymob test orders placed from the phone must appear in the ERP web app with translated validation errors in both languages. Contact follows D10 and must never show false successful delivery.

Additionally test login/signup returning to the original intended native route, guest checkout, expired credentials during checkout, double taps, timeout after submission, browser cancel/back, delayed webhook, failed payment/retry restrictions, force-close/reopen while pending, language reload, shipping changes and concurrent cart edits. Reconcile purchased items against cart changes during payment according to D7. Complete fulfillment/cancellation, deletion and public-review safety acceptance; do not mark this phase accepted from mocked requests alone.

---

## ERP on mobile — resolved: stays web (no phases)

The former native ERP slices (admin foundation/dashboard/orders; catalog management; operations & administration) are **removed, not deferred**. Staff use the ERP web app; its planned redesign must ship full mobile responsiveness and a PWA install path (see Resolved implementation decisions). If a native admin slice is ever wanted, it is an additive route tree (`app/admin/` + `src/lib/admin/`) on top of the shipped storefront app — Phase 0's admin mobile auth already supports it.

---

## Phase 8 — Store readiness (needs user accounts)

EAS build profiles/project link already exist. Finish preview/production environments and OTA channels, version/build-number procedure, real icon/splash assets, Android adaptive icon, privacy declarations, signing/account ownership and recovery, store listings and reviewer instructions. Production API URL is configured in `eas.json`; verify the same intended environment when publishing OTA updates. Requires Apple Developer + Google Play accounts and external acceptance evidence.

### Store review requirements (customer app)

- **Review credentials**: Apple (guideline 2.1) and Google Play (the "App access" declaration in Play Console) both require working credentials for every login-gated area of the app. Prepare a demo **customer** account against an API that stays reachable for the entire review window.
- **Account deletion**: implement U7/D9; include confirmation, verification, revoked credentials, local cleanup, review-content handling, completion/failure states and the web entry point. Account deactivation is not a substitute for deletion.
- **Data disclosure forms**: inventory actual customer/order data, storage, diagnostics, SDKs and embedded third-party media; make privacy policy, Apple labels/manifests and Play Data safety agree with shipped behavior. Do not assume absence of a tracking SDK proves no third-party data collection. Include permission-denial handling for any approved feature needing permissions.
- **Reviews**: satisfy the applicable public user-generated-content requirements through U8/D11 before submission.
- **Payments**: checkout sells physical goods through COD/Paymob, not digital purchases; no IAP feature is planned.
- Re-check current store SDK/target-OS, privacy, content rating, account/testing and submission requirements at submission time; do not freeze time-sensitive policy details into an old plan.

**Exit criteria**: Android internal-track and iOS TestFlight installations pass the launch gates below against the approved environment, including COD/Paymob and shipping. Reviewer account/API access works; deletion and review-safety blockers are resolved; store declarations match the release. Test release builds without Metro, fresh install and upgrade, compatible OTA update and rollback. Contact follows the approved exception D10. No mandatory gate may be silently deferred until after submission.

---

## Target file tree (end state, abridged)

```
apps/mobile/
├── app.json  package.json  metro.config.js  babel.config.js  tsconfig.json  .env.example
├── app/
│   ├── _layout.tsx                    # fonts, splash, Lang/Auth/Cart providers, Stack
│   ├── (tabs)/_layout.tsx  index  shop  cart  orders  account
│   ├── new  bestsellers  search
│   ├── product/[slug]  category/[slug]  offers/  offer/[slug]
│   ├── collections/  collection/[slug]  checkout  login  signup
│   └── wishlist  order/[id]  order-success  checkout/payment-result  page/[key]
│       # support opens WhatsApp (D10); update-required/deletion states need reachable UI
└── src/
    ├── theme.ts  constants/storage.ts
    ├── lib/lang.tsx  cart.tsx  wishlist.tsx
    ├── lib/checkout/                 # durable attempt/pending recovery; native return handling
    ├── lib/updates/                  # version policy and OTA lifecycle
    ├── lib/api/{base,http,types,normalizers,selectors,client}.ts
    ├── lib/auth/{token-store.ts,auth-context.tsx}
    └── components/{screen,button,input,price-text,rating-stars,badge,
        qty-stepper,media-image,product-card,section-header,empty-state}.tsx
```

The tree is illustrative, not permission to omit behavior outside the named files. Choose compact file boundaries during implementation; the requirements and acceptance gates govern completion.

## V1 parity matrix — code-backed product scope

Every row requires a reachable native surface and acceptance in Arabic/English. A web URL does not require an identical native URL, but every internal link/banner/search result must map consistently. Preserve native adaptations without introducing a second product behavior.

| Web surface/behavior | Native contract | Source to consult |
|---|---|---|
| `/` and `/shop` | Home merchandising; offers, collections, bestsellers, new, tips and five interleaved media slots in existing order | `apps/storefront/src/app/[lang]/shop/page.tsx` |
| Header and global navigation | Announcements, category tree, catalog/bundle links, search, account/cart/wishlist and support/legal reachability | `components/layout/header.tsx`, `lib/header-menu.ts`, locale layout |
| `/products`, `/new`, `/bestsellers` | Catalog, selected subset, filters/sorts/reset/column count; preserve default API ordering | `hooks/use-product-grid-filters.ts`, `components/products/grid/` |
| `/category/[slug]` | Branch/subcategory navigation with categoryId disambiguation and scoped filtering | category page, `lib/category-links.ts`, API product read repository |
| Search and Ask Capella | Existing preview/full-results distinction, bilingual names/keywords, category preview links and retry/error states; mobile conversation cached until cleared, search/filter state RAM-only | `lib/storefront-search.ts`, `lib/product-search.ts`, `hooks/use-ask-capella.ts`, search page; D6 overrides web thread lifetime |
| Product/offer/collection detail | Pricing, stock, variants/bundle contents, buy-now, quantity/cart state, linked/related items, sharing, gallery/full-screen and uploaded/linked video | detail components, `components/ui/entity-media-gallery.tsx`, `share-button.tsx` |
| Shop media and tips | Mobile-specific image selection with existing language/viewport fallbacks; every target type and deleted-target fallback; YouTube/Instagram behavior | `components/shop/shop-media-strip.tsx`, `lib/advice-video.ts` |
| `/cart` | Guest cache persists until cleared; registered cart reloads from account DB through API with cross-device sync; safe merges/retry/clear; catalog enrichment does not redefine historical/order prices | cart provider, `lib/cart.ts`, `/api/v1/cart`; D6 |
| Login/signup and gated tasks | Existing guest access, immediate signup login, intended-route return, recoverable bootstrap, session isolation | auth provider/API, `lib/auth-redirect.ts` |
| Checkout/payment-result | Authoritative prices, shipping agreement, COD/Paymob/free-order response, durable idempotency, recovery, status/retry and support | `hooks/use-checkout.ts`, `lib/paymob-browser-session.ts`, `components/checkout/paymob-result.tsx`, API checkout/shipping |
| Orders/detail | Snapshot names/sizes/prices, live-media fallback, fulfillment/refunds/related shipments, refresh, eligible cancellation and review entry points | `components/orders/`, API orders/customer-shipping |
| Wishlist | Products/offers/collections, availability and consistent hearts; session isolation and safe failed mutations | wishlist provider/view, API wishlist |
| Reviews | Ratings/pagination, paid-purchase eligibility, one-submission rules, detail/order entry points and optional global prompt | review provider/components and API reviews; U8 adds launch safety |
| About/legal/support | Shared structured pages with mapped inline links; existing WhatsApp/social links; contact/support maps to WhatsApp, no native submission form | `components/pages/static-page.tsx`, `lib/inline-links.tsx`, footer/social constants; D10 |
| Account and deletion | Native account hub for identity/language/links/logout; deletion is a mandatory additive upstream requirement | Phase 7 and U7/D9 |

Screen/account guards must also cover a response arriving after logout, a different account login, route replacement, language change or unmount. Do not port the unguarded web wishlist race. Deleted/unavailable items and unknown future enum values require safe presentation, not a crash or a false success.

## API compatibility, old app support and delivery contract

### Independent versions and release paths

| Identifier | Meaning | Does not guarantee |
|---|---|---|
| App version, currently `1.0.0` in `app.json` | User-facing store release | Which OTA JavaScript currently runs |
| Android versionCode / iOS buildNumber | Platform build identity; record/increment on native release | API contract compatibility |
| Expo runtime version | Native/JavaScript update compatibility; current policy derives it from appVersion | Backend compatibility |
| OTA update ID and channel | Actual JavaScript/assets revision and delivery audience | That all users received it |
| API contract `/api/v1` | Supported request, response, error and behavioral contract | Compatibility merely because the URL stayed `/v1` |

API-only compatible changes need a backend deploy; compatible mobile JavaScript/UI changes can use OTA; native dependencies/config/permissions/SDK changes need a new binary. Combined changes deploy a compatible backend first, then deliver mobile through OTA or a store build. A new app release does not automatically require `/v2`; an OTA publish is still a controlled mobile release. Editing source or a development Metro reload does not update installed production apps.

EAS Update groundwork exists (`expo-updates`, updates URL, appVersion runtime policy). Preview/production channels and the publish/rollout/rollback workflow are not yet configured in this repository. Configure and test them before enabling production OTA delivery. With appVersion policy, a native-incompatible change must bump appVersion/runtime and ship a new binary; OTA may target only compatible runtimes. Define when downloads apply; never force an automatic reload while the user submits an order, authenticates, writes critical storage or completes payment. Offline users and users on the embedded bundle remain supported.

### Preserve the supported contract

- Support every promised installed client against the current backend. Preserve requests, required responses, errors, enum handling, validation, authentication, pricing/payment meaning and user-visible outcomes. Compatibility includes what an old screen promises, not just JSON shape.
- Prefer additive endpoints/optional fields with documented defaults. Adding fields/enum values is safe only after verifying the supported clients ignore or handle them. Do not make a previously optional field mandatory without compatibility handling or an approved retirement/update path.
- Shared TS/schema updates align newly built code; they do not update installed binaries or old OTA bundles. Keep fixtures and runnable artifacts for supported old clients independently of the current shared package.
- Keep API origins, asset URLs and payment-return routes embedded in supported installations reachable for the approved support period. Changing the build-time API URL in source does not redirect old installed clients; any domain move needs an explicit compatible transition. Preserve active sessions, pending checkout references and their recovery contracts across backend deploys.
- Fix defects and enforce authorization/payment safety for everyone. Do not retain unsafe behavior to preserve compatibility. If a supported task becomes impossible for an old client, adapt its contract or explicitly require an update before the affected operation; never silently reinterpret its consent or charge a newly calculated amount without the required review.
- For genuinely breaking changes, keep the old endpoint/adapter and introduce an explicit new contract, such as `/api/v2`. Both may call shared current business logic/database. Do not fork/retain the entire old backend by default, and do not branch business logic on every app release number.
- An app-version header is diagnostic/untrusted metadata, not proof of authorization, payment correctness, consent or capability. Server validation remains authoritative.

### Required client-policy integration

Implement a public, versioned policy/bootstrap endpoint available before login, and version-policy handling at the API boundary for affected operations. Final route/header/error names and policy values are D1/D2; they do not exist today and must be documented in shared contract fixtures before implementation acceptance.

Implement shared policy/error contracts and API enforcement with Phase 3, native startup/session integration with Phase 4, accessible update prompts/blocked-feature states with Phase 5, and per-feature recovery integration with Phase 7. Phase 8 verifies distribution/rollout rather than being the first place compatibility is implemented. An update-policy response must use a stable cache/freshness contract that can itself evolve without breaking the first released client.

The policy must represent platform store destinations, recommended update, minimum supported client/capability where needed, affected feature and a localized explanation. **The approved scope is feature-only blocking: keep the rest of the app running.** Record app version, native build, platform, runtime and actual OTA revision with requests/diagnostics. Distinguish installations with the same appVersion but different OTA updates; do not sort opaque OTA IDs. Define an ordered client revision/capability if an OTA change must be required. Evaluate API-contract support too; do not introduce a whole-app version wall as a default or fallback.

The first public binary must understand policy responses and a stable structured `update required` error, offer a working store link, and preserve cart/payment recovery. Optional prompts remain dismissible; required prompts attach to the incompatible feature. Do not disable compatible browsing, support, deletion or payment-status recovery. Unknown/unreachable policy cannot produce a permanent startup spinner or whole-app block: keep compatible features usable and use last-known policy when available. Enforce indispensable feature rules server-side regardless of cached policy/spoofed metadata; an operation needing a live API still cannot claim success while offline.

### Support, rollout, retirement and rollback

1. Maintain **three release states only**: the current deployed/working release, its immediate previous release, and one candidate under Google Play/App Store review. Under review is a candidate, not a third public release. Test backend compatibility for all occupied states, including their actual runtime/OTA revisions. At first launch the previous slot can be empty. Track store availability on both platforms; while a candidate is available on only one, retain the existing current/previous support and do not start another promotion that requires a fourth promised release. Once the candidate is available on both platforms, promote it to current, move old current to previous, and retire the former previous through feature-specific update prompts. Rejected candidates do not change public support. Record promotion/retirement and store links; no extra time-based support window is added.
2. Deploy backend support before mobile uses it. Preserve old inputs/outputs and existing web flows; add adapters/defaults as necessary.
3. Test current web/mobile and retained supported client artifacts against that backend. Ship to preview, then staged production rollout with diagnostic evidence and rollback criteria.
4. Measure usage of app/build/runtime/OTA/contract versions and failed operations without logging credentials or customer/payment payloads. A source-code test suite alone does not establish old-binary compatibility.
5. Before enforcement/retirement, verify the update is available in each affected store/platform, users have a supported upgrade path, and update prompts/recovery work. Store review delays must not cause premature backend breakage. Record the approved notice/enforcement dates and exceptions.
6. Remove old adapters only after approved retirement and verification. Mobile and backend rollbacks must preserve supported contracts and data. Use expand/backfill/contract database migrations where required; do not remove fields/data still read by either production slot or a supported rollback build. If blue-green is used, both slots and their schema dependencies must satisfy these rules; blue-green is not established by current Compose configuration.

**Acceptance**: retain the first public embedded bundle as a regression fixture and test each currently promised current/previous/candidate binary/OTA/contract combination after backend changes. Older retired fixtures test graceful feature rejection, not indefinite supported behavior. Cover missing/invalid metadata, supported/retired clients, newer candidates, staggered platform availability, optional/required feature prompts, continued compatible operation, policy offline/cached failures, stale OTA, successful OTA/rollback, and backend rollback with the deployed schema. Include auth, cart, checkout, shipping, orders/cancellation, wishlist and reviews. Passing current shared types is insufficient evidence.

## Upstream and current-client issue register

These are audit findings, not fixes made by this documentation update. Assign resolution/evidence before accepting the relevant phase; do not mark the register complete from this file change.

| ID | Verified finding / source | Required disposition |
|---|---|---|
| U1 | `auth.routes.ts` passes raw signup/login bodies; shared `signupSchema`/`loginSchema` exist but are unused. Signup has no route rate limiter. | Apply consistent boundary validation and define/test signup abuse protection; keep web/mobile errors usable. |
| U2 | `auth.controller.ts` refresh catch maps every failure to 401, including operational failures. | Distinguish true rejection from transient/server failure so the mobile provider does not erase a valid session on outage. |
| U3 | `auth-session.service.ts` revokes the old refresh token before replacement delivery; the native app may never receive/persist the new token. Separate DB revoke/create operations also leave a failure window. | Make rotation atomic where needed and test interruption. The approved safe fallback is re-login; do not weaken replay protection to avoid it. |
| U4 | Customer middleware verifies JWT signature/expiry/role but does not consult its `sid` or revoked session. Logout revokes refresh, not already-issued access JWTs. | Implement immediate access/refresh invalidation for the logged-out session when the API receives logout; deletion must invalidate the affected account sessions. Test both, and expose offline limitations honestly. |
| U5 | Cart, wishlist, storefront advice and shop-media routes pass rejecting async handlers directly to Express 4; the repository already has `wrapAsync`. | Forward failures consistently to error middleware; test provider/DB failure returns a response instead of an unhandled rejection. |
| U6 | Web wishlist provider can apply an old-account response after logout/account switch and turns failed reads into empty state. | Guard sessions/requests and distinguish failures; native behavior must not reproduce the race/false empty presentation. |
| U7 | No account-deletion API/web entry point exists. | Implement the approved deletion/retention/verification contract upstream and native UI before store submission. |
| U8 | Reviews are published active after purchase/schema validation; staff can hide/delete them, but no customer report/block flow exists in the reviewed storefront routes. | Resolve public-content filtering/reporting/abuse-handling requirements, support process and matching web/mobile/API integration (D11). |
| U9 | Native `submitCheckout` declares an order-only response; `http.ts` drops HTTP/API error identity; cart PUT and announcements/shipping/payment recovery/cancellation client operations are absent. | Complete Phase 3 against actual shared checkout union and upstream API; do not make screens depend on the incomplete types. |
| U10 | Web contact form waits then shows successful delivery without sending a request. | Keep deferred mobile presentation truthful (D10); track upstream fix if contact is included. |
| U11 | Mobile plan status/context and upstream storefront specification contradict current auth/cart/shipping/orders code. | This update corrects mobile scope; reconcile upstream docs separately. Historical device/build/testing claims require fresh evidence. |

## User decisions and remaining implementation details

The answers below supersede the earlier open questions. Do not reopen settled product choices merely to choose libraries, routes or schema names. Remaining technical details use engineering judgment and validation; external account access, notification destination and actual data-retention policy still require concrete information before their dependent acceptance gates can pass.

| ID | Confirmed choice / recommendation | Remaining detail / acceptance |
|---|---|---|
| D1 | **Confirmed:** current deployed, immediate previous, and one under-review candidate; keep it simple, no additional support window. | Apply the promotion/staggered-store rules above; map runtime/OTA/API fixtures to each release state. |
| D2 | **Confirmed:** block only the incompatible feature; keep the rest running. | Implement stable policy/error contracts and cached/offline handling without an app-wide wall. Thresholds derive from supported release/capability policy, not arbitrary prompts. |
| D3 | **Professional recommendation requested:** use the platform browser sheet for existing Paymob hosted checkout (Safari view on iOS / Custom Tabs on Android), with app return and API status recovery, rather than a custom payment WebView. | Recommendation, not a claim of device/provider acceptance. Select the appropriate Expo browser API, validate bank verification/wallet redirects, return-link/domain configuration and both-platform failure/resume paths before Phase 7 acceptance. |
| D4 | **Confirmed:** videos play inside the app. | Select native uploaded-video playback and embedded YouTube/Instagram presentation; test full-screen, errors, controls and background pause. |
| D5 | **Confirmed:** ask for re-login if recovery is unsafe; logout must invalidate the session immediately. | U2/U3/U4 must enforce server revocation once logout reaches the API. Offline local clearing is immediate, but server revocation cannot occur before communication; implement/test reconnect handling and do not falsely claim remote revocation while offline. |
| D6 | **Confirmed (latest answer):** guest cart and Ask conversation remain cached until cleared; signed-in cart belongs to the account in DB and reloads through API; other browsing/filter/checkout form data resets after restart/RAM loss. | Preserve established language/auth foundation state and minimal technical payment recovery, not form drafts. Provide explicit cache clearing and migration/isolation tests; clearing guest/conversation cache must not erase an unresolved payment reference. |
| D7 | **Confirmed scenarios:** successful purchase clears its cart, so later additions start a new cart; truly unpaid cancelled/aborted purchase retains its cart, so another addition remains part of it. | Browser dismissal is not proof of no charge. Reconcile API status first; do not clear a new post-completion cart on a delayed duplicate confirmation. Handle in-flight/cross-device edits without silently deleting unrelated additions; test submitted-cart identity/quantity reconciliation. |
| D8 | **Confirmed:** launch Android and iOS. | Configure/test both environments/channels, signing/account access, OS/device matrix, performance and rollout/rollback procedure. Do not infer store/provider acceptance from the repository or Android-only testing. |
| D9 | **Confirmed after clarification:** add the minimum required account-deletion flow before launch. | Implement upstream API/web and mobile verification/confirmation/completion; establish actual order/payment retention and outstanding-order handling, review-content deletion and account-session invalidation with matching privacy disclosures. |
| D10 | **Confirmed:** WhatsApp support link for V1; no native contact form. | Reuse the existing support destination with safe browser fallback; map contact links and remove submission/attachment expectations from native acceptance. |
| D11 | **Confirmed after clarification:** minimum customer controls; staff handling stays in ERP. | Add applicable report/block/filtering controls and API integration; keep moderation/response work in the ERP web app. No native staff-management screens or ERP redesign in this scope. |
| D12 | **Confirmed:** notify the user about production failures. | Select diagnostics with technical details and redaction; obtain/configure the actual notification channel/destination and service access. No notifications are sent by this plan update. |

## Mandatory V1 launch gates

- [ ] **Contract completeness**: freeze the parity matrix with confirmed D1–D12 choices; finish their remaining implementation/external details, record exceptions and reconcile references. Required upstream issues are fixed or have an explicitly approved, tested disposition. Minimum deletion and customer review-safety controls are approved launch work, with staff handling in ERP.
- [ ] **Functional acceptance**: complete each phase's code checks and native journey tests; all matrix rows work, including global search, cart sync, shipping, checkout/recovery, order cancellation/reviews and legal/support navigation. No mocked contact/payment success, fake empty state or unsupported dead link.
- [ ] **Device/lifecycle acceptance**: record Android and iOS release-build evidence without Metro; Arabic/English/RTL, keyboard, system text size, screen readers, Back/gestures, safe areas, cold/warm start, background/foreground, force-close, reinstall/restore and permission denial where applicable.
- [ ] **Failure/security acceptance**: timeout/offline/server errors, no accidental logout on transient failure, token rotation/storage failure, account isolation, authorization, cancellation races, stale quotes/stock/prices, duplicate taps/uncertain checkout and delayed provider confirmation. Production traffic uses HTTPS; no dev URL, secret or provider credential is embedded in `EXPO_PUBLIC_*`, the app bundle or OTA assets. Validate external/payment navigation destinations and fail safely on unsupported URLs. Verify existing provider reconciliation/expiry protections rather than replacing them with client decisions.
- [ ] **Upgrade/compatibility acceptance**: fresh install and upgrade over saved data; retained supported client artifacts work against deployed API; optional/required update flows, OTA runtime/channel/environment matching and rollback; migrations preserve the approved rollback/support path.
- [ ] **Operational acceptance**: approved diagnostics with secret/PII redaction, release/app/build/runtime/update identifiers, actionable crash/checkout-failure alerts, performance evidence on the weakest supported device/network, and a named response/rollback owner. Do not log refresh/access tokens, checkout secrets or customer payloads.
- [ ] **Store acceptance**: signing/distribution ownership, store assets/localized listings/content ratings, current platform requirements, privacy/disclosure inventory, reviewer access, reachable production API/support/privacy/deletion links, account deletion and applicable review safety. COD/Paymob/shipping configuration and real provider test acceptance must be recorded, not inferred from source defaults.

Unit/component/API tests already exist and provide useful fixtures; no runnable native end-to-end harness or completed parity checklist was found in this audit. Choose automation appropriate to critical flows and supplement it with recorded real-device checks. Android development acceptance does not stand in for iOS TestFlight acceptance. Keep launch evidence next to this checklist with repository revision, build/update IDs, date, device/OS and result; publishing a build/export alone is not acceptance.

### Official references for release implementation

- [Expo EAS Update](https://docs.expo.dev/eas-update/introduction/), [configuration/channels](https://docs.expo.dev/eas-update/getting-started/), [runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/). OTA changes must also comply with store rules.
- [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/) and [Paymob API checkout paths](https://developers.paymob.com/paymob-docs/integration-paths/apis) support the D3 engineering recommendation. Platform browser integration/hosted checkout still requires real redirect/payment acceptance; this is not a provider claim that every browser or bank flow works without testing.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/): test platform-specific uninstall/backup behavior when implementing D5/D6; do not assume reinstall always clears credentials identically.
- [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app), [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google Play account/data policy](https://support.google.com/googleplay/android-developer/answer/18258653?hl=en), [Google Play user-generated content](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en). Re-check current requirements at submission.

## Out of scope (flagged, not planned)

- Push notifications and general marketing web→app deep links. Payment return/resume, internal banner/legal/search navigation and native sharing remain in scope.
- Password recovery and email verification (upstream V1 exclusions); social login, biometrics, full offline checkout, saved-address management and profile editing are not implied launch features.
- Native contact-submission/attachment form: V1 support is WhatsApp. Native staff review-management screens are also excluded; minimum customer review-safety controls and their API/ERP handling remain required.
- Native ERP/admin screens — the ERP stays web (responsive + PWA via its redesign); a native admin slice remains a possible later additive phase, and Phase 0's admin mobile auth already supports it
