# Capella Mobile App (Expo / React Native) — Customer Storefront (ERP stays web)

> Status: **implementation active; V1 launch contract audited against repository code on 2026-10-04; audit findings B1–B9 fixed and regression-covered the same day.** Phase 0 auth transport and Phases 1–3 scaffold/foundation/data-layer implementations exist, including the shared/API compatibility layer. Customer providers and production storefront screens remain planned. Existing code is not proof of device acceptance or launch readiness; see the evidence ledger and launch gates below.
> Decisions: React Native via **Expo** (App Store / Google Play distribution), **storefront-only app** — the ERP stays on the web; its planned redesign will make it fully mobile-responsive and installable as a **PWA** for staff, and a native admin slice remains a possible later additive phase. **Full functional and visual parity** with the working customer storefront, adapted to native navigation and phone interaction. Parity preserves supported product behavior, not implementation defects or simulated success. Exceptions and additional launch requirements must be explicit in this contract.
>
> Build order: implement and verify the phases sequentially. Track **code verification** separately from **native acceptance**. The user approved Chrome at phone-sized viewports for continuing implementation on 2026-10-05; browser evidence does not satisfy Android/iOS acceptance. Pending device checks do not block subsequent code slices, but remain mandatory before release. A phase is fully accepted only when every applicable exit criterion passes.

## Phase verification ledger — 2026-10-05

Phase 0 evidence was collected against base revision `8d8c893c3480b9de26f83e330446d820a0de5b2e` and committed as `73f20b4`. Phase 1 was committed separately as `d175872`, excluding the saved Phase 2 startup changes. Phase 2 was committed as `d886c59`. Phase 3 starts from `d886c59`; on 2026-10-05 the user approved its complete shared/API prerequisites. Commands run sequentially where they could conflict. Phase 3 changes are confined to `apps/mobile`, its shared/API contracts and integration, this plan, and the approved lockfile; no storefront/ERP source changes.

| Phase | Verified implementation | Status / remaining evidence |
|---|---|---|
| 0 | Customer/admin mobile auth transport; fresh DB-backed HTTP tests and API build/lint/typecheck pass | Transport verification committed as `73f20b4`; repository-wide suite and separate U1–U4 auth hardening are not established by this check |
| 1 | Expo scaffold/shared resolution; web preview; dependency check, lint/typecheck, 13 suites / 107 tests, 1 Chrome Playwright test, web/Android/iOS exports pass | Code and automated Chrome verification complete; manual computer use blocked by URL-policy check; native launch pending |
| 2 | Theme/fonts, bilingual startup recovery, guarded language changes, validated storage/migration/cache-clear primitives; 14 suites / 127 tests, lint/typecheck, Chrome test and all exports pass | Foundation code verified; domain consumers in 4/6/7 and native/release acceptance remain pending |
| 3 | Remaining transports, validated response boundaries, native identity/auth/retries, public policy and feature-only enforcement | Code verified: 2219 repository tests, 2 Chrome checks, fresh lint/typecheck and all builds/exports pass; native/store/OTA acceptance pending |
| 4–7 | Not verified in this pass | Customer state/components/screens remain to be implemented |
| 8 | Existing EAS configuration only | Release/distribution/OTA acceptance pending |

### Mandatory additions mapped to implementation slices

Reviewed the plan changes in `8d8c893` (2026-10-05) and `620dc6c` (2026-10-04). The latest five-item version/update requirements were present in the contract, but needed explicit per-phase checklists. Mark implementation and external/native acceptance separately; configuration scaffolding is not proof of compatibility/OTA acceptance. Finish and commit each phase before starting the next. The user approved complete Phase 3 shared/API changes on 2026-10-05. Storefront/ERP edits and later upstream work still require their own scope authorization.

| Mandatory work | Implementation phase/slice | Acceptance evidence required |
|---|---|---|
| Five native identity headers on every request, auth, config and retry; no device/user tracking | 3B transport; 4A auth integration | Real runtime/build/update metadata fixtures; header and retry preservation; existing web behavior preserved |
| Public `GET /app-config`, versioned response/error contract and feature-only server enforcement | 3B shared/API prerequisites; 3C native client | Pre-login HTTP contract, malformed/missing metadata, stable `APP_UPDATE_REQUIRED` + feature, compatible operations still available; API/shared edits require approval |
| Current/previous/review-candidate support; staggered-store promotion | 3B policy fixtures; 8A release procedure | Fixtures for occupied states; unavailable review candidate never advertised; both-store promotion/retirement evidence |
| Cold-launch/foreground policy checks, cache/freshness/deduplication, offline/no-cache recovery | 4C policy state | Defined freshness/dismissal contract; invalid config and outage tests; startup always settles; no payment interruption |
| Dismissible recommended update and accessible feature-specific update action | 5B components; 7D feature wiring | Both languages; dismissal, safe store destinations, accessibility, compatible features remain usable |
| Preview/production OTA delivery and runtime compatibility | 8A | Channels/environments, build/version rules, embedded/offline support, safe apply timing, rollout/rollback evidence |
| Durable guest cart/Ask cache; transient browsing/forms; migrations and safe cache clear | 2B storage; 4B cart; 6B Ask; 7A recovery | Restart/upgrade/rollback/account isolation; unresolved payment reference survives cache clear |
| Immediate session revocation and safe refresh failure/rotation handling | 4A with U1–U4 prerequisites | Real API tests and native persistence/reconnect checks; upstream edits require approval |
| In-app video, full browse/search/banner/legal parity and accessible interaction | 5A components; 6A–6C screens | Browser journeys plus both-platform playback/lifecycle/accessibility evidence |
| Authoritative checkout/shipping/recovery, purchased-cart reconciliation, eligible cancellation | 3A transports; 7A–7B journeys | Real COD/Paymob/provider tests, uncertain response/restart/duplicate confirmation/concurrent-cart scenarios |
| Minimum account deletion and customer review safety | 7C with U7/U8 prerequisites | API/web/native completion, retention decision, session invalidation/report/block/filter controls; upstream edits require approval |
| Production failure notifications with redacted diagnostic identity | 8B operations (D12) | User-provided destination/service access, redaction and actionable delivery evidence |

## Current-code correction checkpoint — audit closed

The mobile workspace audit is closed: findings **B1–B9** were fixed and covered by permanent regression tests (2026-10-04) — Expo dependency alignment, structured `ApiError` (status + code), checkout `cod_order`/`paymob_redirect` union validation, list/DTO envelope + row validation, auth retry session/token-ownership binding, recoverable startup RTL failure, coalesced language switching, canonical theme colors, and production API URL validation; `apps/mobile` typecheck/lint are green, the suite is 13 suites / 105 tests, and both Android and iOS exports bundle.

The standalone audit record has been removed. Its **open/undone items — which must still be completed** — are recorded here:

- [ ] **Device foundation acceptance (Phase 2):** real development build on device/emulator with build/device/OS/revision evidence — Arabic/English cold start and live RTL/LTR switching, tracked per platform. Exports and unit tests are not device acceptance.
- [x] **Phase 3 transport prerequisite:** authenticated GET/PUT cart and remaining announcements/shipping/payment-recovery/cancellation operations; Phase 4 owns synchronization state and serialization.
- [x] **L1 startup:** Arabic/English font-failure recovery, visible language startup retry and handled splash rejections implemented and regression-covered in Phase 2.
- [ ] **L1 placeholder:** replace the diagnostic product/language screen in Phase 6.
- [ ] **L2:** replace the 1×1 icon/splash placeholders with real verified platform assets in Phase 8.
- [ ] **L3:** add `eas.json` update channels, an explicit preview API environment, and a build-number/publish/rollback procedure before OTA/release.
- [ ] **L4:** strengthen the mock-heavy tests and the scaffold fetch-call test with real contract fixtures as screens land.
- [ ] **Release/OTA (Phase 8):** channels, version/build-number, rollout/rollback and store readiness.
- [ ] **Upstream U1–U11:** fix or record an approved, tested disposition (see the register below).

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

The initial V1 scope audit read code/configuration and existing coverage without running checks. A follow-up mobile-code audit then reproduced and recorded the B1–B9 defects with fresh mobile-only validation; that record is now closed (findings fixed with permanent regressions). Neither inspected provider accounts or established production/device acceptance. Record commands, results, build/update identifiers, devices, OS versions and dates for each acceptance; do not treat historical green claims as current proof.

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

**Fresh verification (2026-10-05): transport exists and passes its scoped checks.** Inspected `mobile-client.ts`, both auth controllers, and both auth route test files. `pnpm --filter @capella/api test tests/unit/mobile-client.test.ts tests/routes/auth.routes.test.ts tests/routes/admin-auth.routes.test.ts` completed with **27 passed, 0 failed/skipped** after disposable test-DB migrations. These tests run real Express HTTP endpoints and database sessions: mobile login returns JSON refresh tokens without cookies; header/body refresh rotates tokens and rejects replay; mobile logout revokes refresh; browser-origin spoofing never exposes refresh tokens; mixed web/mobile sessions remain isolated. Ordinary web login/refresh keeps cookie transport without JSON refresh-token disclosure. This provides the login HTTP-response evidence without printing live credentials or tokens. `pnpm --filter @capella/api typecheck`, `lint`, and `build` all exited **0**. No missing Phase 0 transport implementation was found. The full-repository `pnpm test` criterion was not run in this scoped pass; U1–U4 remain separate prerequisites and this is not a claim that all auth correctness work is complete.

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

**Fresh verification (2026-10-05): scaffold and Chrome preview code verified.** Existing scaffold is retained. Added Expo-selected `react-dom`, `react-native-web` and `@expo/metro-runtime`, direct Playwright test tooling, browser scripts and ignored output directories. Browser language changes set document language/direction without calling native layout/reload functions; native behavior retains its previous path. Two new language tests were observed failing before the browser handling was implemented, then passed.

| Command / observation | Evidence |
|---|---|
| `pnpm --filter @capella/mobile exec expo install --check` | Exit 0, **Dependencies are up to date**, after adding web dependencies |
| `pnpm --filter @capella/mobile add -D @playwright/test@1.60.0 --offline` | Exit 0; direct test dependency installed from cache; selected web dependencies are installed and exercised by exports/browser test |
| `pnpm --filter @capella/mobile lint` / `typecheck` | Both exit 0 |
| `pnpm --filter @capella/mobile test -- --runInBand` | **13 suites / 107 tests pass**, Phase 2 startup changes excluded |
| `pnpm --filter @capella/mobile test:e2e` | Exit 0, **1 passed** in installed Google Chrome at **390×844**, touch enabled; Arabic bootstrap, English switch/reload persistence, return to Arabic; no uncaught page errors |
| `pnpm --filter @capella/mobile build:web` | Exit 0; 880 modules; `dist-web/index.html`, metadata and web bundle `entry-08b15379ed3f97674dc9a9df42ff9850.js` |
| `pnpm --filter @capella/mobile build` after dependency changes | Exit 0; iOS `entry-46fd187357c0e331091918ad68e31f1d.hbc`, Android `entry-a2053b7efd12324931cae1104bff1c3b.hbc`, `dist/metadata.json` |
| Manual Chrome computer use | Chrome launched; control stopped because the tool could not identify the current browser URL confidently enough to enforce policy. No manual UI acceptance claimed; Playwright supplies automated browser evidence |

Inspected workspace/Turbo participation, optional shared DOM peers, Metro shim, Babel/TypeScript config, routing, generated Expo type references, and environment documentation. Playwright stubs only the products endpoint with `{ items: [] }` to isolate foundation checks; it does **not** prove real API/catalog or native behavior. Initial cold web bundling exceeded the original test startup limit; the test now permits 60 seconds while assertions retain their normal timeout. Exports/tests emit the Node `NO_COLOR`/`FORCE_COLOR` warning; dependency installation reported existing deprecated/peer warnings, without failing the Expo compatibility check. Installed native launch and real-device font/RTL behavior remain pending. Preview: `pnpm --filter @capella/mobile web`; repeat browser checks with `test:e2e`.

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

**Deferred acceptance decision (updated with user approval 2026-10-05):** continue code slices using TDD and Chrome at phone-sized viewports. Treat native launch and Arabic/English native RTL switching as explicitly pending; Chrome cannot close those checks. Arrange an installed Android/iOS development build for native integration checks and require both-platform release acceptance before launch. Do not label a browser preview or bundle export as native acceptance.

---

## Phase 2 — Core foundation: theme, language/RTL, storage

**Tracked slices:** 2A theme/language/startup recovery; 2B validated versioned storage/migrations/cache boundaries. Native direction, large-text, restart and upgrade evidence remain separate from browser checks.

- [x] **2A foundation code:** existing palette/font/radius/spacing primitives retained; recoverable font/language startup; bounded language switching after unmount; critical-operation holds with queued selection/resume.
- [x] **2B foundation primitives:** validated read/write and forward-copy migration; current-key precedence/recheck; canonicalized values before hydration/write; browsing-cache clear excludes credentials, identity, pending account writes and payment references. Language now consumes this boundary.
- [ ] **Consumer acceptance:** actual auth/guest/account-cart codecs and serialization in Phase 4, conversation codec/migration/cache-clear UI in Phases 6/7, and payment recovery codec/lifecycle in Phase 7. These are not implemented by a storage primitive test.
- [ ] **Native/release acceptance:** real Android/iOS font/RTL/reload, large text, lifecycle and upgrade/rollback tests.

**Fresh verification (2026-10-05):** restored the separately saved startup tests first; **5 of 10 failed** against Phase 1's root, then all passed after startup recovery was restored. New storage tests exercised actual boundary code against an in-memory backend: invalid writes, migration storage failure, rollback-source preservation, current-value precedence/recheck, validated recovery-field filtering and canonical migration hydration. Language tests first reproduced unwanted reload during a critical operation, work continuing after provider unmount, and a queued selection getting stuck when a hold ended during storage reconciliation. The fixes pass their regression tests. Native module adapters are mocked in Jest because the native bridge is unavailable there; this is not device evidence.

| Command | Final result |
|---|---|
| `pnpm --filter @capella/mobile lint` / `typecheck` | Both exit 0 |
| `pnpm --filter @capella/mobile test -- --runInBand` | **14 suites / 127 tests passed**, no failures/skips |
| `pnpm --filter @capella/mobile test:e2e` | **1 passed**, installed Chrome at 390×844; persisted language, Arabic/English document direction and actual language-control positions verified |
| `pnpm --filter @capella/mobile build:web` | Exit 0; `entry-ff79c557a8109fca538fa7d4de08c9f2.js` and `dist-web/index.html` |
| `pnpm --filter @capella/mobile build` | Exit 0; iOS `entry-08c5a25bb9ad98f9a969ffd90c26e16a.hbc`, Android `entry-3e5c0d53106ded5f64c12f5efc3de27c.hbc` and `dist/metadata.json` |

**Storage/consumer contract:** `src/lib/persistent-storage.ts` owns `PersistentValue<T>` codecs and forward-copy migrations. Key versions identify formats; a breaking format requires a new key, with an explicit validator/converter, while previous serialized values are retained for supported rollback clients. No historical language migration is enabled because no earlier language format is established; migration tests use controlled fixtures. Existing `capella.lang.v1` remains the raw `ar`/`en` format. Reads preserve malformed data instead of deleting it; actual storage failures propagate. Writes persist the current decoder's canonical value, allowing recovery codecs to strip form fields. Cache clearing removes only `capella.cart.v1`, `capella.ask.v1` and legacy `capella:ask:v1`. No expiry is introduced. Auth profile, SecureStore refresh tokens, `capella.cart.pending.v1` and `capella.checkout.recovery.v1` are preserved.

Consumers must validate their actual domain payloads and serialize competing domain writes; AsyncStorage is not a transactional/CAS store. Phase 4 must isolate pending cart data by account and persist SecureStore rotation before publishing access. Phases 4/7 must acquire `holdLanguageChanges()` before critical auth/storage/checkout/payment work, release it after reconciliation, and honor pending language changes when entering another critical task. The foundation tests prove the hold behavior, not a completed payment journey. Phase 7 must persist only minimal technical attempt/idempotency/reference state, never checkout name/address/form drafts; this is the D6 recovery exception. Phase 6 owns the conversation's real message/result validator; cache clearing UI follows in the customer slices. Native acceptance remains pending; exports do not prove installed startup, SDK 57 Expo Go cannot establish dynamic RTL acceptance, and manual Chrome control remains blocked by the tool's URL-policy check. Builds still emit the previously recorded Node color-environment warning.

No screens yet — the primitives everything else imports.

**Files**

| File | Purpose |
|---|---|
| `apps/mobile/src/theme.ts` | Convert the actual Parchment CSS OKLCH values to canonical sRGB/hex; the previous draft hex list is incorrect for nine tokens (the B8 closure lists the measured conversions). Preserve matching canvas `#f1f0ed`/white surface, radii {6,10,16,24}, spacing and language fonts (Roboto / Tajawal / Lobster); complete existing storefront tokens when components need them. |
| `apps/mobile/src/constants/storage.ts` | AsyncStorage/SecureStore keys — reuse web names: `capella.cart.v1`, `capella.auth.v1`, plus `capella.lang.v1`, secure keys for refresh tokens |
| `apps/mobile/src/lib/persistent-storage.ts` | validated codecs, canonical writes, forward-copy migration and selective browsing-cache clear; language integration implemented; domain consumer codecs in their owning phases |
| `apps/mobile/src/lib/lang.tsx` | `LangProvider` + `useLang()`: language (`ar` default) + `getDict`/`dir` from `@capella/shared/i18n`, persisted; switching updates `I18nManager.allowRTL/forceRTL` and reloads the installed app with the SDK-supported app reload API so layout flips natively. Dynamic RTL is verified in a development build, not Expo Go |
| `apps/mobile/app/_layout.tsx` (edit) | load fonts (expo-font + google-font packages), keep splash until ready, wrap in `LangProvider` + SafeArea |

**Additional foundation requirements**: validate persisted values before hydration; define versioned migrations and rollback-safe handling for approved caches, auth and payment recovery. Guest cart and Ask Capella conversation persist until explicitly cleared; signed-in cart reloads from the API/DB and retains safe pending-sync data. Search/filter choices and checkout form fields are RAM-only and reset on process restart/reload. Existing language preference and secure auth storage remain foundation state, not a browsing/form cache. Keep only the minimal technical checkout reference/idempotency state required to resolve an interrupted charge, not a persisted name/address/form draft; record this necessary recovery exception explicitly in D6. A cache-clear action must distinguish conversation/cart cache from credentials and unresolved payment recovery. Storage failure must not publish an unpersisted rotated token. Extend theme tokens as needed and validate conversions visually. Warn/defer a language-triggered reload during checkout/payment; do not silently interrupt a critical operation.

**Exit criteria**: build/lint/typecheck/tests green; a development build boots in Arabic with Tajawal, toggling to English reloads LTR with Roboto, and toggling back restores RTL. Verify first launch, persisted preference, failed storage/reload, larger text, and upgrade over existing saved data. Confirm the same language behavior in release builds before launch.

---

## Phase 3 — Data layer: API client

**Tracked slices / mandatory completion checks**
- [x] **3A implementation:** remaining catalog/cart/announcements/shipping/payment/cancellation transports and boundary fixtures; real database-backed catalog rendering in Chrome.
- [x] **3B implementation:** five native identity headers plus ordered capability revision; shared versioned config/update-error contracts; current/previous/review registry and promotion tests; public configuration and feature-only server enforcement. Shared/API changes explicitly approved.
- [x] **3C implementation:** validated native config fetch and feature-update errors; initial/retry/auth/idempotency/language headers preserved; stale-session successful responses rejected.
- [ ] **Native/distribution acceptance:** installed production metadata and actual supported store/OTA artifacts; first public bundle retention and device/provider acceptance remain required in Phase 8.

**Phase 3 implementation/evidence — 2026-10-05:** mobile/API/shared baselines passed before implementation (mobile 14 suites / 127 tests, shared 49 tests, API 27 real auth HTTP tests; applicable lint/typecheck/build). New tests first exposed missing transports, malformed required reads being accepted, missing native identity/error detail, stale-account successful reads, unavailable/disconnected update actions, an impossible advertised upgrade, case-sensitive feature matching against Express's case-insensitive routes, and U5's unhandled DB rejection. The implementations then passed targeted checks. Native modules are replaced only at the Jest native bridge boundary; these fixtures are not installed-binary evidence.

**Policy/bootstrap contract:** `GET /app-config` is public on the API origin; native identity supplies the platform, with `?platform=android|ios` available for development/bootstrap. Schema version is `1`, and `policyRevision` identifies policy/dismissal changes. The response carries `current` (public/latest), `previous`, per-platform release/build/runtime/API/update identity, recommended update and feature requirements. The candidate stays only in the private support registry. `Cache-Control: no-store` prevents an intermediary caching the response; `cache.maxAgeSeconds` is the explicit native cache freshness contract. Prelaunch defaults to **0** (refresh at startup/foreground, without a timer or invented reminder interval), empty release slots and no gates/recommendation. Configured policies specify their own freshness. Phase 4 will use last-known cache on failures and deduplicate lifecycle refreshes; recommended dismissal is keyed to policy revision/release, with no time-based expiry. Phase 5 supplies the prompt/store UI.

Set **`APP_RELEASE_POLICY_JSON`** in the API environment to a JSON value validated by `releaseRegistrySchema` in `packages/shared/src/schemas/app-policy.schema.ts`. It is policy configuration, never a credential or an `EXPO_PUBLIC_*` secret. Current and previous must be available in both stores; candidate may be staggered. `promoteReleaseCandidate(registry, newPolicyRevision)` refuses promotion until both stores are available, returns new current/previous slots and the retired release, and does not mutate the live registry. Publishing that returned configuration, changing feature minimums and recording real store availability is Phase 8 release work. A feature gate must point to an available public upgrade that can satisfy its version/build/runtime/capability requirement. Invalid configuration produces `APP_POLICY_UNAVAILABLE` for configuration/native gated operations while recovery and unrelated features stay reachable.

**Identity and enforcement:** production native requests use `expo-application`'s installed app version/build and `expo-updates`' executing runtime/update ID; `embedded` is used only for an embedded launch without an ID. Missing production identity fails before sending. Chrome sends no fabricated native metadata; Metro/Expo Go development calls deliberately do not claim a production runtime, while native auth still selects `x-client: mobile`. `X-Client-Revision: 1` adds an explicit ordered JavaScript capability revision to the five identity headers; increase it when required OTA capabilities change. Legacy metadata without that optional header starts at revision 1. Opaque OTA UUIDs are never ordered. Version/build comparisons are numeric per platform, including dotted iOS builds. Metadata is untrusted and cannot replace any auth, pricing, shipping or payment validation.

The API maps only cart replacement, checkout submission, shipping quotes, payment retry, cancellation, wishlist writes and review submission to their respective feature gates. `APP_UPDATE_REQUIRED` preserves the affected feature, localized explanation, policy/release and validated store URL. Browsing, authentication, support/deletion routes and payment-status recovery have no whole-app wall. Existing web requests retain their behavior. The native client preserves the validated error on `ApiError.updateRequired`/`feature`; an invalid error cannot supply a store action. Network failures never automatically repeat a mutation, and an authenticated retry preserves its body, language and idempotency key.

**Real Chrome evidence:** `pnpm --filter @capella/mobile test:e2e` passed **2 tests** in installed Chrome at **390×844**, including a final run after U5's API fixes. The foundation test still isolates its products request. The new integration test launches the actual Express app on a random local port, resets/seeds only the guarded disposable test database, forwards the preview's fixed API URL to that server without replacing response bodies, and renders **منتج تجريبي 1 / Baseline Product 1** through the real mobile normalizer. The harness supplies localhost:8081 CORS explicitly and shuts down its own server/pool. Arabic/English screenshots were captured under the ignored `apps/mobile/test-results/api.integration-Chrome-ren-3441e-a-through-the-mobile-client/phase3-catalog-{ar,en}.png` and visually inspected. This is API/browser integration evidence, not native or payment-provider acceptance. Computer-use inventory was checked again: only the in-app browser/MCP Apps connector surfaces were available, with no Chrome connector; the previous native control URL-policy block remains unresolved. No manual Chrome input/acceptance is claimed for this phase.

**Final validation:** `pnpm exec turbo run lint typecheck build --concurrency=1` passed **17 tasks** (7 cached), including both web builds and native exports. `pnpm exec turbo run test --concurrency=1 --force` passed **7 tasks, 0 cached**, across all six workspaces: API **1083**, mobile **171 / 17 suites**, shared **53**, database **63**, storefront **576 / 86 files**, ERP **273 / 49 files** — **2219 tests total**. No API/database runners competed for the same disposable schema. `pnpm exec turbo run lint typecheck --concurrency=1 --force` then passed **12 tasks, 0 cached**. Final `pnpm --filter @capella/api build`, mobile `expo install --check` and `build:web` exited **0**. Final native export identities: Android `entry-3a3775b2ca3687f03c6a608a69b22d73.hbc`, iOS `entry-f23ad9c5d754968a981ce8b8989480fe.hbc`; web `entry-0b0cb380a6751905ce32d79a41472560.js`. Builds/tests still emit the recorded Node color-environment warning; passing ERP negative-case tests print their expected API-409 diagnostics. Native builds must be regenerated to include the added `expo-application` module before installed-device metadata acceptance. Actual store IDs/builds, current/previous/candidate binaries and OTA artifacts remain Phase 8 evidence, not synthetic test fixtures.

Pure TS, no UI. Ported from the storefront (`apps/storefront/src/lib/api/`) minus Next-isms (`next: { revalidate }`, `NEXT_PUBLIC_API_URL`).

**Files**

| File | Purpose |
|---|---|
| `apps/mobile/src/lib/api/base.ts` | `API_BASE` = `EXPO_PUBLIC_API_URL`, falling back to the emulator/simulator URL by `Platform.OS` **only when `__DEV__`**; in a production build a missing variable is a startup error, never a dev-URL fallback |
| `apps/mobile/src/lib/api/http.ts` | 15-second request/body timeout and 401 → refresh → retry-once adapter already exist. Complete structured errors preserving HTTP status, API code and safe message, including upstream `error`/`message` formats and feature-specific `APP_UPDATE_REQUIRED`; attach the identity headers specified below to all native API calls/retries. Preserve language/auth/idempotency headers. Add authenticated PUT for server cart sync; never retry a non-idempotent mutation merely because the connection failed. |
| `apps/mobile/src/lib/api/types.ts`, `normalizers.ts`, `selectors.ts` | adapt boundary types/normalizers; media URLs resolved against `API_BASE`; category IDs disambiguate repeated slugs; do not assume TS casts validate network data |
| `apps/mobile/src/lib/api/client.ts` | `GET /app-config` plus catalog, advice, shop-media, announcements, orders/detail/cancel, reviews/prompt, wishlist, GET/PUT cart, checkout union, Paymob methods/status/retry, shipping availability/quote. Some exist already; config/announcements/cart/shipping/payment recovery/cancellation remain missing in the audited native client. |

**Exit criteria**: build/lint/typecheck/tests green; a temporary debug call lists real products from a running local API. Boundary tests cover all client operations, both checkout response kinds, structured shipping/payment errors, missing/malformed payloads, timeout during body reading, unauthorized/session-changed responses, and idempotency preservation. Screens must distinguish failed required reads from a successful empty result; optional decoration may fail without blocking the main task. Existing `getJSON` defaults can turn connection failure into null/empty arrays, so callers must deliberately choose the required-read behavior.

---

## Phase 4 — State providers: customer auth & cart

**Tracked slices / mandatory completion checks**
- [ ] **4A:** secure token/auth state and safe revocation/rotation/recovery; prerequisite U1–U4 disposition backed by real API tests.
- [ ] **4B:** durable guest and account-isolated synchronized carts, serialized pending writes and purchased-cart reconciliation integration.
- [ ] **4C:** policy provider at cold startup/foreground: validated cache, freshness/deduplication, reminder dismissal, offline/no-cache/invalid response behavior. Refresh never reloads the app or interrupts payment; startup settles even without config.

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

**Tracked slices / mandatory completion checks**
- [ ] **5A:** bilingual accessible components, loading/error/retry, gallery/in-app playback and lifecycle behavior.
- [ ] **5B:** dismissible recommended-update prompt and feature-specific blocked state with safe store action; compatible features remain available. Both-language, accessibility and dismissal evidence required.

Native equivalents of the web look, all styled from `theme.ts`. Icons via `@expo/vector-icons` (lucide is DOM-only).

**Files** — `apps/mobile/src/components/`: `screen.tsx` (safe-area + canvas bg), `button.tsx` (primary/outline/ghost, pressed = accent-deep), `input.tsx`, `price-text.tsx` (EGP + strikethrough original), `rating-stars.tsx`, `badge.tsx` (new/bestseller/offer from `dict.badges`), `qty-stepper.tsx`, `media-image.tsx` (bilingual `EntityMedia` → url by lang, expo-image), `product-card.tsx`, `section-header.tsx` (eyebrow style), `empty-state.tsx`.

Also provide reusable loading/error/retry states, accessible modal/confirmation behavior, filter/sort/column controls, native sharing, and an entity gallery supporting images, uploaded video, linked video and full-screen viewing. Videos play inside the app (D4); select/test native playback for uploaded files and the appropriate embedded provider presentation. `expo-image` alone does not implement video playback. Failed playback shows a useful in-app error/retry; external playback is not the normal path.

**Exit criteria**: build/lint/typecheck/tests green; gallery renders components in ar/en. Verify VoiceOver/TalkBack labels, roles, selected/disabled states and focus; large system text, contrast, practical touch targets, keyboard-safe forms, safe areas/system bars, reduced motion and native Back/close behavior. Hover-only behavior is adapted to touch. Pause media/timers when hidden/backgrounded.

---

## Phase 6 — Customer slice A: browse & catalog (first real screens)

**Tracked slices:** 6A home/catalog/detail/cart controls; 6B global search/Ask and approved conversation cache; 6C banners/media/static links/support and complete navigation reachability. Acceptance uses the existing parity matrix, not only the named routes.

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

**Tracked slices / mandatory completion checks**
- [ ] **7A:** cart/shipping/checkout/payment recovery and durable attempt/reference; purchased-cart reconciliation and transient form state.
- [ ] **7B:** login/signup/intended return, account, orders/cancellation, wishlist and purchase-eligible reviews.
- [ ] **7C:** account deletion and minimum review safety with approved upstream API/web work and retention policy.
- [ ] **7D:** wire feature-specific update errors/recovery into every affected journey; preserve other tasks and unresolved payment state.

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

**Tracked slices / mandatory completion checks**
- [ ] **8A:** native identity/build/runtime and preview/production environments/channels; supported-release promotion, safe OTA timing and tested rollout/rollback. Never advertise a store candidate unavailable to the user.
- [ ] **8B:** real assets, signing/store/privacy/reviewer readiness and D12 redacted failure notifications with the user's actual destination/service access.
- [ ] **8C:** close every remaining Android/iOS device/lifecycle/upgrade/provider acceptance item with dated build/device/OS/revision evidence.

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

### Approved version/update scope — five items

The user selected only **client identity, `GET /app-config`, update enforcement, the three-state support policy, and OTA delivery** for this layer. General app crash/failure notifications already approved in D12 remain a separate operational requirement. Dedicated version analytics, unique-user/device tracking, revenue attribution, analytics dashboards, general feature rollout flags and emergency kill-switch systems are not additional V1 requirements. Basic release identity in diagnostic records supports these five items without becoming an analytics project.

| Item | V1 implementation contract |
|---|---|
| Client identity | Central request-header construction for every native API call, including auth, `/app-config`, original requests and retries; fields below. Metadata never replaces authentication or server input validation. |
| Remote config | Public `GET /app-config` on the configured API origin, usable before login. Stable response schema/version and per-platform release/store destinations plus feature-specific compatibility requirements. |
| Update enforcement | Dismissible recommended-update prompt; incompatible feature shows its update requirement/store action. Server backstop and shared client error handling identify the affected feature; compatible app functionality continues. |
| Support policy | Current deployed release, immediate previous release and one review candidate; promotion/retirement follows the existing both-store availability rules below. |
| OTA | EAS Update through preview/production channels, native runtime compatibility, safe apply timing and tested rollback. Native-incompatible changes still require a new store binary. |

### Client identity — exact initial headers

| Header | Value / purpose |
|---|---|
| `X-App-Version` | Native app/store version, e.g. the configured appVersion; not `package.json`'s workspace version |
| `X-App-Build` | Android versionCode or iOS buildNumber, serialized as a string; compare only within the relevant platform/contract |
| `X-Platform` | `android` or `ios` |
| `X-Runtime-Version` | Actual Expo runtime identifier for the installed binary |
| `X-Update-Id` | Actual executing Expo update ID when available; use the documented `embedded` marker only when the executing embedded bundle has no update ID |

Keep existing `x-lang`, auth Bearer, auth-transport `x-client: mobile` / refresh-token and checkout idempotency headers intact. Diagnostic identity contains no hardware device identifier or additional stable user/device tracking ID. If a compatibility requirement is introduced by OTA within one native appVersion, define an explicit ordered client revision/capability in the shared contract; opaque update UUIDs are not sortable version numbers. First-release identity/config/enforcement integration is mandatory. Validate missing/malformed metadata safely and preserve existing web clients, which do not send native app headers.

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

**Implemented in Phase 3:** `GET /app-config`, a public policy/bootstrap endpoint available before login on the API origin, and version-policy handling at the API boundary for affected operations. Keep the route stable; its response schema is versioned so future clients can evolve safely. Initial identity header names are fixed above. Shared response/error schemas now live in `packages/shared/src/schemas/app-policy.schema.ts`, including the stable machine code `APP_UPDATE_REQUIRED` and affected feature; retain their first-release contract across future updates.

The configuration contract includes response schema/policy revision, platform, current/latest and previous supported release identifiers, store URL, recommended-update information, and minimum supported release/capability for each feature requiring a gate. Keep the under-review candidate in the support registry without advertising an unavailable store upgrade to ordinary users. This endpoint is for version compatibility and delivery policy, not a general business-feature/analytics configuration engine.

Check on cold launch and on foreground using a defined freshness interval and request deduplication. Use cached configuration immediately while refreshing; a fetch failure keeps last-known policy and compatible functionality available. With no cache, initialization must still settle and the API remains the authority for protected operations. Specify/test cache freshness, invalid responses and reminder-dismissal behavior in the shared/native policy implementation; no arbitrary reminder or polling interval is approved by this scope selection. Do not reload the app or interrupt payment merely because configuration was refreshed.

Implement shared policy/error contracts and API enforcement with Phase 3, native startup/session integration with Phase 4, accessible update prompts/blocked-feature states with Phase 5, and per-feature recovery integration with Phase 7. Phase 8 verifies distribution/rollout rather than being the first place compatibility is implemented. An update-policy response must use a stable cache/freshness contract that can itself evolve without breaking the first released client.

The policy must represent platform store destinations, recommended update, minimum supported client/capability where needed, affected feature and a localized explanation. **The approved scope is feature-only blocking: keep the rest of the app running.** Record app version, native build, platform, runtime and actual OTA revision with requests/diagnostics. Distinguish installations with the same appVersion but different OTA updates; do not sort opaque OTA IDs. Define an ordered client revision/capability if an OTA change must be required. Evaluate API-contract support too; do not introduce a whole-app version wall as a default or fallback.

The first public binary must understand policy responses and a stable structured `update required` error, offer a working store link, and preserve cart/payment recovery. Optional prompts remain dismissible; required prompts attach to the incompatible feature. Do not disable compatible browsing, support, deletion or payment-status recovery. Unknown/unreachable policy cannot produce a permanent startup spinner or whole-app block: keep compatible features usable and use last-known policy when available. Enforce indispensable feature rules server-side regardless of cached policy/spoofed metadata; an operation needing a live API still cannot claim success while offline.

### Support, rollout, retirement and rollback

1. Maintain **three release states only**: the current deployed/working release, its immediate previous release, and one candidate under Google Play/App Store review. Under review is a candidate, not a third public release. Test backend compatibility for all occupied states, including their actual runtime/OTA revisions. At first launch the previous slot can be empty. Track store availability on both platforms; while a candidate is available on only one, retain the existing current/previous support and do not start another promotion that requires a fourth promised release. Once the candidate is available on both platforms, promote it to current, move old current to previous, and retire the former previous through feature-specific update prompts. Rejected candidates do not change public support. Record promotion/retirement and store links; no extra time-based support window is added.
2. Deploy backend support before mobile uses it. Preserve old inputs/outputs and existing web flows; add adapters/defaults as necessary.
3. Test current web/mobile and retained supported client artifacts against that backend. Ship to preview, then staged production rollout with diagnostic evidence and rollback criteria.
4. Record app/build/runtime/OTA/contract identity with relevant failures for diagnosis, without logging credentials/customer/payment payloads or introducing a dedicated analytics dashboard. A source-code test suite alone does not establish old-binary compatibility.
5. Before enforcement/retirement, verify the update is available in each affected store/platform, users have a supported upgrade path, and update prompts/recovery work. Store review delays must not cause premature backend breakage. Record the approved notice/enforcement dates and exceptions.
6. Remove old adapters only after approved retirement and verification. Mobile and backend rollbacks must preserve supported contracts and data. Use expand/backfill/contract database migrations where required; do not remove fields/data still read by either production slot or a supported rollback build. If blue-green is used, both slots and their schema dependencies must satisfy these rules; blue-green is not established by current Compose configuration.

**Acceptance**: retain the first public embedded bundle as a regression fixture and test each currently promised current/previous/candidate binary/OTA/contract combination after backend changes. Older retired fixtures test graceful feature rejection, not indefinite supported behavior. Cover missing/invalid metadata, supported/retired clients, newer candidates, staggered platform availability, optional/required feature prompts, continued compatible operation, policy offline/cached failures, stale OTA, successful OTA/rollback, and backend rollback with the deployed schema. Include auth, cart, checkout, shipping, orders/cancellation, wishlist and reviews. Passing current shared types is insufficient evidence.

## Upstream and current-client issue register

This register records audit findings and dated implementation evidence. Assign resolution/evidence before accepting the relevant phase; a documentation checkbox alone never establishes a fix.

| ID | Verified finding / source | Required disposition |
|---|---|---|
| U1 | `auth.routes.ts` passes raw signup/login bodies; shared `signupSchema`/`loginSchema` exist but are unused. Signup has no route rate limiter. | Apply consistent boundary validation and define/test signup abuse protection; keep web/mobile errors usable. |
| U2 | `auth.controller.ts` refresh catch maps every failure to 401, including operational failures. | Distinguish true rejection from transient/server failure so the mobile provider does not erase a valid session on outage. |
| U3 | `auth-session.service.ts` revokes the old refresh token before replacement delivery; the native app may never receive/persist the new token. Separate DB revoke/create operations also leave a failure window. | Make rotation atomic where needed and test interruption. The approved safe fallback is re-login; do not weaken replay protection to avoid it. |
| U4 | Customer middleware verifies JWT signature/expiry/role but does not consult its `sid` or revoked session. Logout revokes refresh, not already-issued access JWTs. | Implement immediate access/refresh invalidation for the logged-out session when the API receives logout; deletion must invalidate the affected account sessions. Test both, and expose offline limitations honestly. |
| U5 | **Resolved in Phase 3:** cart, wishlist, storefront advice and shop-media handlers now use `wrapAsync`. | A real HTTP regression injects DB driver failure across all seven affected GET/PUT/POST/DELETE paths and verifies safe 500 responses; full-suite evidence is recorded with Phase 3. |
| U6 | Web wishlist provider can apply an old-account response after logout/account switch and turns failed reads into empty state. | Guard sessions/requests and distinguish failures; native behavior must not reproduce the race/false empty presentation. |
| U7 | No account-deletion API/web entry point exists. | Implement the approved deletion/retention/verification contract upstream and native UI before store submission. |
| U8 | Reviews are published active after purchase/schema validation; staff can hide/delete them, but no customer report/block flow exists in the reviewed storefront routes. | Resolve public-content filtering/reporting/abuse-handling requirements, support process and matching web/mobile/API integration (D11). |
| U9 | **Resolved in Phase 3:** the shared COD/Paymob union, structured errors, cart GET/PUT, announcements/shipping/payment recovery/cancellation operations and validated required reads are implemented. | Boundary/Chrome/API evidence accompanies Phase 3; UI/provider/payment-device acceptance remains in Phases 4–8. |
| U10 | Web contact form waits then shows successful delivery without sending a request. | Keep deferred mobile presentation truthful (D10); track upstream fix if contact is included. |
| U11 | Mobile plan status/context and upstream storefront specification contradict current auth/cart/shipping/orders code. | This update corrects mobile scope; reconcile upstream docs separately. Historical device/build/testing claims require fresh evidence. |

## User decisions and remaining implementation details

The answers below supersede the earlier open questions. Do not reopen settled product choices merely to choose libraries, routes or schema names. Remaining technical details use engineering judgment and validation; external account access, notification destination and actual data-retention policy still require concrete information before their dependent acceptance gates can pass.

| ID | Confirmed choice / recommendation | Remaining detail / acceptance |
|---|---|---|
| D1 | **Confirmed:** current deployed, immediate previous, and one under-review candidate; keep it simple, no additional support window. | Apply the promotion/staggered-store rules above; map runtime/OTA/API fixtures to each release state. |
| D2 | **Confirmed:** version/update layer is identity headers, `GET /app-config`, feature-only enforcement, current/previous/review support and OTA. Keep compatible features running. | Implement the specified headers/route and shared policy/error contracts; cached/offline handling, freshness and prompt behavior follow this section. Thresholds derive from supported release/capability policy. No additional analytics/kill-switch/feature-experiment system is required. |
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
