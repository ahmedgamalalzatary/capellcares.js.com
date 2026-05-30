# Phase 06 — CI, Reporting & Regression Backlog

> **Status:** CI = NOT STARTED (no `.github/`); regression = ONGOING.
> **Scope:** "Pipeline Ordering Decisions", "CI, Commands, And Reporting Coverage",
> "Regression Rule", "Responsibility Split", Implementation Order #3–5.
> **Depends on:** 01–05A, 05B (gates wrap the suites they run).

---

## Part A — CI & Reporting

### Goal
Gate PRs on the suites, run DB-backed tests after migrations, and keep local E2E distinct
from deployed staging smoke.

### Current state (2026-05-30)
- No CI config. `turbo.json` `test` depends on `^build` and passes through needed env
  (`TEST_DATABASE_URL`, JWT secrets, admin creds, revalidate secret, etc.).
- DB migration runs via **`packages/database` `pretest`** (`run-test-migrations.mjs`).
- No separate local Playwright config or CI lane exists yet; current Playwright covers staging smoke only.

### PR pipeline [T1]
- [ ] Workflow: install → lint/typecheck → build → API tests → DB tests → shared tests → storefront Vitest → ERP Vitest → local Playwright E2E.
- [ ] Test DB migration/setup runs **before** DB-backed API integration tests; DB suites don't race setup.
- [ ] Frontend Vitest may parallelize. PR checks require **no production secrets**.
- [ ] Root targeted scripts (Phase 01) are the entry points CI calls.
- [ ] Local Playwright runs against repo-owned services/test env only; no staging dependency in PR checks.

### Local E2E pipeline [T1]
- [ ] Separate PR-safe workflow/job for local Playwright with app boot orchestration and test DB setup.
- [ ] Artifacts include Playwright traces/screenshots/video for local E2E failures.

### Staging smoke pipeline [T1]
- [ ] Separate workflow with required staging env vars (deployed URLs + fixture creds).
- [ ] Runs minimal smoke **early** in release workflow; does not pass merely because core env vars are missing.

### Caching & artifacts [T2]
- [ ] Cache pnpm/Turbo safely; **never** cache generated Playwright auth state.
- [ ] Upload Playwright reports/traces/screenshots on failure.
- [ ] Logs expose enough to debug failed migrations, fixture setup, auth-state generation.

---

## Part B — Regression Backlog

### Goal
Turn every confirmed bug into a permanent test at the lowest reliable layer. This part uses
**strict TDD**: reproduce → fail → fix → keep.

### The rule (for every confirmed bug)
1. Reproduce. 2. Test at the **lowest reliable layer** (prefer API/DB/Vitest over Playwright).
3. Watch it **fail** for the right reason. 4. Fix. 5. Run targeted command; keep the test.

### User-provided history (master plan: "User provides" — agent cannot infer these)
| Date | Bug / incident | Layer | Test location | Status |
|------|----------------|-------|---------------|--------|
| 2026-05-30 | Offer items duplicated/lost on edit (fixed `dd81ce1`) | API + ERP | offer routes + offer form | back-fill |
| 2026-05-30 | Test seed cleanup not enforcing env checks (fixed `9004790`) | DB harness | clear-seed/database helper | back-fill |
| | _add previous bugs, business-only rules, operational constraints, real incidents_ | | | |

### Back-fill candidates from shipped fixes
- [x] `dd81ce1` — preserve offer item ids on edit; no duplication. **Already covered**: admin-offers
      "updates items in place when ids provided" + "merges duplicate variant rows". Regression net in place.
- [~] `39e4153` — db integrity + stable fixtures: FK cascade on hard-delete is covered (products test);
      pin any remaining integrity rule with a targeted regression test if a specific one was fixed.
- [~] `9004790` — seed cleanup env enforcement is covered (`clearTestSeed` throws unless NODE_ENV=test
      or ALLOW_DB_WIPE=true — verified in `test.seed.ts`); category deletion logic covered by
      admin-categories has-products / has-active-children tests.

### Expansion policy
Expand coverage **only** where escaped bugs or high-risk changes justify it — never to chase a percentage.

## Definition of done
CI: PRs gated with migrations ordered correctly, local Playwright separate from unit/integration layers,
and staging smoke separate + env-guarded + artifacts on failure.
Regression: ongoing — each confirmed bug has a failing-then-passing test before its fix is considered complete.
