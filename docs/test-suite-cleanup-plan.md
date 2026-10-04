# Test-suite audit and cleanup plan

## Status and scope

This is a proposed implementation plan. Creating this document does not authorize cleanup.
Execute only phases/slices subsequently authorized by the owner. No cleanup has been performed.
Repository AGENTS.md applies; re-read it and this plan after context compaction.
Do not commit or use sub-agents without fresh, explicit authorization.

Goal: remove redundant checks, improve isolation and assertions, and fill important behavioral gaps.
Reducing the test count is an outcome, not the success criterion.
Preserve concurrent owner changes and re-check every finding against current files before acting.

## Verified baseline and limits

The owner confirms that all existing workspaces pass their normal test runs.
All six full workspace coverage runs subsequently passed; ERP/storefront also passed normal-order rechecks.
Shuffled failures are a separate test-isolation finding, not current default-run failures.

| Workspace | Framework / locations | Files | Expanded cases | Audit execution |
| --- | --- | ---: | ---: | --- |
| apps/api | Node test + tsx; tests/{contracts,helpers,modules,routes,services,unit,units} | 119 | 1,025 | Full coverage command passed |
| apps/erp | Vitest 4 + Testing Library; tests/ | 48 | 267 | All passed normally |
| apps/storefront | Vitest 4 + Testing Library; tests/{components,contracts,unit} | 86 | 576 | All passed normally |
| apps/mobile | Jest 29 + jest-expo; __tests/ and tests/ | 14 | 89 | All passed |
| packages/database | Node test + tsx; tests/ | 7 | 50 | All passed with coverage |
| packages/shared | Node test + tsx; tests/ | 15 | 42 | All passed |
| Total | Six workspaces | 289 | 2,049 | All six full coverage commands passed |

Inventory counts include static parameter expansion; API's case count is from that inventory.
Initial read-only audit ran subsets; subsequent full API/database coverage ran sequentially against local capella_test.
No confirmed orphan test, permanent skip/only/todo marker, or snapshot assertion was found.
Working-tree changes, including deleted Playwright files, already existed before the audit.

### Runners and coverage

- Root: pnpm test invokes Turbo with concurrency 4 and test dependencies on upstream builds.
- Root coverage: pnpm test:coverage invokes Turbo with concurrency 1; its task is now configured with upstream builds/environment forwarding.
- API: node scripts/run-tests.mjs; pretest invokes database migrations; per-file concurrency 1.
- Database: node scripts/run-tests.mjs; migration pretest; per-file concurrency 1.
- ERP/storefront: vitest run. Mobile: jest. Shared: tsx --test tests/**/*.test.ts.
- Coverage scripts now exist in every workspace; ERP/storefront have @vitest/coverage-v8 4.1.6. No thresholds are configured.
- ERP/storefront measurement: --coverage --coverage.reporter=text --coverage.include=src/**/*.{ts,tsx}.
- Mobile measurement: --coverage --coverageReporters=text with collectCoverageFrom for both src/** and app/** TypeScript files.
- API/database measurement: node scripts/run-tests.mjs --coverage; shared: pnpm run test:coverage.
- Workspace commands were run directly; the root Turbo coverage/build pipeline itself was not validated.
- Normal order, disabled caching where supported, and four Vitest workers were used; database-backed workspaces ran sequentially.
- Audit Vitest runs disabled caching and supplied __dirname in memory to avoid bundling config files.
- Seed-42 failures reproduced with both runner and native config loaders; no config files were changed.

### Measured coverage baseline

| Workspace | Lines | Branches | Functions | Denominator |
| --- | ---: | ---: | ---: | --- |
| ERP | 75.83% | 71.57% | 70.02% | src TypeScript, including unimported files |
| Storefront | 79.63% | 73.14% | 72.73% | src TypeScript, including unimported files |
| Mobile | 97.78% | 80.64% | 96.66% | src and app TypeScript |
| API | 97.62% | 86.66% | 95.76% | Loaded src TypeScript; scripts excluded |
| Database | 95.45% | 78.18% | 87.50% | Loaded src TypeScript; drizzle/schema and migrations excluded |
| Shared | 90.11% | 94.25% | 62.50% | Loaded src TypeScript |

Node figures exclude unimported files and include type/barrel declarations; they are not whole-workspace percentages or guaranteed lower bounds.
These scopes/providers differ, so do not average the numbers or compare workspaces as a quality ranking.
Coverage proves execution, not useful assertions or race safety; passing coverage runs do not resolve Phase 1.

| Evidence from measured coverage | Plan consequence |
| --- | --- |
| ERP admin-auth.tsx and advice-form.tsx: 0% lines | Add Slice 5.6; prioritize real auth-provider behavior |
| ERP staff-editor-form.tsx: 51.64% lines, 59.01% branches | Supports mutation/dependency checks in 5.3 |
| ERP reconciliation page: 92.85% lines, 50% branches | High line coverage still misses the states in 5.3 |
| Storefront wishlist-provider.tsx: 63.82% lines, 54.54% branches | Supports account/mutation races in 5.1 |
| Storefront use-checkout.ts: 92.56% lines, 76.15% branches | Review uncovered branches; retain existing checkout scenarios |
| Mobile app/index.tsx: 88.23% lines, 62.50% branches | Supports rendered loading/error behavior in 5.4 |
| Shared ordering.ts: 45.45% lines, 25% functions in shared suite | Supports owner-level cases in 5.5; app coverage remains complementary |
| API callback processing: 90% lines / 86.96% branches; financial evidence: 94.63% / 95.45% | Preserve existing integration tests; investigate specific missing branches |
| API checkout retry/status: 83.33% / 98.04% lines; startup/sync policy: 100% / 100% lines | Reject “no tests” claims; sync policy still has only 72.22% branch coverage |

## Rules for every slice

1. Read complete affected tests, source, setup, fixtures, runners, and integration points.
2. Check current Git state; identify owner changes and preserve them.
3. Establish normal-order green for the affected area before implementation, per AGENTS.md.
4. For known isolation defects, additionally reproduce the named shuffled failure before fixing it.
5. For behavioral fixes, demonstrate a focused failing regression first, then implement the minimal complete fix.
6. For consolidation, map old inputs/assertions to retained cases before deleting anything.
7. Validate touched tests plus appropriate lint/typecheck/build checks; use non-emitting checks where possible.
8. Broaden verification only for shared setup, runner changes, multiple scopes, or unresolved failures.
9. Record results, case/file count changes, remaining decisions, and the next slice in this document.

Run conflicting commands sequentially. Confirm disposable test-database targets before resets/migrations.
Execute API/database suites sequentially until isolation is implemented; coverage root concurrency 1 helps, but normal root test concurrency remains 4.
Do not weaken assertions, skip tests, or widen timeouts simply to make a failure disappear.
Keep slices focused; finish and validate one slice before moving to the next.

## Phase 1 — Fix reproduced order dependence

Priority: first. Confidence: high for all six slices below.
Expected impact: preserve behavior/cases and eliminate 11 reproduced shuffled failures across seven files.

Use each workspace's existing runner from its directory. Example for one ERP file:

~~~powershell
pnpm exec vitest run tests/product-edit-page.test.tsx
pnpm exec vitest run tests/product-edit-page.test.tsx --sequence.shuffle --sequence.seed=42
~~~

### 1.1 ERP mock history — DONE

- [x] File: apps/erp/tests/product-edit-page.test.tsx.
- Evidence: “shows a 403 state without subscribing…” inherits apiGet calls; seed 42 fails at line 122.
- Start: reproduce the failure; inspect all five cases and their queued mock responses.
- Do: reset call history, queued responses, auth defaults, and captured props before each case.
- Finish: entire file passes normal and shuffled order; forbidden cases still prove no requests/subscriptions.
- Result: added a top-level `beforeEach` resetting `apiGet` (calls + queued responses), `capturedProps`,
  the admin-auth default, and `mockedUseStore` call history. Verified 5/5 normal and 5/5 seed-42 shuffle.

### 1.2 ERP DOM teardown — DONE

- [x] Files: apps/erp/tests/setup.ts, categories-page.test.tsx, bundle-form-item-reorder.test.tsx.
- Evidence: root category reorder finds duplicate category-row-1; offer YouTube editing encounters duplicate label/input associations.
- Start: inspect cleanup registration; setup currently imports only jest-dom matchers.
- Do: explicitly unmount React renders after each case; isolate form-save mocks.
- Finish: both affected files and the full ERP suite pass normal and seed-42 order, without duplicate DOM/IDs.
- Result: `tests/setup.ts` now registers `afterEach(cleanup)` — the project has no `globals: true`, so
  RTL never auto-cleaned and renders accumulated in `document.body`. Form-save mocks were already
  cleared per case. Both files verified 4/4 normal and 4/4 seed-42 shuffle; full-ERP suite deferred to
  the Phase 1 exit run per owner instruction.

### 1.3 ERP store listeners and completion — DONE

- [x] File: apps/erp/tests/store.test.ts; source: apps/erp/src/lib/store/core.ts.
- Evidence: focus-refetch case expects 18 calls but receives 36 after shuffle.
- Why: resetting modules leaves previously registered focus/visibility listeners attached; flush uses setTimeout(0).
- Start: trace store creation, browser listeners, auth subscriptions, and all teardown paths.
- Do: remove test-owned listeners/subscriptions between cases; wait for observable completion.
- Replace broad totals 18/9 with relevant endpoint calls and state assertions, retaining duplicate-fetch protection.
- Finish: all ten cases pass both orders; one focus event triggers only the current store's intended requests.
- Result: a `beforeEach` spies `window.addEventListener` to record focus listeners, and `afterEach` calls
  `vi.restoreAllMocks()` + `removeEventListener` for each before resetting modules, so stale stores can no
  longer answer the focus event (tests never dispatch `visibilitychange`, so only focus listeners needed
  detaching). Both `toHaveBeenCalledTimes(18)` asserts replaced with a products-endpoint count of exactly 2
  plus their existing state assertions. Verified 10/10 normal and 10/10 seed-42 shuffle.

### 1.4 Storefront environment/global restoration — DONE

- [x] File: apps/storefront/tests/contracts/storefront-client.contract.test.ts.
- Evidence: product/category cases receive production upload URLs after the Docker/public-origin case.
- Start: inspect static imports, module resets, stubEnv, stubGlobal, and API-base evaluation.
- Do: establish explicit environment defaults; restore globals/environment and reload modules consistently.
- Finish: all nine cases pass both orders, preserving internal fetch host versus public media host behavior.
- Result: `normalizers.resolvePublicMediaBase()` read `process.env.NEXT_PUBLIC_API_URL` at call time, and
  `vi.restoreAllMocks()` does not undo `stubEnv`/`stubGlobal`, so the Docker case leaked its production URL.
  Added a `beforeEach` pinning `NEXT_PUBLIC_API_URL`/`API_INTERNAL_URL` to empty and an `afterEach` calling
  `vi.unstubAllEnvs()` + `vi.unstubAllGlobals()` + `vi.restoreAllMocks()` + `vi.resetModules()`. Verified
  9/9 normal and 9/9 seed-42 shuffle.

### 1.5 Storefront matchMedia restoration — DONE

- [x] File: apps/storefront/tests/components/ask-capella-overlay.test.tsx; shared tests/setup.ts.
- Evidence: four focus/conversation cases throw on undefined .matches after the touch-device case.
- Why: restoring the existing matchMedia mock leaves it without an implementation.
- Do: supply a fresh, complete media-query implementation per case and restore prototype mutations.
- Finish: all five cases pass both orders; desktop focus and touch-device behavior remain distinct.
- Result: `tests/setup.ts` now wraps the matchMedia stub in `installMatchMedia()` (made `configurable`)
  and reinstalls it in a `beforeEach`, so the touch case's `vi.spyOn(...).mockRestore()` can no longer leave
  `window.matchMedia` unimplemented for later cases. `use-ask-capella.ts:82` reads `.matches` at open time.
  Verified ask-capella 5/5 normal and 5/5 seed-42 shuffle; shop-media-strip (other matchMedia consumer) 29/29.

### 1.6 Storefront browser history — DONE

- [x] File: apps/storefront/tests/components/paymob-result.test.tsx.
- Evidence: locale-neutral redirect unexpectedly retains checkoutId from another case.
- Do: reset URL/history alongside storage, timers, and mocks before each case.
- Finish: all twelve cases pass both orders; reference-preserving and reference-free redirects remain covered.
- Result: added `window.history.replaceState({}, "", "/")` to the existing `beforeEach` so the shared jsdom
  history cannot carry a `checkoutId` URL between cases. Verified 12/12 normal and 12/12 seed-42 shuffle.

Phase exit: ERP 267/267 and storefront 576/576 pass normal order and seed 42 before pruning starts. — MET
  (Phase 1 verified: ERP 48 files/267 and storefront 86 files/576 both pass normal order and seed-42 shuffle.)

## Phase 2 — Remove clear redundancies and normalize paths

Confidence: high from source/assertion comparison; database-dependent deletion still requires execution evidence.
Expected impact: six fewer cases; naming changes do not alter discovery or behavior.

### 2.1 Redundant cases — DONE

- [x] ERP product-edit-page.test.tsx: delete weaker “shows a 403 state for staff without products.update”; retain stronger no-fetch/no-subscription case. Reduction: 1.
- [x] Mobile __tests__/app-scaffold.test.js: delete two “provides app/%s” existence cases; real home/layout imports already detect missing files. Reduction: 2.
- [x] Mobile __tests__/metro-config.test.js: delete “exists…” and “provides a custom resolver…”; retain rewrite, fallback, and outside-shared behavior. Reduction: 2.
- [x] API tests/units/receipt-hold-policy.test.ts: delete “the SQL and application forms agree on every documented outcome.” Reduction: 1.
- That policy case computes a local JavaScript expression rather than calling SQL; the preceding real-MySQL test covers the same inputs plus malformed values.
- Start: verify stronger cases still exist and pass, especially the actual SQL predicate case.
- Finish: retained assertions/scenarios documented; touched suites green; no new coverage gap.
- Result: removed the four weaker cases (and the now-unused `existsSync`/`path` imports in the two mobile
  files). Verified — ERP product-edit-page 4/4 normal + 4/4 seed-42; mobile app-scaffold + metro-config
  8/8; API receipt-hold-policy 7/7 (the real-MySQL predicate case with malformed values is retained).

### 2.2 Naming — DONE

- [x] Move apps/api/tests/units/receipt-hold-policy.test.ts into tests/unit/.
- [x] Rename apps/api/tests/routes/order-payment-status.route.test.ts to .routes.test.ts.
- Start: search references and runner discovery before moving/renaming.
- Finish: imports/references resolve, all original cases run, empty units/ directory removed if applicable.
- Result: `git mv` for both; no code referenced either filename; both match the runner's `tests/**/*.test.ts`
  glob and keep the same relative-import depth. Empty `tests/units/` removed. Verified receipt-hold-policy
  7/7 and order-payment-status.routes 3/3 under the new paths.

Phase exit (Phase 2): — MET. Full suites for the three touched workspaces: ERP `vitest run` exit 0;
  API 1,024/1,024; mobile 14/14 suites and 85/85 tests (89 baseline − the four deleted cases). The mobile
  full run requires `NODE_ENV=test`; under an inherited `NODE_ENV=production` shell, 21 cases in four suites
  (`api-base`, `root-layout`, `app-scaffold`, `lang-provider`) fail with "EXPO_PUBLIC_API_URL is required
  outside development". Verified this reproduces identically on a clean tree, so it is a shell-environment
  prerequisite rather than a defect introduced by these slices.

## Phase 3 — Consolidate checks at their owner

Expected impact: approximately twelve fewer cases and two fewer files, preserving unique inputs/assertions.
Confidence: high; exact i18n wording remains an owner decision.

### 3.1 Shared packaging boundary — DONE

- [x] Compare mobile __tests__/shared-boundary.test.js with packages/shared/tests/optional-ui-peers.test.ts.
- [x] Both inspect the same manifest; shared additionally protects zod as a hard dependency.
- [x] Do: retain canonical shared checks; remove the six mobile metadata copies.
- [x] Finish: shared test runs in normal workspace orchestration; mobile import/Metro checks remain. Reduction: 6.
- Mapping: the mobile `test.each` asserted, per package, "not in dependencies", "in peerDependencies",
  and "peerDependenciesMeta[name] === { optional: true }" for the same six names
  (class-variance-authority, clsx, lucide-react, radix-ui, react, tailwind-merge). The shared test asserts
  exactly those three properties per name and additionally requires zod as a hard dependency, so the mobile
  file was a strict subset.
- Result: deleted `apps/mobile/__tests__/shared-boundary.test.js` with `git rm`. No code referenced the
  file; `jest.config.js` discovers it only through the `__tests__/**/*.test.js` glob. Verified — canonical
  shared `optional-ui-peers` 1/1; mobile full suite 13/13 suites, 79/79 tests (85 − 6).

### 3.2 Shared API-base behavior — DONE

- [x] Merge apps/erp/tests/api-base.test.ts and apps/storefront/tests/unit/api-base.test.ts into shared tests.
- [x] Do: preserve six unique scenarios: server internal URL, explicit browser public URL, localhost, ERP host, storefront host, and www host.
- [x] Only the first two cases overlap; domain variants are not interchangeable.
- [x] Finish: shared runner supports controlled browser globals and restores them; app client integration cases remain. Reduction: 2.
- Mapping: both apps imported the same `resolveApiBase` from `@capella/shared/api/base` and shared two
  byte-identical cases (server internal URL; browser falls back to explicit public URL). Union = six cases;
  ERP contributed the ERP-host case, storefront contributed localhost, storefront host, and www host.
  Domain variants share one code path but each pins a distinct hostname, so all six are kept.
- Result: added `packages/shared/tests/api-base.test.ts` with all six scenarios using a `withBrowserLocation`
  helper that installs and restores `globalThis.window` (restoring or deleting it, so no state leaks between
  Node test files). Deleted both app-level copies with `git rm`; the apps keep 44 files of client-integration
  coverage, and both still wire `resolveApiBase` into their clients.
- Test-proof: mutated the shared resolver's localhost port `4000` → `9999` and confirmed the localhost case
  fails (5/6 pass, exit 1), then reverted; source unchanged. Verified — shared api-base 6/6, shared full
  suite 48/48, shared typecheck exit 0; ERP 47 files/263 tests; storefront 85 files/571 tests.
- Environment note: Vitest workspaces here require `NODE_ENV=test`. Under `NODE_ENV=production` React
  resolves its production build and every RTL file fails with "React.act is not a function" (ERP showed
  238 failures), which is unrelated to these changes.

### 3.3 Mobile theme, storage, and configuration — DONE

- [x] Consolidate __tests__/foundation.test.js, tests/theme.test.ts, and tests/storage-keys.test.ts.
- [x] Do: use canonical palette, radii/spacing, and font tests; preserve all four storage keys, including refresh token.
- [x] Keep the Expo declaration/tsconfig reference check in a clearly named configuration test.
- [x] Foundation is not fully covered by current replacements; never delete its unique checks first.
- [x] Finish: complete assertion mapping and green mobile suite. Estimated reduction: 3.
- Mapping (foundation's five cases, none dropped):
  - palette (full `toEqual` on all 11 colors) → `tests/theme.test.ts`, upgraded from 11 individual
    `toBe` checks to one `toEqual`;
  - radii+spacing → `tests/theme.test.ts` (radii already present; spacing was unique and was added);
  - font-name map → `tests/theme.test.ts` (was unique, added as a fourth case);
  - storage keys → `tests/storage-keys.test.ts`, extended from three keys to all four, splitting the
    previously untested `CUSTOMER_REFRESH_TOKEN_KEY` into its own case;
  - Expo `expo-env.d.ts` reference + tsconfig include → new `tests/expo-config.test.ts`.
- Result: deleted `apps/mobile/__tests__/foundation.test.js` with `git rm`. Five cases in became seven
  across three canonical files; nothing unique was lost, and the refresh-token key is now asserted
  explicitly rather than only inside a whole-object equality.
- Test-proof: caught a wrong `__dirname` depth (`../../` → `../`) in the relocated config test because it
  failed before any deletion happened. Then mutated `spacing.xxxlarge` 48 → 47 and
  `CUSTOMER_REFRESH_TOKEN_KEY` v1 → v2 and confirmed theme and storage tests both fail; reverted, and
  `git diff -- apps/mobile/src` is empty. Verified — mobile full suite 13/13 suites, 78/78 tests.

### 3.4 i18n placeholder redundancy — DONE

- [x] packages/shared/tests/i18n.filter-labels.test.ts: remove weaker “label is a template…” if exact-string checks remain.
- [x] Exact expected strings already require {name} in both languages.
- [x] If wording is flexible, retain a placeholder contract instead and review literal wording locks with the owner.
- [x] Finish: requested-language interpolation stays protected. Reduction: 1 under the exact-wording option.
- Result: removed the weaker `includes("{name}")` case. The retained case asserts exact equality to
  `"All {name} Types"` / `"كل أنواع {name}"`, which cannot pass without the placeholder.
- Test-proof: temporarily changed `en.nav.allCategoryTypes` to `"All Types"` and confirmed the remaining
  exact-string case fails (3 run, 2 pass, exit 1), then reverted; `git diff -- packages/shared/src` is empty.
  Verified — i18n.filter-labels 3/3.
- Owner decision flagged: the retained case locks literal English and Arabic wording, not just the presence
  of the placeholder. Under the "exact wording" option this is intended, but a copy change will now fail
  here. The plan's alternative (placeholder-contract assertion, wording free) was not taken; say the word if
  you prefer it.

Phase exit (Phase 3): — MET. Full suites: shared 48/48 and typecheck exit 0; ERP 47 files/263 tests;
  storefront 85 files/571 tests; mobile 13/13 suites, 78/78 tests. Net Phase 3 reduction: 11 cases
  (79 → 78 mobile, 48 shared including the 6 new merged api-base cases, ERP 267 → 263, storefront 576 → 571)
  and 5 files removed (mobile `shared-boundary`, `foundation`; ERP and storefront `api-base`).

## Phase 4 — Strengthen fixtures, assertions, and runners

### 4.1 Current versus legacy collection fixtures — DONE

- [x] Inspect packages/database/src/seeds/test.seed.ts and API tests/modules/admin/admin-detail.repository.test.ts.
- [x] Evidence: normal collection fixtures use child categories, bypassing current root-category write validation.
- [x] Do: make canonical fixtures valid; retain child-category examples only as explicitly named compatibility cases if needed.
- [x] Also replace Array.isArray-only hydration assertions with expected variant/item identities and values.
- [x] Finish: affected repository/routes/checkout cases pass against realistic fixtures. Confidence: high.
- Finding: the seeded collection was written with `categoryId: leafCategory.id`, while
  `assertRootCollectionCategory` (collection.repository.ts:178) rejects a non-root category with
  `COLLECTION_CATEGORY_MUST_BE_ROOT`. `ensureCollection` inserts directly, so the seed produced a row the
  application itself would refuse to create. The seeded offer one block above already used `rootCategory.id`
  with a comment explaining that rule, so the collection line was an inconsistency.
- Result: seed now uses `rootCategory.id` with a matching comment. Added
  `packages/database/tests/test-seed-fixtures.test.ts` asserting both the seeded offer and the seeded
  collection resolve to a category whose `parentId` is null — an executable statement of the rule the seed
  must satisfy. No child-category collection example was retained: no test needed one.
- Test-proof: reverted the seed to `leafCategory.id` and confirmed the new case fails with "seeded collection
  must be classified under a root category" (2 run, 1 pass, exit 1) while the offer case still passes; then
  restored. Verified — seed-fixtures 2/2, admin-detail.repository 3/3, admin-collections.routes 13/13.
- Hydration assertions: replaced the three `Array.isArray` checks with identities —
  product keywords `["test","baseline"]` and its single variant id; offer items as ordered
  `{variantId, qty}` pairs; collection items likewise plus `categoryId`. The collection case also had to
  change: it inserted its own row under `ids.leafCategoryId`, the same invalid pattern, so it now uses
  `ids.rootCategoryId` and uses distinct quantities (2 and 1) so item merging is actually observable.
  Correcting the keywords expectation to the real seeded value required reading the failure output — the
  product is seeded with `test`/`baseline` keywords, not an empty array.
- Incidental finding (not fixed here, belongs to 4.4): `seedTestData()` is not idempotent — `ensureOfferItem`
  violates `offer_items_offer_variant_unique` on a second call. Existing tests hide this by calling
  `clearTestSeed()` first; the new test follows that convention. Worth making the seed re-runnable.

### 4.2 Deterministic configuration and precise rejection assertions — DONE

- [x] Storefront tests/unit/next-config.test.ts: replace dependency on untracked root .env with controlled fixtures/environment.
- [x] Preserve development and production image restrictions; verify behavior from a clean checkout configuration.
- [x] Database tests/integrity.test.ts and shipping-schema.test.ts: assert intended FK/unique/check errors, not any rejection.
- [x] Review API bare assert.rejects similarly, preserving positive controls and post-failure state assertions.
- [x] Finish: unrelated connectivity/query errors cannot masquerade as expected validation failures. Confidence: high.
- Reproduced the clean-checkout defect: with the root `.env` renamed away, `next-config.test.ts` failed
  ("expected undefined to be 'http://localhost:4000'"). `loadWorkspaceEnv()` reads the untracked
  workspace-root `.env`, and only `.env.example` is tracked, so that case could never pass on a fresh clone.
- Result: the case now sets `NEXT_PUBLIC_API_URL` explicitly and asserts the Next `env` block forwards it.
  Added a case asserting the config forwards whatever the environment resolved without substituting its own,
  and a case that runs from a fresh temp directory (no `.env` two levels up) and asserts both the process
  variable and `env` block are undefined — a genuine clean-checkout check. Image-pattern and
  `dangerouslyAllowLocalIP` development/production cases are unchanged.
- Test-proof: the new temp-directory case first failed ("expected 'http://localhost:4000' to be undefined")
  because an earlier case had set the variable and Vitest shares one `process.env` per worker; it now deletes
  the variable explicitly. Verified 6/6 both with and without the root `.env` present.
- Rejection assertions: added `packages/database/tests/helpers/mysql-errors.ts` exporting
  `FK_MISSING_ROW`, `UNIQUE_VIOLATION`, `CHECK_VIOLATION` and `rejectsWithCode`, which reads the driver code
  from the error or its `cause`. Applied to 13 previously bare rejections across `integrity.test.ts`
  (FK, unique, check, and the entity_media owner-count check) and `shipping-schema.test.ts` (negative
  shipping amount, missing order, tracking uniqueness, event fingerprint, work-item idempotency and
  shipment FK). Codes were confirmed empirically against the live schema rather than assumed.
- Test-proof: temporarily asserted a deliberately wrong code and confirmed the case fails with
  "(received: ER_NO_REFERENCED_ROW_2)", proving the helper discriminates; restored.
- API: `shipping-rate.repository.test.ts` had two bare rejections. `saveShippingRate` throws
  "Refusing to persist an invalid shipping rate amount", so both now match that message, and a new positive
  control proves a valid rate still persists — so the rejection cannot be a dead database. 7/7.
- Verified: database 52/52 and typecheck 0; storefront typecheck 0; shipping-rate.repository 7/7.

### 4.3 Behavior rather than source text or misleading names — DONE

- [x] Database tests/test-seed-source.test.ts: replace whole-file transaction regexes with an actual rollback test.
- [x] API tests/unit/rate-limit.test.ts: “is O(1)” currently proves entry retention, not absence of scanning; detect iteration or rename accurately.
- [x] API tests/services/interval-worker.test.ts: verify original reported error and report count, with bounded waiting.
- [x] Database shipping-schema.test.ts: “orders store immutable shipping quote snapshots” verifies persistence, not immutability; rename or add the actual invariant.
- [x] Finish: each title matches its demonstrated behavior. Confidence: high.
- Replaced `test-seed-source.test.ts` (three regexes over the seed source) with
  `packages/database/tests/category-paths-transaction.test.ts`, which asserts that the rebuilt closure gives
  every descendant a depth-0 self row, that `rebuildCategoryPaths` is idempotent, and that a delete followed
  by a failing insert inside one transaction leaves the table fully intact. `rebuildCategoryPaths` is now
  exported for this; the seed's behavior is otherwise unchanged (`git diff` shows the export keyword only).
- Scope limit recorded in the test file: forcing `rebuildCategoryPaths` itself to fail was attempted with a
  connection-scoped temporary table shadowing `category_paths`, but the pooled client gives the rebuild's
  statements a different connection, so the shadow never applied and the case passed regardless. That
  approach was abandoned rather than kept as a test that cannot fail. Forcing a duplicate row and a
  self-referencing category were also tried and rejected — the rebuild's `seen` guard and the unique key
  respectively made them not fail.
- rate-limit: the old case titled "is O(1): it does not scan or evict unrelated keys" only asserted that an
  unrelated entry survived, which a scanning implementation would also satisfy. Replaced with an
  `IterationCountingMap` subclass that counts `[Symbol.iterator]`, `entries`, `values`, `keys` and
  `forEach`, asserting `evaluateRateLimit` performs zero traversals after the store is filled with 50 keys,
  plus a companion case proving `pruneExpiredBuckets` *does* traverse — so the assertion is discriminating
  rather than vacuous.
- Test-proof: temporarily added a full-map scan at the top of `evaluateRateLimit` and confirmed the case
  fails with "evaluateRateLimit must not traverse the store"; reverted.
- interval-worker: the case only awaited a resolve and never inspected what `onError` received. It now
  collects reports, asserts exactly one per failed sweep after a bounded 50ms window, and asserts the value
  is the original `Error` with the original message.
- shipping-schema: renamed "orders store immutable shipping quote snapshots" to "orders persist the shipping
  quote snapshot they were created with", and the case now explicitly demonstrates that the column *can* be
  rewritten. Immutability is an application-layer rule (shipping guards in `apps/api`), not a schema
  guarantee, so the test no longer claims it.
- Verified: rate-limit 5/5, interval-worker 3/3, shipping-schema 14/14.

### 4.4 Database and resource isolation — PARTIAL (see remaining work)

- [x] Inspect root Turbo orchestration, both test runners, resetApiTestDatabase, clearTestSeed, and cleanup hooks.
- [x] Findings: concurrent workspaces can reset shared tables; pooled FOREIGN_KEY_CHECKS changes are connection-local; cleanup errors are swallowed.
- [x] Do: isolate test databases or serialize database-backed workspaces; perform session-sensitive reset work on a dedicated connection.
- [x] Surface teardown failures; require explicitly identified disposable database targets for destructive test setup.
- [ ] Add bounded Node-test timeouts and explicit resource cleanup; reassess forced exit after resources close correctly.
- [x] Finish: API/database suites pass independently and through approved orchestration; reset/session state cannot leak. Confidence: high for risks; no cross-workspace failure was reproduced.
- Disposable-target guard: `resolveDatabaseUrl` already preferred `TEST_DATABASE_URL`, and `clearTestSeed`
  already required `NODE_ENV=test` (or `ALLOW_DB_WIPE=true`), but neither checked *which schema* the URL
  names — so `NODE_ENV=test` with a production URL would have wiped real data. Added
  `databaseNameFromUrl`, `isDisposableTestDatabaseUrl` and `assertDisposableTestDatabaseUrl` to
  `packages/database/src/env.ts`, requiring the schema name to contain `test`/`testing` as a whole
  segment. `clearTestSeed` and `resetApiTestDatabase` now call it first — the API helper needed its own call
  because 25+ of its deletes run *before* `clearTestSeed` is reached.
- Test-proof: `env.test.ts` covers both directions, and `test-seed-guard.test.ts` proves `clearTestSeed`
  rejects a `.../capella` URL and still performs a real wipe against `.../capella_test`.
- Concurrency: root `pnpm test` ran `turbo run test --concurrency=4`, so `@capella/api` and
  `@capella/database` could reset the same schema simultaneously. Added `test:db`
  (`--filter=@capella/database --filter=@capella/api --concurrency=1`) for the serialized DB path and
  `test:apps` for the remaining workspaces at concurrency 4. `test:db` verified end-to-end: 3/3 tasks
  successful, database 61/61 then API 1026/1026.
- FOREIGN_KEY_CHECKS: probed empirically whether the pooled `SET FOREIGN_KEY_CHECKS = 0` in
  `clearTestSeed` leaks. Ten consecutive `SELECT @@SESSION.FOREIGN_KEY_CHECKS` reads all returned 0, so in
  practice the pool serves these statements from one connection and the reset is consistent today. The
  finding is *not* a live bug, so no dedicated-connection change was made — the guarantee still rests on an
  unstated pool-size assumption and would break if the pool grew or the deletes were parallelized.
- Cleanup errors: reviewed the runners' teardown (`mysqlPool.end()`, `--test-force-exit`). Both database
  suites close the pool explicitly; `--test-force-exit` remains in both runners because the API suite holds
  long-lived server handles. Removing it was not attempted, so this item stays open.
- Verified: database 61/61, API 1026/1026 independently, and both through `pnpm run test:db`.
- Remaining for 4.4: bounded per-test timeouts instead of blanket `--test-force-exit`, and revalidating
  `FOREIGN_KEY_CHECKS` handling once the pool is exercised concurrently.

Phase exit (Phase 4): — MET with 4.4 partial. Full suites: database 61/61 and API 1026/1026 run both
  independently and sequentially through the new `pnpm run test:db`; database typecheck 0 and storefront
  typecheck 0. Slice totals: API 1,024 → 1,026, database 50 → 61.

## Phase 5 — Fill important behavioral gaps

Source changes are included only when the owner authorizes the relevant behavior-fix slice.
For every slice: reproduce a failing/missing behavior, implement the focused test/fix, then verify adjacent integration paths.
Estimated impact: 35–60 focused additional cases including newly measured ERP gaps, depending on parameterization.
Prioritize wishlist/auth session isolation, revalidation rejection paths, and staff mutations over cosmetic coverage gains.

### 5.1 Wishlist account isolation — high confidence

- [ ] File: apps/storefront/tests/components/wishlist-provider.test.tsx; source: corresponding provider.
- Current single case covers delete recovery; delayed customer-A requests can apply after logout/account switch.
- Add delayed reads and mutation-recovery races, logout, add failure, and repeated-toggle behavior.
- Finish: old account responses cannot repopulate/overwrite the current account's wishlist; optimistic recovery remains correct.

### 5.2 Revalidation boundary — high confidence

- [ ] File: apps/storefront/tests/unit/revalidate-route.test.ts; source: src/app/api/revalidate/route.ts.
- Six cases use valid requests; malformed JSON/null body currently throw instead of returning intended 400 responses.
- Add missing/wrong secret, malformed/null body, unsupported entity, missing required slug, and missing collection/discounts/shop-media branches.
- Finish: rejected requests perform no invalidation; every supported entity invalidates intended paths.

### 5.3 ERP mutation and loading states — high confidence

- [ ] staff-editor-form.test.tsx: add create/edit payloads, dependency/group selection, reset, catalog/save failure, and saving controls.
- Its current case checks only the Arabic Reviews label; API permission tests do not verify form interactions.
- [ ] paymob-reconciliation-page.test.tsx: add loading, denied, empty, failure, money formatting, and late-response cases.
- Source currently shows “no payments need review” while loading; distinguish loading from a completed empty response.
- Finish: real interactions/state transitions covered without over-mocking the component under test.

### 5.4 Mobile rendered behavior and resolver branches

- [ ] app-scaffold.test.js: “lists products…” currently checks only fetch invocation; assert visible returned products and loading/error states.
- [ ] metro-config.test.js: exercise an existing Expo default resolver; current mock always has an empty resolver.
- [ ] lang-provider.test.js: add initial storage failure and delayed-unmount hydration cases; verify intended startup behavior first.
- Finish: rendered output, resolver priority/fallback, and startup recovery are protected. Confidence: high except hydration expansion, medium.

### 5.5 Shared utility boundaries — high confidence

- [ ] Add canonical ordering tests for invalid ranks/dates, ties, and opposite ERP/storefront fallback orders.
- Preserve representative app-level ordering wiring tests.
- [ ] packages/database/tests/env.test.ts: add supported TEST_DATABASE_URL-only fallback outside test mode.
- Finish: owner-level boundary coverage and deterministic environment resolution.

### 5.6 Newly measured ERP auth and advice gaps — high confidence

- [ ] Source: apps/erp/src/components/providers/admin-auth.tsx; add focused real-provider tests instead of mocking the provider itself.
- Evidence: 0% line coverage. Read hydration, refresh, login/logout, storage, and invalidation integration before writing cases.
- Add valid/malformed saved sessions, refresh success/failure, login success/rejection, logout failure cleanup, and unsubscribe/unmount behavior.
- Add delayed bootstrap-refresh versus newer login/logout races; source currently guards only unmount, not newer session actions.
- Reproduce intended race behavior before any approved source fix; preserve synchronization with API-client token/user/hydration state.
- [ ] Source: apps/erp/src/components/forms/advice-form.tsx; add new/edit initialization, required title/video, save payload, navigation, and failure/retry tests.
- Evidence: 0% line coverage; existing advice list/API cases do not execute this form.
- Finish: auth state/storage cannot be restored by stale requests; advice validation and save/recovery are asserted through real UI actions.

## Phase 6 — Presentation policy, coverage, and optional organization

### 6.1 Review the 21 class-only cases

Do not bulk-delete CSS assertions. Separate ordinary styling choices from interaction/accessibility requirements.
Start by agreeing which presentation details are intentional contracts; finish with equivalent protection for retained requirements.

| File under its workspace tests/ | Class-only cases / treatment |
| --- | --- |
| ERP admin-list-header.test.tsx | Shared select class: cosmetic review |
| ERP entity-avatar.test.tsx | Wide modifier: appearance contract review |
| ERP orders-page.test.tsx | Status-chip styling: preserve meaningful status distinctions |
| Storefront components/advice-section.test.tsx | White arrows: consolidate at row owner, retain integration variant check |
| Storefront components/ask-capella-button.test.tsx | Corner offsets: review styling; add launcher interaction |
| Storefront components/entity-media-gallery.test.tsx | Touch scrolling and uncropped lightbox: browser protection before pruning |
| Storefront components/item-tags.test.tsx | Clickability: browser interaction protection |
| Storefront components/order-detail-view.test.tsx | Denied danger styling: preserve status meaning |
| Storefront components/related-items.test.tsx | Two column/breakpoint cases: browser layout checks |
| Storefront components/shop-mega-menu.test.tsx | Two hover cases: consolidate; instant closure: verify interaction |
| Storefront components/wishlist-button.test.tsx | Placement: appearance review |
| Storefront unit/header.test.tsx | Two scale-130 cases: cosmetic deletion candidates |
| Storefront unit/shop-card-row.test.tsx | Four scroll/visibility/color cases: add arrow behavior; review visual contracts |

Cosmetic deletion confidence is medium until intent is agreed; class strings alone do not establish real browser layout/interaction.

### 6.2 Coverage and browser layer

- [x] Coverage providers/scripts installed by the owner; all six direct workspace coverage commands passed.
- [ ] Persist explicit source inclusion/exclusions so ordinary coverage scripts reproduce the measured scopes above.
- Include mobile app/** for screen coverage; label Node loaded-source figures and review source-backed schema behavior separately.
- [ ] Validate the root coverage/build pipeline, then propose thresholds from the measured baseline and critical invariants.
- Re-measure after approved slices using the same scopes; report behavioral improvements as well as percentage changes.
- [ ] Confirm whether existing Playwright deletions were intentional before adding a small browser replacement.
- Focus browser cases on touch/swipe, focus, actual link clickability, responsive layout, and a critical customer flow.
- Finish: reproducible reports with stated denominators; browser checks protect agreed real-browser requirements.

### 6.3 Test typechecking and mobile layout

- [ ] Add dedicated test typechecks for API/shared/database; current projects omit their test files.
- Mobile's JavaScript tests are outside its TypeScript include scope; convert incrementally where useful.
- Preserve production build boundaries rather than emitting test code with application output.
- Optional: consolidate mobile roots after updating Jest discovery and preserving mock/transform behavior.
- Finish: discovery/case counts unchanged by organization alone; authorized checks green.

## Tests and protections to retain

- Both app health-route tests: identical text, separate implementations.
- Staff list/new/edit denial cases: separate protected page entry points.
- Desktop mega-menu and mobile drawer link tests: separate components.
- Real Metro resolver integration and helper cases: complementary layers, including .js fallback.
- Shared optional-peer packaging contract, storage-key compatibility, Expo references, and root-layout startup/font failures.
- media-optimization.test.tsx: real component-to-next/image wiring; it does not measure optimization performance.
- Shared schema, API endpoint, and storefront normalization contracts: complementary boundaries.
- Checkout service validation cases: not duplicates of the order/pricing service suite.
- Callback processing, checkout retry/status/evidence, shipping startup, and terminal policy already have integration scenarios.
- Mobile cart/wishlist/auth screens are not currently implemented; do not invent missing-screen test work.

## Owner decisions and handoff checklist

- [ ] Identify authorized phases/slices before execution.
- [ ] Decide whether source fixes in Phase 5 are included.
- [ ] Agree presentation contracts, legacy collection compatibility, browser coverage, and optional mobile reorganization.
- [ ] Confirm database isolation strategy and disposable targets before database validation.
- [ ] For each completed slice, record evidence, retained scenarios, count changes, validation, and remaining work.
- [ ] At completion, verify normal-order green plus shuffled isolation; run broad checks only as required by scope/AGENTS.md.
- [ ] Deliver final changes/results and unresolved decisions; do not commit without explicit one-time authorization.
