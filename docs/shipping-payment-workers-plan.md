# Shipping and payment repairs, then worker extraction

Status: planned; implementation has not started. Investigation date: 2026-10-04.
Owner: update this tracker after each verified slice. Maximum document length: 400 lines.

## Objective and agreed order

Repair shipping/payment bugs and gaps first, prove the repaired flows, then extract them
into `apps/workers` with a separate Docker image. The API handles immediate customer
operations and durable intake; workers handle deferred provider calls and scheduled work.
Moving an existing defect to another container does not resolve it.

This document authorizes no deployment, provider mutation, or Git commit by itself.
Current task scope is investigation and planning; implementation is a subsequent task.

## Investigation report

Reviewed checkout and retry, stock reservation/expiry, payment callback intake/processing,
refund evidence, order creation, shipping quotes, dispatch, synchronization, cancellation,
edits/reconciliation, customer/ERP projections, startup/shutdown, schema and Docker wiring.
Read official Paymob pages and Bosta's documentation plus the OpenAPI file used by its UI.
No live merchant calls, production measurements, or application test runs were performed.
Performance impact is unmeasured; request-path waits and runtime ownership are code facts.

### Current flows

```text
Checkout -> server prices + validates shipping
  COD    -> atomically create order/decrement stock/enqueue delivery -> customer response
  Paymob -> reserve stock + create attempt -> intention API -> save IDs -> payment redirect
Paymob webhook -> HMAC -> durable inbox -> inline processing -> response
  success -> atomically create order/finalize stock/audit/enqueue delivery
  refund  -> authenticated inquiry -> apply verified refund/block delivery/cancel if needed
Bosta webhook -> authenticate/parse -> record + apply observation -> response
Shipping jobs -> create/reconcile, read/sync, or cancel/prove custody -> persist outcome
Linked edit -> carrier read -> save intent -> PUT -> confirming read -> request response
Expiry -> release eligible checkout holds; cancel untouched COD; flag untouched paid orders
```

All five existing runners start in `apps/api/src/server.ts`: Paymob callback recovery,
checkout/order expiry, shipping dispatch, shipping synchronization, shipping cancellation.
They share the API process and its database pool. There is no separate worker app/service.
These are asynchronous runners, not evidence that every network wait blocks Node's event loop.

### Findings and evidence

| ID | Classification | Finding / impact | Code evidence |
| --- | --- | --- | --- |
| G01 | Confirmed runtime gap | All five runners live in API; lifecycle and resources are coupled. | `apps/api/src/server.ts`, `docker-compose.yml` |
| G02 | Confirmed request delay | Paymob webhook awaits processing; refund callbacks can wait for token/authenticated inquiry calls. | `modules/payments/paymob/paymob-webhook.controller.ts`, `paymob-callback-processing.service.ts` |
| G03 | Confirmed request delay | Linked edits perform read/PUT/read; edit reconciliation reads inline; bulk repeats per order. | `modules/shipping/shipping-edit.repository.ts`, `shipping-action.repository.ts` |
| G04 | Confirmed cache gap | Each checkout runtime factory creates a new address service; its 30-second cache is not reused across requests. | `modules/shipping/checkout-shipping-runtime.ts`, `bosta/bosta-quote-composition.ts`, `bosta-address.service.ts` |
| G05 | Confirmed duplicate work | Paid checkout prices/resolves shipping in `submitCheckout`, then again in intention initiation. | `modules/checkout/checkout.service.ts`, `paymob-checkout.service.ts` |
| G06 | Confirmed recovery gap | Callback recovery retries received receipts; no inquiry job recovers a callback that never arrived. Expiry can release an unevidenced reservation. | `paymob-callback-worker.ts`, `paymob-callback-processing.service.ts`, `checkout-reservation.repository.ts` |
| G07 | Unverified provider contract | Public Bosta edit schema does not establish name/notes/size edits; configured edit/cancellation proof fields need merchant evidence. | `bosta/bosta-edit.service.ts`, `bosta-cancellation.service.ts`, `shipping-edit.repository.ts` |
| G08 | Application policy | Bosta allows edits in some post-pickup states; our pre-pickup restriction is intentionally stricter. Preserve it. | `modules/shipping/shipping-state.repository.ts`, Bosta `update-delivery` operation |
| G09 | Confirmed shutdown gap | Expiry runner ignores `isStopped`; it does not pass it to the order sweep, and reservation expiry lacks that stop seam. | `modules/checkout/checkout-expiry-worker.ts`, `checkout-reservation.repository.ts`, `modules/orders/order/write.ts` |
| G10 | Confirmed visibility gap | ERP reconciliation query exposes attempt problems, not callback inbox rows parked in `review_required`. | `modules/orders/admin-orders.routes.ts`, `paymob-callback.repository.ts` |

Module paths above are relative to `apps/api/src` unless already prefixed with `apps/`.
G07 is an evidence gap, not proof that Bosta rejects these fields or lacks those capabilities.
The shipping configuration checker validates declared settings; it does not verify merchant evidence.

### What the official docs establish

- Paymob intention creation returns the client secret needed to launch checkout [P1].
- Server transaction callbacks determine payment status; browser redirects must not settle orders [P2].
- The published HMAC list includes `is_refunded`, but excludes `refunded_amount_cents`
  and `is_live`. Preserve authenticated refund verification and local environment binding [P3].
- Inquiry uses an API-key-generated auth token and Bearer authentication [P4, P5].
- Callbacks are primary; inquiries are suitable for missed-callback fallback [P6].
- Bosta supports account-level webhooks/custom auth headers. Status webhooks are not sent
  on creation; creation response/reconciliation must establish the initial shipment [B1].
- Bosta documents create, read, update and terminate operations, and search by business reference [B2].
- Bosta public edit schema lists phone/address/COD/package-opening fields. Extra fields,
  size representation and proof paths require verified examples; do not infer them [B2].
- Bosta keys have separate read, write and DELETE permissions; cancellation needs the appropriate scope [B3].
- Neither reviewed callback guide establishes a response deadline, accepted acknowledgement
  status set, or retry guarantee. Do not label inline processing a documented protocol violation.
- Public docs do not establish the account-specific pricing, custody, printing, lookup-total
  and edit-availability contracts. Keep those capabilities gated until evidence exists.

## Target boundaries and design

```text
apps/api             HTTP/auth/validation, immediate checkout calls, durable work intake
packages/backend     shared checkout/payment/shipping rules, repositories, provider adapters
apps/workers         scheduling, job consumers, process lifecycle, health/metrics
packages/database    MySQL schema/client/migrations
packages/shared      DTOs/schemas/constants; no backend runner ownership
```

Use `packages/backend` as the planned shared package; expose explicit module exports.
Keep HTTP controllers, Express middleware, admin bootstrap and permission-catalog startup in API.
Move only the required backend dependency closure; do not refactor unrelated catalog/admin modules.
Neither app imports source from the other app. Both use the same domain rules and database.
Keep storefront and ERP accessing data through API only.

| Operation | Owner / behavior |
| --- | --- |
| Checkout prices, stock reservation, quote validation, Paymob intention/retry | API; customer needs the result immediately |
| Payment/shipping status reads, local manual state, unsent local edits | API; database operations |
| Webhook authentication/validation/durable receipt | API; acknowledge after commit |
| Paymob success/decline processing | Worker fast lane; prioritize customer confirmation |
| Refund inquiry and missed-callback inquiry | Worker; bounded separately from normal payment settlement |
| Shipment create/recovery/cancel/linked edit/manual reconciliation | Worker; durable intent and verified outcome |
| Carrier event application, periodic status reads, expiry | Worker; independent scheduling lanes |
| Address availability refresh | Reuse API cache initially; persisted worker refresh only with an agreed freshness policy |

Reuse MySQL work items/inboxes. Add only operation-specific state required for recovery.
No Redis, broker, generic job framework, or internal API-to-worker HTTP hop is required initially.
Start with one worker container, independent bounded lanes, and explicitly limited DB connections.
Do not put all work in one serial loop: a refund inquiry/carrier timeout must not starve payment settlement.
Multiple replicas are a later option only after claim/fencing and contention tests prove them safe.
Separate containers isolate processes, but still share host/database/provider capacity; limits matter.

### Invariants that every repair and extraction must preserve

- Save verified callbacks before acknowledgement; failed persistence must not report receipt success.
- Commit order/stock/payment/audit/job effects atomically where the current flow requires it.
- Unresolved received payment evidence blocks unsafe expiry, retry and dispatch.
- Authenticate inquiry results and correlate amount/currency/account/environment/integration/order/transaction.
- Preserve session-first financial locking and order-first shipping locking; evidence reads stay lock-free.
- Claim in short transactions, call providers outside locks, then recheck ownership and current eligibility.
- Expired claims require recovery; a timeout does not prove a mutation failed.
- Never blindly repeat uncertain creates, edits or cancellations; reconcile through verified reads.
- Cancellation acknowledgement alone is not proof of warehouse custody or permission to restock.
- Preserve independent payment, carrier, manual shipping and custody evidence, including historical barriers.
- Preserve strict pre-pickup edit policy, quote/amount agreement, COD limit and immutable paid totals.
- Keep existing recovery available when new shipment sending is disabled.
- Shipping callbacks arriving before linking remain replayable; late corrections reopen parked sync jobs.
- Secrets/customer/provider payloads stay out of public errors and routine operational logs.

## Phases and slice tracker

Check a slice only after implementation and its acceptance checks pass. Record evidence below.
Dependencies: Phase 1 repairs -> Phase 2 deferred flows -> Phase 3 extraction -> Phase 4 release.
Fix correctness first while runners still execute in API; extraction should change ownership only.

### Phase 0 — establish a focused baseline

- [ ] S00: Recheck working tree and instructions; preserve concurrent user changes.
- [ ] Record targeted API/shared/database/ERP/storefront lint, typecheck, build and relevant test results.
- [ ] Record current job counts/oldest due age and representative request/provider timings where available.
- [ ] Establish provider fixtures with source/date/account/environment metadata and redacted contents.

Acceptance: separate existing failures from new regressions; never claim unrun checks are green.
Use the existing sequential API test runner with explicit relevant files and a test database.
Do not run provider writes against production to establish a baseline.

### Phase 1 — repair correctness, contracts and avoidable work

- [ ] S01 / G07: Verify Bosta read/create/edit/cancel/search/pricing contracts against docs and
  redacted merchant evidence. Map supported fields and exact proof paths, units, sizes and timestamps.
  If evidence is unavailable, keep that capability disabled with a clear staff-facing reason.
  Update provider adapters, readiness checks, schemas, ERP capability controls and fixtures together.
  Acceptance: supported edits confirm from correlated reads; unsupported edits never reach Bosta;
  cancellation never restocks without proof. Retain G08 policy; do not expand post-pickup editing.

- [x] S02 / G06: Implement bounded missed-callback payment reconciliation before unsafe expiry.
  Discover due unresolved attempts; query by stored provider order ID/reference when no transaction ID
  exists. Verify the regional/account lookup contract rather than guessing the URL/response shape.
  Persist scheduling/claims/proven inquiry outcomes; apply through shared atomic settlement logic.
  An authenticated inquiry is a distinct trusted input, not a fabricated HMAC-signed callback.
  Coordinate expiry/retry/dispatch with reconciliation state under existing lock discipline.
  Unavailable/ambiguous inquiries go to bounded retries and visible review; stock policy must retain
  uncertain paid evidence without creating unlimited silent holds. Do not query every successful payment.
  Acceptance: missed success recovered once; decline/no-payment follows verified expiry rules;
  inquiry outage, late success, duplicate callback and expiry race do not oversell or double-settle.

- [x] S03 / G10: Expose received/failed/review-required callback and reconciliation problems in ERP.
  Include age, safe reason, checkout/payment references, and a guarded recovery action where appropriate.
  Preserve receipts/audits; staff cannot mark paid, erase a hold or resend an uncertain mutation blindly.
  Acceptance: exhausted refund/binding recovery is visible even without a reconciliation-required attempt;
  relevant permissions are enforced and provider secrets/payloads are not exposed.

- [x] S04 / G04-G05: Reuse checkout provider/address service instances with a configuration identity,
  expiry and concurrent-load deduplication. Never reuse snapshots across account/environment changes.
  Remove duplicate paid-checkout pricing/shipping resolution by sharing the validated checkout context.
  Keep authoritative pricing, free checkout, retries/idempotent reuse and final quote agreement intact.
  Acceptance: fewer redundant calls; cache refresh/account changes work; amount changes still require
  customer review. Live-rate-first/saved-outage-fallback policy remains unchanged.

- [x] S05 / G09: Wire stop signals through both expiry sweeps and check between records.
  Stop scheduling/claiming new work, drain active work, then close DB within a measured deadline.
  Acceptance: stop during backlog leaves remaining jobs recoverable; no pool use after closure.

Phase 1 exit: repaired core rules and supported contracts are green; unresolved provider capabilities
are explicitly disabled, documented and visible, never described as verified.

### Phase 2 — complete deferred flows before relocating them

- [ ] S06 / G02: Make Paymob route intake-only: validate HMAC/body, durably save/deduplicate, reply.
  Use a provider-compatible acknowledgement established by docs/account evidence; do not assume 202.
  Keep settlement fast and separate inquiry capacity; preserve receipt holds and atomic audits.
  Acceptance: response never awaits a Paymob inquiry; crash after intake is recovered; normal success
  still confirms promptly through the existing storefront status polling.

- [ ] S07 / G03: Turn linked edits into durable pending jobs and add an edit consumer.
  API authorizes/validates and queues; worker performs fresh carrier eligibility read, rechecks local
  state/actor eligibility under locks, saves a mutation-start marker, writes once, then confirms.
  Distinguish queued/preflight from mutation-started so crash recovery knows whether a write is safe.
  Include pending edits in all dispatch/cancellation/edit/expiry guards and customer/ERP projections.
  Manual edit reconciliation queues/deduplicates a read; bulk returns per-order queued/rejected outcomes.
  Update DTOs/API clients/ERP copy and refresh so "queued" never means "carrier applied".
  Acceptance: pickup/refund/cancel races block unsafe edits; crash around PUT reconciles without resend;
  duplicate submissions do not create concurrent edits; unsent local edits stay immediate.

- [ ] S08: Split Bosta webhook durable receipt from domain application and replay through workers.
  Preserve account/reference validation, semantic deduplication, event ordering and pre-link replay.
  Do not turn unrelated/unbound events into trusted shipment state; verify acknowledgement behavior.
  Recheck mutations against newly received relevant carrier evidence or defer for event application,
  so moving application out of the request does not widen cancellation/edit safety races.
  Acceptance: delayed/duplicate/conflicting callbacks, pre-link receipt and late parked-job correction
  preserve COD collection, custody and cancellation protections.

Phase 2 exit: all deferred provider mutation/reconciliation paths use recoverable durable work;
API requests report acceptance accurately; urgent checkout calls retain their immediate contract.

### Phase 3 — extract the proven flows

- [ ] S09: Create `packages/backend`; relocate the required domain/repository/provider closure.
  Fix every import/export/test integration; keep shared validation and schema ownership intact.
  Run repaired flows with existing API-hosted runners first to isolate relocation regressions.
  Acceptance: no app-to-app source imports, duplicated business rules, or HTTP/bootstrap dependencies.

- [ ] S10 / G01: Create `apps/workers` entry point and lifecycle; start existing and new consumers.
  Preserve independent scheduling, prioritize settlement, cap concurrency/provider traffic and DB pools.
  Use process-specific configuration validation; workers require no admin/JWT/bootstrap secrets.
  Remove runner startup from API at cutover; migration service remains the sole schema owner.
  Acceptance: API serves requests without runners; worker progresses jobs without public API requests;
  restarts/expired claims recover safely and provider-disable modes still permit intended recovery.

- [ ] S11: Add worker build/bundle/runtime scripts and `Dockerfile.workers`/Compose service.
  Reuse the proven slim bundling pattern and locked external dependencies; include worker in workspace
  build/test/typecheck tasks. Depend on completed migrations; set measured resources and stop grace.
  Inject only required secrets/config; shared provider account/settings must agree across processes.
  Add health reporting for process/DB/scheduler progress, plus backlog age, failures and review counts.
  Provider outage is a backlog condition, not grounds for endless restart loops.
  Acceptance: clean image boots, required settings fail clearly, health distinguishes idle from stalled,
  and shutdown completes within configured grace without leaving lost work.

Phase 3 exit: separate images/processes own HTTP and background work, using identical repaired rules.

### Phase 4 — prove isolation and release

- [ ] S12: Run focused checks first, then full workspace lint/typecheck/build/tests for this broad change.
  Cover two-process execution, duplicate claims, lease expiry, crash/restart, refund/expiry/dispatch races,
  callback-before-binding, delayed Bosta application, edit recovery and graceful shutdown.
  Compare request latency and DB/provider load with baseline under representative traffic.
- [ ] S13: Update `docs/docker.md`, folder architecture, env examples and operator recovery instructions.
  Document capabilities still awaiting merchant evidence and safe staff reconciliation actions.
- [ ] S14: Deploy compatible schema/code together with one active scheduler owner at cutover.
  Preserve pending rows/snapshots; drain old API runners before new workers claim. Avoid mixed old/new
  consumers of changed operations/contracts; temporary ownership switches must be explicit.
  Verify payment confirmation, dispatch/cancellation/edit outcomes, health and oldest-job age.
- [ ] S15: Exercise rollback: stop/drain worker, preserve durable work and restore one compatible owner.
  An intake-only API cannot recover background work by itself; rollback must restore a worker or a
  compatible API-runner release. Never delete jobs or roll back schema blindly to clear a backlog.

## Validation evidence and completion

| Slice | Status | Checks / evidence | Remaining issue |
| --- | --- | --- | --- |
| Investigation | Complete | Repository read + official docs; no live calls/tests | Merchant-specific contracts unverified |
| S00 | Not started | Baseline results not yet recorded | See phase acceptance gates |
| S01 / G07 | Not started | Needs merchant evidence for Bosta edit/cancel/pricing contracts | Capability stays gated meanwhile |
| S02 / G06 | Complete | TDD: documented by-order inquiry (POST /api/ecommerce/orders/transaction_inquiry), a bounded reconciliation sweep with durable scheduling/claim/retry/park on the attempt, settlement via the shared atomic processor, and an expiry hold that defers unproven open attempts only while inquiry is enabled. Recovery/outage/no-payment/mismatch/park/concurrency + expiry-hold tests green; API + database typecheck green | No-transaction ⇒ releasable inferred from docs; region/account match still warrants a readiness check |
| S03 / G10 | Complete | TDD: reconciliation returns parked `review_required` callbacks (safe fields only) plus a permission-gated requeue; ERP renders both and can requeue. API route tests + ERP page tests green; API/ERP typecheck green | — |
| S04 / G04-G05 | Complete | TDD: shipping runtime memoized by config+fetch identity with 30s TTL; validated priced/shipping context threaded from `submitCheckout` into `initiatePaymobCheckout`. Runtime/reuse/expiry + context tests, plus checkout/shipping regression suites green; API typecheck green | Live-call reduction not yet measured |
| S05 / G09 | Complete | TDD: stop seam added to reservation expiry and forwarded by the checkout expiry worker. Stop/backlog tests + expiry/reservation/interval suites green; API typecheck green | — |
| S06-S15 | Not started | Record results per slice as implemented | See phase acceptance gates |

Done means: confirmed gaps repaired, unverified capabilities gated, immediate checkout intact,
durable deferred flows working, worker isolated/observable, and restart/rollback paths verified.
No production latency claim is complete without measurements; no merchant contract is verified
solely because an environment JSON says `verified: true`.

## Official references (reviewed 2026-10-04)

[P1]: https://developers.paymob.com/paymob-docs/intention-apis/create-intention
[P2]: https://developers.paymob.com/paymob-docs/manage-callback/transaction-callbacks
[P3]: https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback
[P4]: https://developers.paymob.com/paymob-docs/developers/authentication-request-generate-auth-token-1
[P5]: https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id
[P6]: https://developers.paymob.com/paymob-docs/payments-and-features/core-features/transaction-inquiry-and-reports
[B1]: https://docs.bosta.co/docs/how-to/get-delivery-status-via-webhook/
[B2]: https://docs.bosta.co/api/api.yaml
[B3]: https://docs.bosta.co/docs/how-to/get-your-api-key/
