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

### 1.1 ERP mock history

- [ ] File: apps/erp/tests/product-edit-page.test.tsx.
- Evidence: “shows a 403 state without subscribing…” inherits apiGet calls; seed 42 fails at line 122.
- Start: reproduce the failure; inspect all five cases and their queued mock responses.
- Do: reset call history, queued responses, auth defaults, and captured props before each case.
- Finish: entire file passes normal and shuffled order; forbidden cases still prove no requests/subscriptions.

### 1.2 ERP DOM teardown

- [ ] Files: apps/erp/tests/setup.ts, categories-page.test.tsx, bundle-form-item-reorder.test.tsx.
- Evidence: root category reorder finds duplicate category-row-1; offer YouTube editing encounters duplicate label/input associations.
- Start: inspect cleanup registration; setup currently imports only jest-dom matchers.
- Do: explicitly unmount React renders after each case; isolate form-save mocks.
- Finish: both affected files and the full ERP suite pass normal and seed-42 order, without duplicate DOM/IDs.

### 1.3 ERP store listeners and completion

- [ ] File: apps/erp/tests/store.test.ts; source: apps/erp/src/lib/store/core.ts.
- Evidence: focus-refetch case expects 18 calls but receives 36 after shuffle.
- Why: resetting modules leaves previously registered focus/visibility listeners attached; flush uses setTimeout(0).
- Start: trace store creation, browser listeners, auth subscriptions, and all teardown paths.
- Do: remove test-owned listeners/subscriptions between cases; wait for observable completion.
- Replace broad totals 18/9 with relevant endpoint calls and state assertions, retaining duplicate-fetch protection.
- Finish: all ten cases pass both orders; one focus event triggers only the current store's intended requests.

### 1.4 Storefront environment/global restoration

- [ ] File: apps/storefront/tests/contracts/storefront-client.contract.test.ts.
- Evidence: product/category cases receive production upload URLs after the Docker/public-origin case.
- Start: inspect static imports, module resets, stubEnv, stubGlobal, and API-base evaluation.
- Do: establish explicit environment defaults; restore globals/environment and reload modules consistently.
- Finish: all nine cases pass both orders, preserving internal fetch host versus public media host behavior.

### 1.5 Storefront matchMedia restoration

- [ ] File: apps/storefront/tests/components/ask-capella-overlay.test.tsx; shared tests/setup.ts.
- Evidence: four focus/conversation cases throw on undefined .matches after the touch-device case.
- Why: restoring the existing matchMedia mock leaves it without an implementation.
- Do: supply a fresh, complete media-query implementation per case and restore prototype mutations.
- Finish: all five cases pass both orders; desktop focus and touch-device behavior remain distinct.

### 1.6 Storefront browser history

- [ ] File: apps/storefront/tests/components/paymob-result.test.tsx.
- Evidence: locale-neutral redirect unexpectedly retains checkoutId from another case.
- Do: reset URL/history alongside storage, timers, and mocks before each case.
- Finish: all twelve cases pass both orders; reference-preserving and reference-free redirects remain covered.

Phase exit: ERP 267/267 and storefront 576/576 pass normal order and seed 42 before pruning starts.

## Phase 2 — Remove clear redundancies and normalize paths

Confidence: high from source/assertion comparison; database-dependent deletion still requires execution evidence.
Expected impact: six fewer cases; naming changes do not alter discovery or behavior.

### 2.1 Redundant cases

- [ ] ERP product-edit-page.test.tsx: delete weaker “shows a 403 state for staff without products.update”; retain stronger no-fetch/no-subscription case. Reduction: 1.
- [ ] Mobile __tests__/app-scaffold.test.js: delete two “provides app/%s” existence cases; real home/layout imports already detect missing files. Reduction: 2.
- [ ] Mobile __tests__/metro-config.test.js: delete “exists…” and “provides a custom resolver…”; retain rewrite, fallback, and outside-shared behavior. Reduction: 2.
- [ ] API tests/units/receipt-hold-policy.test.ts: delete “the SQL and application forms agree on every documented outcome.” Reduction: 1.
- That policy case computes a local JavaScript expression rather than calling SQL; the preceding real-MySQL test covers the same inputs plus malformed values.
- Start: verify stronger cases still exist and pass, especially the actual SQL predicate case.
- Finish: retained assertions/scenarios documented; touched suites green; no new coverage gap.

### 2.2 Naming

- [ ] Move apps/api/tests/units/receipt-hold-policy.test.ts into tests/unit/.
- [ ] Rename apps/api/tests/routes/order-payment-status.route.test.ts to .routes.test.ts.
- Start: search references and runner discovery before moving/renaming.
- Finish: imports/references resolve, all original cases run, empty units/ directory removed if applicable.

## Phase 3 — Consolidate checks at their owner

Expected impact: approximately twelve fewer cases and two fewer files, preserving unique inputs/assertions.
Confidence: high; exact i18n wording remains an owner decision.

### 3.1 Shared packaging boundary

- [ ] Compare mobile __tests__/shared-boundary.test.js with packages/shared/tests/optional-ui-peers.test.ts.
- Both inspect the same manifest; shared additionally protects zod as a hard dependency.
- Do: retain canonical shared checks; remove the six mobile metadata copies.
- Finish: shared test runs in normal workspace orchestration; mobile import/Metro checks remain. Reduction: 6.

### 3.2 Shared API-base behavior

- [ ] Merge apps/erp/tests/api-base.test.ts and apps/storefront/tests/unit/api-base.test.ts into shared tests.
- Do: preserve six unique scenarios: server internal URL, explicit browser public URL, localhost, ERP host, storefront host, and www host.
- Only the first two cases overlap; domain variants are not interchangeable.
- Finish: shared runner supports controlled browser globals and restores them; app client integration cases remain. Reduction: 2.

### 3.3 Mobile theme, storage, and configuration

- [ ] Consolidate __tests__/foundation.test.js, tests/theme.test.ts, and tests/storage-keys.test.ts.
- Do: use canonical palette, radii/spacing, and font tests; preserve all four storage keys, including refresh token.
- Keep the Expo declaration/tsconfig reference check in a clearly named configuration test.
- Foundation is not fully covered by current replacements; never delete its unique checks first.
- Finish: complete assertion mapping and green mobile suite. Estimated reduction: 3.

### 3.4 i18n placeholder redundancy

- [ ] packages/shared/tests/i18n.filter-labels.test.ts: remove weaker “label is a template…” if exact-string checks remain.
- Exact expected strings already require {name} in both languages.
- If wording is flexible, retain a placeholder contract instead and review literal wording locks with the owner.
- Finish: requested-language interpolation stays protected. Reduction: 1 under the exact-wording option.

Phases 2–3 estimate: 18 fewer cases, from 2,049 to about 2,031 before additions; this is not a deletion quota.

## Phase 4 — Strengthen fixtures, assertions, and runners

### 4.1 Current versus legacy collection fixtures

- [ ] Inspect packages/database/src/seeds/test.seed.ts and API tests/modules/admin/admin-detail.repository.test.ts.
- Evidence: normal collection fixtures use child categories, bypassing current root-category write validation.
- Do: make canonical fixtures valid; retain child-category examples only as explicitly named compatibility cases if needed.
- Also replace Array.isArray-only hydration assertions with expected variant/item identities and values.
- Finish: affected repository/routes/checkout cases pass against realistic fixtures. Confidence: high.

### 4.2 Deterministic configuration and precise rejection assertions

- [ ] Storefront tests/unit/next-config.test.ts: replace dependency on untracked root .env with controlled fixtures/environment.
- Preserve development and production image restrictions; verify behavior from a clean checkout configuration.
- [ ] Database tests/integrity.test.ts and shipping-schema.test.ts: assert intended FK/unique/check errors, not any rejection.
- [ ] Review API bare assert.rejects similarly, preserving positive controls and post-failure state assertions.
- Finish: unrelated connectivity/query errors cannot masquerade as expected validation failures. Confidence: high.

### 4.3 Behavior rather than source text or misleading names

- [ ] Database tests/test-seed-source.test.ts: replace whole-file transaction regexes with an actual rollback test.
- [ ] API tests/unit/rate-limit.test.ts: “is O(1)” currently proves entry retention, not absence of scanning; detect iteration or rename accurately.
- [ ] API tests/services/interval-worker.test.ts: verify original reported error and report count, with bounded waiting.
- [ ] Database shipping-schema.test.ts: “orders store immutable shipping quote snapshots” verifies persistence, not immutability; rename or add the actual invariant.
- Finish: each title matches its demonstrated behavior. Confidence: high.

### 4.4 Database and resource isolation

- [ ] Inspect root Turbo orchestration, both test runners, resetApiTestDatabase, clearTestSeed, and cleanup hooks.
- Findings: concurrent workspaces can reset shared tables; pooled FOREIGN_KEY_CHECKS changes are connection-local; cleanup errors are swallowed.
- Do: isolate test databases or serialize database-backed workspaces; perform session-sensitive reset work on a dedicated connection.
- Surface teardown failures; require explicitly identified disposable database targets for destructive test setup.
- Add bounded Node-test timeouts and explicit resource cleanup; reassess forced exit after resources close correctly.
- Finish: API/database suites pass independently and through approved orchestration; reset/session state cannot leak. Confidence: high for risks; no cross-workspace failure was reproduced.

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
