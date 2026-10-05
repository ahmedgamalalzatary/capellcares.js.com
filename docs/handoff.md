# Mobile implementation session handoff

Date: 2026-10-05, Africa/Cairo. Workspace: `D:\Documents\work\capella\capellastore`, Windows/PowerShell.

This is a structured account of the work, decisions, tools, verification, limitations and conversation outcomes in this session. It is not a verbatim chat transcript. The detailed implementation contract and phase evidence remain in [mobile-app-plan.md](mobile-app-plan.md).

## Starting and ending points

- The user asked to start implementing the mobile customer app using TDD and computer use, then to verify every phase from Phase 0 onward, build anything missing, and update the tracker with evidence.
- The starting implementation revision was `8d8c893c3480b9de26f83e330446d820a0de5b2e`. Existing mobile/auth work was inspected rather than treated as automatically complete. The Expo scaffold, theme/language/storage work and a partial API client already existed; customer providers and production storefront screens did not.
- This session verified Phase 0 and implemented/verified the code portions of Phases 1–3, with a separate commit for each. The last implementation commit made by this assistant was `eddd175`.
- At that point, `git status --short` was empty. Phase 4 was identified as the next phase; it was not started in this session. Native/store/OTA acceptance was still pending.
- While preparing this handoff, HEAD was found to have advanced to `c53f25ddf286d953178cbe81e81d018ca53a025b`. That later commit was not made by this assistant in this session. It fixes recommended-update ordering and adds a regression. The session's full validation results belong to the Phase 3 changes committed as `eddd175`; they must not be represented as a fresh full run against `c53f25d`.
- This handoff is a new documentation file requested explicitly by the user. It is not automatically committed under the earlier per-phase commit instructions.

## User instructions and permissions

1. Follow repository `AGENTS.md`; reread instructions/reference documents after compaction. Preserve concurrent user changes and recheck the workspace before acting.
2. Use TDD, work in focused slices, and use Chrome for computer use. Playwright tests are allowed when useful, rather than being mandatory for every change.
3. Work through phases sequentially. Finish and commit a phase before beginning the next. The user's explicit per-phase commit instruction superseded the original prohibition on unsolicited commits for that phase work.
4. Initially, only `apps/mobile` could be edited. Read other code freely, but stop and explain before editing outside that folder.
5. The user explicitly approved `docs/mobile-app-plan.md` and `pnpm-lock.yaml` outside mobile for tracking and preview dependencies.
6. Phase 3 required shared schemas and API policy/enforcement. The assistant stopped, explained the missing prerequisite, and the user explicitly authorized the entire Phase 3, including its shared/API work. This does not grant unlimited permission for later storefront/ERP edits or other upstream phases.
7. No subagents/background agents were authorized or spawned. Work was performed by the primary assistant. Ordinary test/build/server subprocesses were used.
8. Potentially conflicting commands ran sequentially, especially API/database tests and Expo build/server operations.
9. `AGENTS.md` prohibits command-status polling/repeated timed waits. When the full build exceeded the shell's return window, the assistant asked about the necessary completion collection. The user answered: **“Allow completion waits; no repeated polling.”** Carry that exception forward without turning it into routine status polling.
10. The user is an active collaborator and took over the mouse during an earlier UI check. The assistant restarted that check rather than assuming stale UI state remained valid.

## Conversation decisions and tools discussion

- The user asked what was actually done, what the next step was, whether the plan had phases/slices, and what was complete across all phases. The plan was updated to distinguish verified code from device acceptance and to map mandatory additions to explicit slices.
- The user asked whether Chrome at a small viewport was enough or whether a dedicated emulator was needed. Chrome was accepted for ongoing implementation/browser checks. Installed Android/iOS apps remain necessary for native acceptance; an emulator is not compulsory if a suitable physical phone is available.
- The user has Expo Go on an Android phone. Expo Go can support some checks, but it is not acceptance evidence for dynamic native RTL switching or a production build's runtime/update metadata. An installed Expo development APK on that phone can provide Android native checks without a separate emulator.
- Daily JavaScript/style work can load through Metro after a development build is installed. Native dependency/configuration/SDK changes require a new native build. No APK/IPA was built or installed by this session.
- The user asked whether they could use their mouse/PC while the assistant worked. Coding and headless tests allow ordinary PC use; simultaneous manual computer-use input can conflict. Announce actual desktop input before taking control.
- The user asked to assess [React Native Feel Deploy](https://reactnativefeel.com/deploy). The rendered page and its linked documentation were read. No alternative deployment tool was installed or added to the repository.
- The assessment: it is an independent EAS-compatible build/submit workflow using GitHub Actions, not an emulator and not a guarantee of two-minute native builds. The reviewed differences included unsupported remote version management, incomplete Android submission/auto-submit behavior, and unsupported EAS Update/channel/environment commands. The existing project uses remote version management and needs OTA, so existing EAS was retained. Removing a queue does not remove native compilation time.
- The separate [React Native Feel Sim](https://reactnativefeel.com/sim) offering was mentioned as potentially relevant to streamed iOS simulation from Windows; it was not adopted or tested.
- Finally, the user said **“after finish everything, shutdown pc.”** The assistant asked whether this meant after all remaining phases (4–8) or immediately after Phase 3. The user did not answer that question and instead requested this handoff. **No shutdown command, shutdown schedule or automation was created.** The shutdown condition remains unresolved; do not interpret this document request as permission to shut down now.

## Commits made in this session

| Phase | Commit | Result |
|---|---|---|
| 0 | `73f20b4` — `docs(mobile): record Phase 0 auth transport verification` | Evidence-only verification of existing auth transport |
| 1 | `d175872` — `feat(mobile): verify Phase 1 scaffold and add Chrome preview` | Web preview, browser language handling and Chrome foundation test |
| 2 | `d886c59` — `feat(mobile): add Phase 2 startup and persistence safeguards` | Startup recovery, guarded language changes and storage boundaries |
| 3 | `eddd175` — `feat(mobile): complete Phase 3 API and release policy` | Remaining transports, response validation, identity/policy/enforcement and API failure handling |

No PR, push, merge, deployment, store submission or OTA publication was performed.

## Phase 0: existing auth transport verified

The actual customer/admin auth controllers, services, session persistence, middleware, route tests and disposable-database guards were inspected.

- Explicit `x-client: mobile` with no browser `Origin` selects native refresh-token transport.
- Mobile login returns refresh tokens in JSON without issuing refresh cookies.
- Mobile refresh reads the refresh header before the body and ignores retained web cookies; rotation rejects the previous token.
- Ordinary web requests retain cookie transport and never expose refresh tokens through mobile-header spoofing with a browser Origin.
- Customer/admin mobile logout revokes the corresponding refresh session.
- Scoped API lint/typecheck/build passed. Real HTTP/database tests passed **27 tests** after disposable-schema migrations.
- No Phase 0 source changes were needed. Its commit changed only `docs/mobile-app-plan.md`.
- The whole-repository suite was not run for Phase 0 itself. Later Phase 3 ran it, but that does not resolve the separate U1–U4 auth correctness requirements.

## Phase 1: scaffold and Chrome preview

The existing Expo scaffold was retained. Installed versions were Expo **57.0.26**, React **19.2.3**, React Native **0.86.3**. Expo selected compatible web dependencies: `react-dom`, `react-native-web`, `@expo/metro-runtime`; direct Playwright tooling was added at **1.60.0**.

- Added `web`, `build:web` and `test:e2e` scripts and ignored generated browser/test outputs.
- Browser language switching sets HTML `lang`/`dir` without invoking native RTL/reload APIs. The existing native path remained.
- New browser-language tests were observed failing before implementation, then passed.
- Chrome Playwright uses installed Chrome, a **390×844** touch viewport, one worker, no retries, retained traces/screenshots on failure, and an Expo-managed local server on port 8081.
- The foundation browser test deliberately stubs only products with an empty list to isolate language/bootstrap behavior. It verifies Arabic RTL, English LTR, persistence after reload and return to Arabic; it is not real catalog/API evidence.
- Cold Metro startup exceeded the original test timeout; it was adjusted to 60 seconds. A Metro cache-deserialization problem rebuilt its cache rather than requiring a code patch.
- Phase 2 startup changes already being worked on were saved under ignored `.expo/phase2-pending`, excluded from Phase 1, then restored/tested for Phase 2. This kept phase commits separate.
- Dependency compatibility, lint/typecheck, **13 Jest suites / 107 tests**, one Chrome test, and web/Android/iOS exports passed.

Files in `d175872`:

```text
apps/mobile/.gitignore
apps/mobile/eslint.config.js
apps/mobile/package.json
apps/mobile/playwright.config.ts
apps/mobile/e2e/scaffold.spec.ts
apps/mobile/src/lib/lang.tsx
apps/mobile/__tests__/lang-provider.test.js
docs/mobile-app-plan.md
pnpm-lock.yaml
```

## Phase 2: foundation safeguards

Theme/font primitives were retained; recovery and persistence behavior were implemented/tested.

- Root startup handles font/language failures visibly, with bilingual retry states and usable touch targets.
- Font reload retry is single-flight, handles rejection and avoids publishing raw native error details. Splash prevent/hide rejections are handled.
- Language switching coalesces selections and stops work after unmount. `holdLanguageChanges()` provides nested, idempotently released holds for critical operations, retaining/resuming queued selections and allowing cancellation by choosing the original language.
- Tests reproduced deferred-switch, unmount and hold-ending-during-storage-reconciliation races before the fixes.
- `PersistentValue<T>` validates/canonicalizes reads and writes. Forward-copy migrations preserve old data for rollback, prefer current keys and recheck for a newer current value before writing a migrated value. Storage failures propagate.
- No invented historical language migration was activated. Existing `capella.lang.v1` remains raw `ar`/`en`.
- Browsing-cache clearing removes guest cart, current Ask cache and legacy Ask cache only. It preserves auth/language, SecureStore credentials, pending account writes and technical payment recovery.
- Added versioned keys for Ask, pending cart writes and checkout recovery. This is a primitive, not a completed cart/Ask/payment consumer.
- AsyncStorage is not transactional/CAS. Phase 4 must serialize competing cart writes, isolate accounts and publish token rotation only after SecureStore persistence.
- Consumers must acquire language holds before critical auth/storage/checkout/payment work; real consumer wiring belongs to later phases.
- **14 suites / 127 tests**, lint/typecheck, Chrome RTL position/persistence checks and all three platform exports passed. Native fonts/RTL/large-text/upgrade acceptance remains pending.

Files in `d886c59`:

```text
apps/mobile/app/_layout.tsx
apps/mobile/src/constants/storage.ts
apps/mobile/src/lib/lang.tsx
apps/mobile/src/lib/persistent-storage.ts
apps/mobile/__tests__/root-layout.test.js
apps/mobile/__tests__/lang-provider.test.js
apps/mobile/__tests__/persistent-storage.test.js
apps/mobile/e2e/scaffold.spec.ts
docs/mobile-app-plan.md
```

## Mandatory plan additions and tracking

Git history/diffs for `8d8c893` and `620dc6c` were reviewed at the user's request. Existing mandatory requirements were mapped to explicit slices, rather than marked complete merely because they appeared in prose:

- 2A/2B: startup/language/storage primitives and later consumer obligations.
- 3A: missing API transports; 3B: identity/shared policy/server enforcement; 3C: native config/error handling.
- 4A: secure auth and U1–U4; 4B: guest/account cart state/sync; 4C: cached cold-start/foreground policy, freshness/deduplication/offline/dismissal behavior.
- 5A: bilingual/accessibility/media components; 5B: recommended/required update presentations.
- 6A–6C: complete browse/detail/search/Ask/banner/media/legal/support parity.
- 7A–7D: checkout/recovery, customer journeys, deletion/review safety and feature-update integration.
- 8A–8C: OTA/release policy, store/operations readiness and both-platform acceptance.

Settled product choices include customer storefront only; ERP stays web; Android and iOS launch; feature-only update blocking; current/previous/review-candidate support; in-app video; WhatsApp support rather than a fake contact form; durable guest cart/Ask cache; transient search/filter/checkout form state; minimal technical payment-reference persistence; minimum deletion/review-safety flows; and redacted production-failure notifications. See D1–D12 in the plan for full obligations and unresolved external details.

## Phase 3: API/client and compatibility implementation

The assistant first established mobile/API/shared baselines, then stopped for the required outside-folder permission. After the user authorized all of Phase 3:

- Added authenticated cart GET/PUT, announcements, shipping availability/quote, Paymob methods/status/retry and eligible order cancellation.
- Retained/shared-validated both checkout response kinds. Required advice/orders/reviews/prompts/wishlist/mutation responses now reject malformed success data rather than claiming an empty list or success.
- Added shared customer-response schemas. Catalog normalizers reject unusable slugs, prices and stock. Existing API-compatible provider states include `succeeded` and `voided`.
- HTTP supports PUT, preserves language/auth/idempotency through one authorized 401 retry, retains timeout through body reads, and never repeats a mutation merely because a connection failed.
- Malformed successful JSON becomes a safe `INVALID_PAYLOAD` error. Successful authenticated data arriving after a session/account change is rejected as `SESSION_CHANGED`.
- Added central production-native identity from installed `expo-application` version/build and executing `expo-updates` runtime/update ID. Added the Expo-selected `expo-application ~57.0.3` dependency and its lockfile entries.
- The five fixed identity headers are `X-App-Version`, `X-App-Build`, `X-Platform`, `X-Runtime-Version`, `X-Update-Id`. An additional ordered `X-Client-Revision: 1` handles required OTA capabilities without sorting opaque UUIDs.
- `embedded` is used only for an embedded launch lacking an update ID. Missing production metadata fails before sending. Chrome and Metro/Expo Go development do not invent production-native identity; native auth still uses `x-client: mobile`.
- `authJSON` provides login/signup/refresh/logout transport, including refresh header and no refresh retry. Actual secure token-store/provider state is Phase 4.
- Added public `GET /app-config`, schema version 1, policy revision, per-platform current/previous release identity, recommendations and feature requirements. Candidate remains in the registry and is not publicly advertised.
- `APP_RELEASE_POLICY_JSON` supplies validated API policy. Prelaunch defaults have empty release slots, no gates/recommendation, and cache freshness 0; no store release/link was fabricated. Configured freshness is explicit; no arbitrary reminder timer was added.
- Current/previous require both-store availability. Promotion is a pure operation that refuses incomplete store availability, returns new slots/retired release and requires a new policy revision. An advertised upgrade must satisfy its gate.
- Server enforcement targets only cart replacement, checkout, shipping quote, payment retry, cancellation, wishlist writes and review submission. It handles Express's case-insensitive paths. Browsing/auth/recovery have no whole-app wall; ordinary web behavior is preserved.
- `APP_UPDATE_REQUIRED` carries feature, localized explanation, policy/release and safe store URL. The client retains validated detail in `ApiError.updateRequired`/`feature`; malformed detail cannot supply an unsafe store action.
- Metadata remains untrusted; existing authorization/pricing/shipping/payment validation remains authoritative.
- Resolved U5 by wrapping all affected cart/wishlist/advice/shop-media async handlers with `wrapAsync`. Real HTTP failure injection reproduced the unhandled rejection first, then verified safe 500 responses on all seven affected paths. An initial Node/Windows force-exit/libuv failure in the test harness was eliminated by using controlled Node HTTP requests and socket cleanup rather than outstanding native-fetch timeout handles.
- Marked U9's missing transport/error/checkout-union work resolved, while retaining later UI/provider/device obligations.

All 29 files in `eddd175`:

```text
apps/api/src/modules/admin/advices/storefront-advices.routes.ts
apps/api/src/modules/app-policy/app-policy.ts
apps/api/src/modules/cart/cart.routes.ts
apps/api/src/modules/shop-media/storefront-shop-media.routes.ts
apps/api/src/modules/wishlist/wishlist.routes.ts
apps/api/src/routes/index.ts
apps/api/src/routes/storefront.routes.ts
apps/api/tests/routes/app-config.routes.test.ts
apps/api/tests/routes/mobile-read-failures.routes.test.ts
apps/api/tests/unit/app-policy.test.ts
apps/mobile/__tests__/api-client.test.js
apps/mobile/__tests__/api-data.test.js
apps/mobile/__tests__/api-http.test.js
apps/mobile/__tests__/api-identity.test.js
apps/mobile/__tests__/api-policy.test.js
apps/mobile/__tests__/api-transports.test.js
apps/mobile/e2e/api.integration.spec.ts
apps/mobile/e2e/helpers/real-api.mjs
apps/mobile/package.json
apps/mobile/src/lib/api/client.ts
apps/mobile/src/lib/api/http.ts
apps/mobile/src/lib/api/identity.ts
apps/mobile/src/lib/api/normalizers.ts
docs/mobile-app-plan.md
packages/shared/src/schemas/app-policy.schema.ts
packages/shared/src/schemas/customer-api.schema.ts
packages/shared/src/schemas/index.ts
packages/shared/tests/app-policy.test.ts
pnpm-lock.yaml
```

## Phase 3 verification and artifacts

| Check | Recorded result for Phase 3 |
|---|---|
| `pnpm exec turbo run lint typecheck build --concurrency=1` | 17 successful tasks; 7 cached; web builds and native exports passed |
| `pnpm exec turbo run test --concurrency=1 --force` | 7 successful tasks, none cached; all six workspaces tested sequentially |
| API | 1,083 tests passed |
| Mobile | 171 tests / 17 suites passed |
| Shared | 53 tests passed |
| Database | 63 tests passed |
| Storefront | 576 tests / 86 files passed |
| ERP | 273 tests / 49 files passed |
| Total | **2,219 repository tests passed** |
| `pnpm exec turbo run lint typecheck --concurrency=1 --force` | 12 successful tasks; no cached results |
| Final API build | Exit 0, after related route fixes |
| Expo dependency check | Dependencies up to date |
| Final mobile web export | Exit 0 |
| Final `pnpm --filter @capella/mobile test:e2e` | **2 installed-Chrome tests passed** |
| Git diff check | No whitespace errors; CRLF conversion notices were emitted |

The second Chrome test uses the actual Express app on a random local port and the existing guarded disposable-database reset/seed. It forwards the preview's fixed API URL to this isolated server without replacing response bodies. It displayed **منتج تجريبي 1 / Baseline Product 1** through the real mobile client/normalizer in both languages. The harness explicitly configures localhost:8081 CORS and shuts down its own API server/pool. It does not start production payment/shipping workers.

Final exported bundle identities:

```text
Android: entry-3a3775b2ca3687f03c6a608a69b22d73.hbc
iOS:     entry-f23ad9c5d754968a981ce8b8989480fe.hbc
Web:     entry-0b0cb380a6751905ce32d79a41472560.js
```

Ignored local outputs include `apps/mobile/dist`, `dist-web`, `.expo` and `test-results`. Arabic/English screenshots were captured and visually inspected at:

```text
apps/mobile/test-results/api.integration-Chrome-ren-3441e-a-through-the-mobile-client/phase3-catalog-ar.png
apps/mobile/test-results/api.integration-Chrome-ren-3441e-a-through-the-mobile-client/phase3-catalog-en.png
```

These outputs are regenerable and may disappear after another test run. No screenshot/build output was committed. Exports do not establish installed Android/iOS or store/provider acceptance. Node color-environment warnings, dependency deprecation/peer warnings and expected ERP negative-case API-409 diagnostics occurred; checks passed, but the session did not claim warning-free logs.

## Tools, skills and computer-use limitations

- PowerShell shell commands, `rg`, Git, `apply_patch`, pnpm, Expo CLI, TypeScript, Jest, Playwright, Turbo, Node's test runner, existing Vitest tests and local MySQL-backed API/database tests.
- TDD skill and `writing-good-tests.md`: tests first, observed failures, minimal implementation, then targeted/full validation as appropriate. Native bridge and external network/DB-failure adapters were mocked where necessary; existing real HTTP/database/browser integration was preserved.
- Computer-use skill and its guidance/API/confirmation documents; persistent Node REPL with `@oai/sky` for earlier Windows Chrome targeting/observations.
- Chrome executable was available at `C:\Program Files\Google\Chrome\Application\chrome.exe`; installed Chrome worked through Playwright.
- The Chrome browser-use connector was unavailable. Earlier Windows Chrome control stopped when the tool could not confidently identify the current URL for policy enforcement. The assistant stopped input and did not bypass that safety block.
- Phase 3 rechecked computer-use inventory: only Codex in-app browser and MCP Apps browser surfaces were exposed, with no Chrome connector. No manual Chrome acceptance was claimed. Headless Chrome tests and screenshot inspection supplied the automated browser evidence.
- Own temporary Expo servers were managed/cleaned up; a process was only stopped after identifying it as the assistant's matching Expo server. No unrelated user process was intentionally terminated.
- Web search/page reading and headless rendered-page extraction were used for React Native Feel/Expo documentation. `view_image` inspected generated Chrome screenshots. No image-generation/design tool was needed for the data-layer work.
- TDD and computer-use skills were applied. An OpenAI documentation skill was read incidentally earlier but was not relevant to the mobile implementation. No subagent tools were used.

Useful references reviewed: [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Expo Application](https://docs.expo.dev/versions/latest/sdk/application/), [Expo Updates](https://docs.expo.dev/versions/latest/sdk/updates/), [React Native Deploy differences](https://react-native-deploy.pages.dev/deploy/docs/guide/differences), and [getting started](https://react-native-deploy.pages.dev/deploy/docs/guide/getting-started). Recheck time-sensitive tooling/store facts when release work begins.

## Later repository change observed during handoff

`c53f25d` changes exactly:

```text
apps/api/src/modules/app-policy/app-policy.ts
apps/api/tests/routes/app-config.routes.test.ts
```

Its fix compares app version, then native build, and consults client revision for a recommendation only when builds are equal. Previously, a newer build with an older client revision could wrongly receive a recommendation for the older current build. Its new regression covers that scenario. This handoff inspected the commit/diff and preserved it; it did not implement it or rerun the full suite for it. The phase evidence in the plan still records the session's earlier counts/revision, so future work must establish a current baseline.

## Remaining work and next starting point

Next: **Phase 4**, in its own phase commit after implementation/verification.

- 4A: SecureStore token persistence, single-flight refresh, customer auth provider/bootstrap and account/session isolation. U1–U4 require API hardening: validate signup/login plus abuse protection; distinguish transient refresh failures from rejection; atomic safe rotation/interruption handling; immediate access/refresh revocation when logout reaches the API. Safe recovery fallback is re-login, not weakened replay protection.
- 4B: durable guest cart, registered-cart pull/merge/serialized uploads, persisted account-isolated pending writes, clear-versus-pull/account-switch races and purchased-cart reconciliation.
- 4C: policy cache/provider at cold start/foreground, freshness/deduplication, no-cache/invalid/offline recovery and dismissal state. The Phase 3 fetch/error contract exists; lifecycle/provider/UI integration does not.
- Before editing later upstream API/shared/web files, explain the concrete scope and obtain any permission required by the user's folder restriction. Phase 3's approval is not a blanket grant for U1–U4, web wishlist/deletion/review changes or ERP redesign.
- Phase 5 still needs actual bilingual accessible UI/media/update components; Phase 6 production catalog/search/Ask/banner/legal navigation; Phase 7 checkout/customer journeys/deletion/review safety/update recovery; Phase 8 assets, signing/stores, channels/OTA, operations and all outstanding native acceptance.
- The root home screen is still a diagnostic product/language screen. Do not confuse it with finished storefront UI. Replace it in Phase 6 without leaving duplicate root routes.
- Existing EAS account/project/profile configuration is groundwork: owner `alzatary`, project `4849c50d-3d67-4bca-9bdd-316605f03fa2`, development/preview/production profiles. No real current/previous/candidate store releases were configured by this session.
- Native development/release builds need rebuilding to include `expo-application`. A physical Android phone needs an explicit LAN-reachable API URL; it cannot use the PC's localhost. Both-platform production acceptance is still mandatory.
- Preserve guest cart/Ask caches until cleared, keep browsing/forms transient, and persist only minimal technical unresolved-payment recovery. Cache clearing must not delete credentials or unresolved payment references.
- U5/U9 are resolved here. U1–U4, U6 web wishlist races, U7 deletion, U8 customer review safety, U10 fake web contact success and U11 upstream-documentation reconciliation still need their recorded dispositions.
- Actual signing/store/provider access, deletion retention details and a production-failure notification destination/service access remain external prerequisites. No notification was sent by this session.
- Establish the current baseline at HEAD before further implementation. Keep native acceptance separate from code/browser verification, update the plan with evidence, and commit each completed phase separately.
- Resolve the user's shutdown timing before taking that action. This handoff does not mean all remaining phases are finished.
