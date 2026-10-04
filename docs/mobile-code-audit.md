# Mobile code audit — correction checkpoint before further implementation

Date: 2026-10-04. Baseline revision: `7eb14a2`, plus the working-tree/staged changes present during the audit. Scope: **all 39 tracked files in `apps/mobile`** (36 text files read in full and 3 PNG assets inspected), with relevant shared contracts, storefront source tokens and API boundary behavior checked for integration. Generated `.expo`, exports, installed dependencies and private environment files are not application source; installed Expo/plugin code was consulted where needed. No private environment contents were read.

This records existing-code deviations from [the V1 contract](mobile-app-plan.md), not permission to implement all later phases at once. No production code was corrected in this audit. Temporary diagnostic tests were run and removed; future fixes need permanent regression tests. Findings remain open until the closure criteria below pass.

## Result and continuation rule

**The current code builds and its existing tests pass, but the foundation is not ready to be treated as accepted.** Correct B1–B9 before building more production behavior on these abstractions. Device acceptance and Phase 3 integration work remain separate gates; their absence is not proof of an implementation defect.

| Check run sequentially | Result |
|---|---|
| `pnpm --filter @capella/mobile typecheck` | PASS |
| `pnpm --filter @capella/mobile lint` | PASS |
| `pnpm --filter @capella/mobile test --runInBand` | PASS: 13 suites, 78 tests |
| `pnpm --filter @capella/mobile build`, with process-local `EXPO_PUBLIC_API_URL=https://api.capellacares.com` | PASS: Android and iOS exports |
| `pnpm --filter @capella/mobile exec expo install --check` | FAIL: 11 installed Expo packages behind the check's expected patch versions |
| Focused diagnostic tests against desired behavior | 11 assertions failed as expected, reproducing current deviations; details below |

An export is not an installed native build or a live API/payment test. The 78 passing tests do not cover the reproduced cases. No Android/iOS device acceptance, EAS cloud build, store submission, live provider test or production rollout was performed. Only the mobile workspace checks were run; this is not a full-repository green claim.

## Existing-code corrections — complete before expanding the foundation

### B1 — Expo dependency compatibility gate fails

**Source:** `apps/mobile/package.json`, lockfile and the Expo check above. **Impact:** the previously recorded compatibility-green state is stale. A successful export does not replace this required SDK compatibility check, and native-device validation should use the corrected dependency set.

| Package | Installed during audit | Expected by check during audit |
|---|---|---|
| expo | 57.0.18 | ~57.0.26 |
| expo-constants | 57.0.16 | ~57.0.20 |
| expo-dev-client | 57.0.16 | ~57.0.19 |
| expo-font | 57.0.2 | ~57.0.4 |
| expo-image | 57.0.3 | ~57.0.5 |
| expo-linking | 57.0.8 | ~57.0.11 |
| expo-localization | 57.0.1 | ~57.0.2 |
| expo-router | 57.0.17 | ~57.0.24 |
| expo-secure-store | 57.0.2 | ~57.0.4 |
| expo-splash-screen | 57.0.8 | ~57.0.9 |
| expo-updates | 57.0.19 | ~57.0.24 |

**Closure:** align dependencies using Expo's compatible selection, preserve unrelated user manifest/lock changes, rerun compatibility and mobile lint/typecheck/test/both exports, then rebuild the development client as needed for native changes. Re-check expected versions at fix time; this table is a dated observation, not a permanent version pin or a recommendation to change SDK major versions.

### B2 — HTTP errors discard the information screens need

**Source:** [http.ts](../apps/mobile/src/lib/api/http.ts), `errorMessage` and all three request paths. The client keeps only `message`, constructs a plain `Error`, drops HTTP status/API `code`, and ignores the API's existing `{ error: ... }` validation/500 format.

**Reproduced:** a 409 `{ code: "SHIPPING_QUOTE_CHANGED", message: "Review total" }` becomes `Error("Review total")` with no status/code. A 400 `{ error: "Invalid request payload" }` becomes `Error("API 400 /checkout")`.

**Impact:** consumers cannot reliably distinguish re-login, quote/amount changes, unavailable payment, forbidden operations or feature-update requirements; server validation detail is lost and user-facing localization is difficult.

**Closure:** introduce a consistent typed error with safe status/code/message, parse both current envelopes, validate message types, and use localized safe fallback copy at the UI boundary. Add permanent tests for both envelopes, non-JSON failure bodies, stalled bodies and the feature-policy error contract. Preserve timeout cleanup and retry/idempotency behavior.

### B3 — Checkout declares the wrong response contract

**Source:** [client.ts](../apps/mobile/src/lib/api/client.ts), `submitCheckout`; shared `CheckoutResponseDto` / `checkoutResponseSchema`; API checkout controller. Mobile declares `Pick<Order, "id" | "orderCode" | "paymentStatus">`, but the API returns a discriminated `cod_order` / `paymob_redirect` union.

**Impact:** mobile callers are told every successful result is an order although online payment returns a checkout ID/URL/expiry instead. The function currently passes JSON through; this is a false type contract, not evidence that redirects are stripped at runtime. Existing checkout tests mock an order with no `kind` and therefore do not catch it.

**Closure:** use/validate the actual union, cover both response kinds and malformed/empty checkout success, and replace impossible fixtures. Audit the other API boundary types too: `ProductApiShape` inherits shared `Product` fields such as `buyingPrice`/timestamps that the storefront product mapper deliberately omits. Represent actual storefront payloads; do not make the API expose ERP-only data to satisfy mobile types.

### B4 — Malformed data can look like a successful empty shop or reach rendering

**Source:** [client.ts](../apps/mobile/src/lib/api/client.ts), `normalizeRows` / list getters; [normalizers.ts](../apps/mobile/src/lib/api/normalizers.ts), `requiredPositiveId` / `normalizeProduct`; shared `pickLang` directly reads its bilingual argument.

**Reproduced:**

- A 200 `{}` from products returns `[]`, even with `throwOnError: true`.
- A non-empty products list in which every row fails normalization also returns `[]`, even with `throwOnError: true`.
- Category ID `1.5` is accepted; `Number(...)` plus finite/positive checks are not integer validation.
- A product with valid IDs/arrays but no `name` is accepted. The current placeholder later passes that missing name to `pickLang`, which cannot render it safely.

**Impact:** contract failures appear as "nothing available", while partially validated objects still claim complete types. Existing fixtures omit many real required fields, so current tests overstate contract coverage.

**Closure:** validate actual list envelopes and the fields consumed by mobile (including positive safe integer IDs and renderable bilingual names). Required operations must distinguish success-empty from invalid/missing/fully rejected data; treat required-list 404/empty bodies deliberately rather than inheriting detail-not-found semantics. Preserve optional-read fallback and valid siblings where appropriate, but surface partial/total invalid-data outcomes meaningfully. Validate actual storefront DTO shapes, not the ERP `productSchema` that expects different field names/private data. Keep compatible optional/unknown fields and test realistic API fixtures.

### B5 — A stale account token can replay a mutation under the current account

**Source:** [http.ts](../apps/mobile/src/lib/api/http.ts), `captureRequestSession` / `retryToken`. The request accepts a caller-supplied token but captures the adapter's *current* revision separately. The guard covers an account change after dispatch, not stale caller state from before dispatch.

**Reproduced:** install an adapter for account B/revision 2, then call a wishlist mutation with account A's old token. If A receives 401, the helper sees B's token as an already-rotated replacement and sends the mutation again as B (two fetches).

**Impact:** a stale callback can change the wrong customer's state. The native auth provider is not connected yet, so this is an existing-library hazard to fix before Phase 4, not a claim that current customers experienced it.

**Closure:** bind dispatch/retry to the originating session/token ownership atomically; reject stale-account operations. Preserve legitimate token rotation within the same session. Add tests for stale ownership before dispatch, account switch during refresh, logout, adapter replacement, and same-account rotation. Future providers/screens must also discard stale successful responses; HTTP retry guards alone are not UI isolation.

### B6 — Failed startup RTL reload is reported as ready

**Source:** [lang.tsx](../apps/mobile/src/lib/lang.tsx), hydration / `applyNativeDirection`. Hydration selects the stored language, catches native reload failure and unconditionally sets `ready=true`.

**Reproduced:** stored Arabic, native `I18nManager.isRTL=false`, rejected reload. Provider publishes `ready=true`, Arabic/RTL context, while the native layout is still LTR.

**Impact:** every future screen can start with language/direction disagreeing with the actual native layout. The existing startup tests mock successful reload and check requested direction; they do not prove the layout changed.

**Closure:** expose a recoverable startup error/retry or maintain a consistent native-language state until reload succeeds. Never publish ready with an unhandled direction mismatch. Test failed reload/storage, cold start and recovery, then verify on both native platforms. Retain the correct Expo core reload API and persisted language preference.

### B7 — Overlapping language selections lose the user's latest choice

**Source:** [lang.tsx](../apps/mobile/src/lib/lang.tsx), `setLang`; the placeholder permits further presses while asynchronous persistence/reload is pending. `language === lang` compares to the previous committed render state.

**Reproduced:** start in English, begin Arabic switch with delayed storage, select English before it completes. The second request returns early as "already English"; the first finishes and leaves Arabic active.

**Impact:** selected language, persisted state and reload intent can diverge under quick taps. Storage/reload errors also disappear silently rather than giving callers a failure state.

**Closure:** serialize/coalesce language intent or disable controls while switching with a clear pending state; make failure/retry observable. Test the chosen interaction policy, overlap/rollback and unmount behavior. Guard native direction/reload side effects after unmount. Before checkout exists, define how critical-operation guards prevent a language reload from interrupting it.

### B8 — Theme values are not the storefront color conversion

**Source:** [theme.ts](../apps/mobile/src/theme.ts), storefront `globals.css`, and `tests/theme.test.ts`. Nine current hex values differ from the CSS OKLCH source. The test copies the mobile object and therefore cannot detect drift.

Computed with installed `@csstools/color-helpers@6.0.2`: `OKLCH_to_XYZ_D50` → `XYZ_D50_to_sRGB`, rounded to 8-bit hex. Its conversions derive from the [W3C CSS Color conversion reference](https://www.w3.org/TR/css-color-4/#color-conversion-code). These in-gamut values need no special gamut policy.

| Token | Current mobile | Rounded CSS sRGB |
|---|---|---|
| canvas | #f1f0ed | #f1f0ed |
| ink | #0e0d0b | #070603 |
| ink2 | #3a3833 | #2c2922 |
| ink3 | #6d6a62 | #605d57 |
| accent | #46433c | #373228 |
| accentDeep | #201e1a | #14110c |
| warmSoft | #eae5d4 | #eae4d4 |
| hairline | #c5bda6 | #beb7a4 |
| error | #b13f2c | #ad301b |
| success | #2e7d4f | #417843 |
| surface | #ffffff | #ffffff |

**Closure:** correct the conversion/source-of-truth mismatch before styling more screens; test against canonical token values rather than merely repeating the draft. Add existing storefront tokens when needed (`accent-soft`, `warm`, `surface-2`, stronger border, pill radius and shadows), and visually accept both languages. Do not invent a new palette. The plan's earlier hard-coded draft list is corrected to reference this finding; production theme code remains unchanged by this audit.

### B9 — Production API URL validation accepts unsafe or unusable values

**Source:** [base.ts](../apps/mobile/src/lib/api/base.ts), `resolveMobileApiBase`. A non-empty configured string is returned before checking production rules.

**Reproduced:** both `http://api.example.com` and `not-a-url` are accepted with development=false. Missing production configuration is correctly rejected and should remain so.

**Impact:** a misconfigured release can use cleartext traffic or fail later during fetch. The current EAS production profile contains a correct HTTPS URL; this is a missing guard, not evidence that the current export uses HTTP.

**Closure:** validate an absolute HTTP(S) base, require HTTPS outside development, reject unusable origins/credentials/query/hash forms as appropriate to the base contract, retain trimming/trailing-slash normalization and Expo's statically inlinable environment expression. Test valid production, malformed/HTTP production, dev URLs and missing config. Development fallback is OS-based, not physical-device detection: a phone must still receive an explicit LAN URL. `.env.example` contains the Android emulator URL, so copying it on iOS/physical devices requires editing it; document/test target-specific setup.

## Current polish and release configuration — fix at the named gate

These are real limitations of existing files, but do not require completing the entire app before correcting B1–B9.

| ID | Current evidence | Disposition |
|---|---|---|
| L1 | Root font-failure screen is English-only with no recovery action; splash promise rejections have no handlers. Placeholder exposes raw error text and has no retry/empty presentation. | Localize/recover the persistent root error state and test splash failure before production UI acceptance. Replace the diagnostic placeholder in Phase 6; do not overbuild a disposable screen. |
| L2 | All three configured icon/splash PNGs are 1×1 RGBA, 70-byte placeholders. | Retain placeholders during development only; replace and verify real platform assets in Phase 8. Export success does not prove store-ready assets. |
| L3 | `eas.json` has dev/preview/production profiles but no update channels or explicit preview API environment; appVersion runtime/updates URL are present. No defined build-number/publish/rollback procedure. | Finish and verify environment/channel/version delivery before OTA/release use. This is planned Phase 8 work, not justification to publish the current scaffold. |
| L4 | Most regression tests mock HTTP, storage, reload and navigation; a "lists products" scaffold test checks a fetch call rather than visible returned rows. Theme test repeats implementation; checkout fixture omits actual response `kind`. | Strengthen affected tests with B fixes and real contract fixtures. Retain meaningful existing tests; unit tests remain complementary to device/API checks. |

## Incomplete integrations and later phases — not mislabeled as bad code

| Area absent from current mobile source | Required gate |
|---|---|
| Native auth provider/token store and SecureStore rotation; cart provider/sync and last-synced snapshot | Phase 4; first complete auth ownership/error corrections and GET/PUT cart transport integration. Existing `MutationInit` only supports POST/DELETE, so PUT must be added before cart sync consumes it. |
| Announcements client, global search/Ask cache, production components/catalog screens, banner/legal navigation | Phase 3/5/6 as specified by V1 contract; the current product list is an intentional placeholder. |
| Shipping availability/quote, payment methods/status/retry, native browser dependency/return handling and durable recovery | Phase 3/7; fix checkout/error contracts before consumers. Platform-browser recommendation does not mean `expo-web-browser` is installed today. |
| Order cancellation, fulfillment UI, reviews/report/block controls, deletion, shared wishlist state | Phase 7 and upstream register; current basic fetchers do not implement those surfaces. |
| Client-policy/bootstrap, release/OTA diagnostics, feature update gates, failure notification service | Phase 3/4/5/7/8 as contract specifies. No current app/build header exists; `x-client: mobile` belongs to future auth calls, not every anonymous catalog request by necessity. |
| Video playback, accessibility beyond temporary controls, app lifecycle guards, cache migration/clear controls | Foundation/component/screen acceptance; preserve approved cached guest cart/Ask behavior and RAM-only form/filter state. |

Upstream U1–U8 remain external dependencies in the mobile plan. This audit did not fix or re-run their API tests. In particular, genuine immediate server logout still needs upstream access-session revocation, and accurate transient refresh errors still need API correction. Do not mark native session acceptance green while those contracts disagree.

## Behaviors to retain while fixing deviations

- SDK-compatible Expo/React Native workspace and Router entry, strict TS, mobile validation scripts, raw-shared-package isolation from DOM UI.
- Scoped Metro `.js` rewrite only for relative shared imports, fallback to original real `.js`, and automatic monorepo resolution. Both native exports succeeded.
- Explicit environment expression, trimmed API base, missing-production-config failure, and documented simulator/emulator development fallbacks.
- Memory access-token adapter design, one 401 retry maximum, retry opt-out, same-session already-rotated-token reuse, request/body timeout and timer cleanup. Strengthen ownership instead of removing all retry behavior.
- Original checkout idempotency key/body on authentication retry; never introduce automatic network retries that create duplicate orders.
- 204/empty-success handling where the endpoint contract permits it (e.g. prompt claim). Do not globally forbid empty HTTP bodies merely to fix checkout/list validation.
- Explicit language headers, Arabic default, persisted preference, core reload API, successful rollback path, shared dictionaries/fonts and startup font/language gate; correct failed readiness and concurrency rather than removing RTL reload.
- Relative/loopback-upload media correction, absolute CDN preservation, bilingual media and wishlist/review href mapping. Do not mistake asset identifiers or every external URL for a native route.
- Category ID lookup, refusal to guess ambiguous slugs, and cycle guard in ancestor paths.
- Row-level isolation preserving valid siblings, alongside explicit required-read validation and meaningful failure outcomes.
- Safe-area provider, accessible temporary language controls with selected state/48px target, and placeholder's stale-request suppression on language change/unmount.
- Stable approved storage keys and user choices: guest cart/Ask cache until clear, account cart in DB, transient form/filter state, secure credentials and minimal payment recovery kept separate from browsing cache.

## Diagnostic reproduction record

All probes called the actual application helpers/provider, mocking only network/native/storage boundaries. They asserted the desired contract and failed for the observed behavior, not compilation/test-harness errors. Files named `__tests__/mobile-audit-probes.tmp.test.js` were temporary and removed in `finally` after each sequential run. Baseline permanent tests were not edited or left failing.

| Probe | Setup / desired assertion | Actual result / finding |
|---|---|---|
| R1 | 409 with shipping code; expect status/code on error | Plain Error only — B2 |
| R2 | 400 with `{ error: "Invalid request payload" }`; expect detail | Generic `API 400 /checkout` — B2 |
| R3 | Required products gets 200 `{}`; expect contract failure | Resolves `[]` — B4 |
| R4 | Required products gets non-empty/all-invalid rows; expect failure | Resolves `[]` — B4 |
| R5 | Category ID 1.5; expect rejection | Accepted — B4 |
| R6 | Product IDs/arrays but no name; expect rejection | Accepted — B4 |
| R7 | Arabic stored/native LTR/reload rejects; expect no inconsistent ready | Ready with mismatched native direction — B6 |
| R8 | English → delayed Arabic switch → English selection; expect last choice/pending guard | Arabic wins — B7 |
| R9 | B adapter installed/A supplied token/401; expect no B replay | Mutation sent a second time — B5 |
| R10 | Configured HTTP URL outside dev; expect rejection | Accepted — B9 |
| R11 | Configured malformed URL outside dev; expect rejection | Accepted — B9 |

For future red/green fixes, convert each relevant probe to permanent targeted regression coverage, including realistic response fixtures. Do not copy a test that expects a specific internal implementation when multiple correct fixes exist (e.g. language serialization versus disabled controls).

## File coverage ledger

| Group | Files reviewed |
|---|---|
| Configuration / declarations (12) | `.env.example`, `.gitignore`, `app.json`, `babel.config.js`, `eas.json`, `eslint.config.js`, `expo-env.d.ts`, `jest.config.js`, `metro-js-specifier.js`, `metro.config.js`, `package.json`, `tsconfig.json` |
| Routes (2) | `app/_layout.tsx`, `app/index.tsx` |
| Library/theme/storage (9) | `src/constants/storage.ts`, `src/theme.ts`, `src/lib/lang.tsx`, `src/lib/api/{base,client,http,normalizers,selectors,types}.ts` |
| Jest JS suites (8) | `__tests__/{api-base,api-client,api-data,api-http,app-scaffold,lang-provider,metro-config,root-layout}.test.js` |
| TS suites (5) | `tests/{expo-config,metro-js-specifier,shared-bundle,storage-keys,theme}.test.ts` |
| Assets (3) | `assets/{adaptive-icon,icon,splash-icon}.png` |

## Closure checklist

- [ ] B1: compatible dependency check and mobile lint/typecheck/test/both exports green after alignment.
- [ ] B2/B3/B4/B5/B9: HTTP/error/checkout/DTO/session/base corrections with permanent regressions and legitimate current API fixtures.
- [ ] B6/B7: language startup/switch failure and overlap corrections with permanent regressions.
- [ ] B8: canonical color conversions and appropriate source-based tests/visual comparison.
- [ ] Complete the development-device foundation acceptance already required by Phase 2, with build/device/OS/revision evidence, Arabic/English cold start and live direction switching. Track each platform separately; eventual Android/iOS release acceptance remains mandatory before launch, not inferred from mocked reload or one platform's result.
- [ ] Phase 3 integrations required by the next slice are complete (especially PUT cart before Phase 4); other scheduled additions stay in their assigned phases.
- [ ] Preserve the retained behaviors above; update this record with fix/evidence references before marking the checkpoint closed.

Correction work can start now. Close the source-code findings and the next slice's required acceptance gates before expanding the foundation; complete later-phase features at their assigned gates.
