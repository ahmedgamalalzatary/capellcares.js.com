# Payment/shipping review and dedicated worker migration

Fresh review: **2026-10-02**, baseline `2d3d184`. This replaces the previous plan. Completed tasks, stale descriptions and historical execution diaries are removed. This task changes documentation only; the fixes/migration below remain outstanding.

**Recommended target:** dedicated `apps/worker` with its own command, Dockerfile, image, runtime, health and tests; shared business code in `packages/backend`; existing MySQL data. Two matched images built from one revision prevent API/worker code drift. A second database or duplicate payment/order data would add inconsistency without helping this migration.

## 1. Review evidence

Traced API checkout/pricing/reservations, all Paymob modules, all shipping/Bosta adapters/repositories/runners/routes, order write/read/expiry/refund/custody interactions, storefront initiation/return/result, ERP reconciliation/shipping actions/projections, shared schemas/DTOs, mobile checkout typing, database migrations through `0062`, API runtime/shutdown/build and Docker/Compose. Re-read existing shipping requirements/release records. Official public documentation was fetched again; Bosta OpenAPI was downloaded directly because the research browser could not read its YAML.

| Current check | Result |
| --- | --- |
| API payment/HMAC/config/client/parser/inbox/recovery/reservations | 41 passed |
| API Bosta normalizer/delivery/sync/cancel/edit + Paymob webhook routes | 81 passed |
| API checkout/payment-shipping/dispatch/expiry/reconciliation | 112 passed |
| Storefront browser session/checkout/shipping/payment result | 32 passed |
| ERP reconciliation/shipping overview | 16 passed |
| API typecheck | Passed; API lint uses the same TypeScript check |
| Pure probes | Nested documented `_id` identity lost; invalid Paymob mode becomes test; cancelled parcel cannot park without delivery proof |

**282 focused tests passed** (234 API + 48 UI). No full suite, production build, container smoke or merchant lifecycle is claimed. No authenticated merchant verification, provider mutation, deployment or activation was performed. Passing fixtures do not close the newly found gaps.

## 2. Current flows

### Payment

```text
Buyer -> server products + shipping pricing -> session/reservation/attempt commit
      -> synchronous intention HTTP -> save provider IDs -> hosted checkout
Paymob -> HMAC + typed callback -> durable inbox receipt
       -> inline leased processor now + scheduled recovery in API
       -> refund inquiry outside locks when required
       -> order/stock/shipping intent + audit + inbox complete atomically
Browser return -> server status polling -> confirmed order -> clear cart
```

Amounts include shipping; completely free checkout uses free-order behavior. Initiation commits local state before HTTP, distinguishes definite rejection/throttle/uncertainty, and retains the original hold/deadline across up to three attempts. Idempotent ambiguous-initiation replay can create another intention through the retry service; this does not prove the first intention never existed. Preserve old attempts and second-capture review; no scheduled intention retries.

Binding uses signed `order.id`; unsigned merchant-reference fallback is removed. Released-stock payment goes to review. Refund totals require authenticated inquiry, remain monotonic, support refund-before-success and use safe shipping cancellation/custody independently. Nonshipping refund synchronization does not itself restock.

Actual inbox states: `received/processing/processed/rejected/failed/review_required`; UUID/two-minute lease, retry capped at 60 seconds, verification review after eight attempts, unresolved binding review after 15 minutes. Current webhook still processes inline, may answer 200/202, uses general 10 MB/inflating JSON parsing and generic 500 on receipt failure. Customer status blocks unsafe retry but lacks queue state; ERP reads attempt flags rather than inbox jobs.

### Shipping

```text
Supported address -> server quote -> checkout revalidation/frozen money/address
COD / verified paid order -> durable create intent
Dispatch -> locked eligibility -> frozen request -> POST -> save result -> link
         -> uncertain outcome: search/read only, never blind resend
Authenticated callback / scheduled read -> persist/apply carrier observation
Cancel -> intent -> proof -> marked DELETE -> confirmation/custody -> restock once
Edit -> actor/pre-pickup proof -> durable PUT -> confirmation/read-only recovery
```

Quotes bind account/environment/contract/destination/size/COD and use matching saved rate only on classified recoverable outage. Shipping-inclusive COD converges by bounded iteration; EGP 30,000 ceiling/address checks precede payment/stock writes; prepaid COD is zero.

Bosta auth precedes dedicated 48 KB parsing; current state applies inline. Early locally correlated events replay after linking. Unrelated callbacks are ignored, which does not mean persisted. Carrier/manual/payment/custody remain separate; COD paid requires confirmed delivered matching collection. Historical printing/pickup/collection barriers persist. Returns/loss/manual/cancellation never independently prove refund or sellable stock.

Linked edit stays synchronous; uncertain PUT recovers without repeat PUT and blocks another edit/direct cancel. Sync has persisted active/24-hour-follow-up/park phases. Related displays/binding table exist, but actual related discovery/linkage and binding-backed sync do not.

**Runtime today:** API starts/drains five loops: Paymob callback, checkout/order expiry, dispatch, sync, cancellation. `apps/worker`, `packages/backend` and Compose worker are absent.

## 3. Open findings and required remedies

Paths below are relative to `apps/api/src` unless noted. These are remaining work, not completed fixes.

| ID / priority | Fresh finding and evidence | Remaining remedy |
| --- | --- | --- |
| F01 high | `bosta-delivery-read.ts` reads nested city/zone `id`, but current business-read example uses `_id`. Probe loses constraints and becomes ambiguous; fixtures labelled documented use `id`. | Support documented `_id`/compatible `id`, reject alias/flat conflicts, resolve names only under proven authoritative city/zone. Test actual shape through recovery/edit; mismatch never permits resend. |
| F02 medium | Delivery `parseResult` requires string tracking and runs before shared numeric/string normalizer during recovery. | Normalize bounded safe tracking consistently through create/read/recovery; integrated numeric cases. Public webhook sample/table disagree on number/string; do not claim merchant form verified. |
| F03 high | Transaction service still bases environment acceptance on unsigned `is_live`; fingerprint also includes it. HMAC field list excludes it. | Derive account/environment from local attempt/verified integration, callback flag only hint; inquiry environment when used. Test unsigned tamper on success/refund/hold/audit. Preserve exact HMAC; do not guess `owner` equals merchant profile. |
| F04 high | Inquiry result omits order/integration/account/environment/action identity, so claim processor cannot verify them. Cached token survives 401 and repeated failures can exhaust review retries. | Bounded authenticated identity/action snapshot checked against signed callback and locked attempt; persist minimal verification. Refresh auth once after 401; bounded reads, no mutation retry. Verify token/account semantics externally. |
| F05 high | Evidence query and expiry discovery treat every unresolved callback as financial hold, including pending/decline/unsupported actions. No receipt/deadline classification. | One typed policy across receipt/expiry/retry including idempotent-throttle-ambiguous paths/third decline/status/dispatch. Protect actionable success/refund; pending/decline alone cannot hold indefinitely. Keep shipping guard lock-free; test original receipt/deadline/binding races. |
| F06 prerequisite | Inbox lacks scalar indexed order/integration/account identity, local session/attempt binding and verified inquiry snapshot; JSON identity matching scans; second-precision receipt. Transaction ID is signed despite hint comment. | Additive indexed identity/proven nullable binding/precise receipt/bounded evidence; old payload/fingerprint/status compatibility, provable backfill and no unresolved-history cascade deletion. Query-plan/backlog/timezone/upgrade tests. |
| F07 prerequisite | Paymob intake uses generic broad parser and inline provider/business processing; missing dedicated unavailable/storage failure contract. | Dedicated pre-generic-parser 256 KB, inflate false, raw-value HMAC before normalize; durable receipt then 200, no effects/HTTP. Static 503 unavailable/storage, 401 signature, 400/413/415/422 body; token envelopes never payments. Preserve Bosta parser order. |
| F08 high | No queue status/no-store, UI only latest-attempt review, ERP omits inbox/unbound jobs and keys multiple attempts by checkout ID; no audited requeue. | Shared sibling-aware processing projection, bilingual messages, support reference/cart until confirmed order; paginated backlog/review/unbound age/reasons/safe IDs; unique event/attempt keys and permission-checked audited processing-only requeue. |
| F09 high operational | `orders/order/write.ts` 96-hour expiry discovers all eligible orders and handles them in one transaction; reservation bound of 50 does not bound it. Expiry lacks stop-between-records and logs raw errors. | Bounded unlocked discovery + per-order locked recheck/transaction + stop checks. Preserve deadlines/preparation/address/COD-safe-stock/informational-paid rules. Contention/backlog/drain tests and static logs. |
| F10 medium | Parking demands delivery confirmation/collection for every terminal code including cancellation/loss/archive. Sync lacks queued-refund check before parking. | State-specific positive contract/custody resolution; retain COD delivered proof and unresolved money/edit/cancel/custody reads. Queued refund barrier; unverified states explicitly active. Follow-up/stale/reopen/history tests. |
| F11 incomplete | Binding swallows all duplicate keys without comparing identity; observations insert bindings, no outgoing backfill/enrichment. Related sync still requires create intent; no related contract/discovery consumer. | Identical no-op vs conflict review, outgoing proof/enrichment/provable backfill, gated original-child parser/linker and binding-backed sync/replay. No customer-only match/fake create/unrelated import; actual relationship evidence required. |
| F12 prerequisite | Paymob mode/confirmation typos silently test/disable; worker inquiry uses initiation loader requiring Secret/Public/HMAC; API key optional. Bosta host rejection happens during binding, long HTTP timers may exceed leases. | Strict role config/readiness/verified identity/host/timeout budgets. Worker has no unused initiation/admin/JWT secrets; API still quotes/edits. Preserve disabled/recovery modes and real env values. |
| F13 integration | Missing Docker-guide Paymob link; stale API-worker/migration guidance; mobile checkout type lacks kind union; ERP local-cancel filter requires null carrier state; broad Bosta persisted bodies retain customer data. | Update operational docs at migration, affected typing/callers (no new mobile UI), independent outgoing local-cancel filter regression, replay allowlists/size bounds preserving contract/custody evidence. |

Evidence policy must preserve valid payment against still-held stock; released stock always requires review. Do not silently introduce a new late-payment fulfillment policy. Duplicate/requeue cannot reset original receipt times. Do not weaken custody or COD collection to make parking possible.

## 4. Execution ownership

```text
API image (capella-api:<release>)       Worker image (capella-worker:<release>)
checkout/intention/receipt/HTTP         effects/inquiry/expiry/dispatch/sync/cancel
             -> packages/backend -> existing MySQL <-
```

| Operation | Owner |
| --- | --- |
| Pricing, quotes/revalidation, COD/free checkout, reservation, intention/retry, redirect/methods/status | API |
| Paymob signature/envelope and durable receipt | API |
| Payment/refund effects, atomic audit/inbox, inquiry/recovery | Worker |
| Reservation and fixed 96-hour order expiry | Worker |
| Bosta POST/uncertainty search/saved-response linking, reads/replay/cancellation recovery | Worker |
| Bosta callback auth/persist/current-state apply | API inline; immediate custody protection |
| Actor/ownership/eligibility/cancellation intent and safe definitely-unsent cancellation | API through shared transactional services |
| Manual state/flags/packing correction; linked-edit preflight/PUT/immediate confirmation | API |
| Linked-edit uncertain read recovery and verified related linking | Worker |
| Customer/ERP reads and authorized processing requeue | API |
| Clients/config/parsers/persistence/money/stock/custody rules | Shared backend; sharing does not authorize different execution |
| Pickup/return/exchange creation, inspection, refund initiation | Existing dashboards/inventory procedures |

Keep existing public checkout/shipping/status/retry/methods/provider callback and ERP/customer URLs stable. No new payment microservice, worker public API, Redis/broker or second DB. Data remains in `packages/database`; each process owns one pool and both fit the MySQL budget.

## 5. Exact extraction/build map

```text
apps/api/src/server.ts                HTTP/bootstrap; zero recurring loops
apps/api/src/modules/                 routes/controllers/HTTP adapters
apps/api/src/services/shutdown.ts      HTTP drain
apps/api/src/scripts/check-shipping.ts existing redacted CLI
apps/worker/package.json              @capella/worker
apps/worker/tsconfig.json
apps/worker/esbuild.config.mjs
apps/worker/src/server.ts             environment-first, no Express/admin boot
apps/worker/src/workers/              five existing runners
apps/worker/src/runtime/              interval-worker/runtime/health
apps/worker/src/scripts/check-worker.ts
packages/backend/package.json        @capella/backend explicit server exports
packages/backend/src/config/
packages/backend/src/modules/        checkout/orders/paymob/shipping closure
packages/backend/src/types/
Dockerfile.api                       API-only runtime
Dockerfile.worker                    dedicated worker runtime
```

Move existing checkout-expiry, paymob-callback, shipping-dispatch, shipping-sync and shipping-cancellation runners from API module paths to worker `src/workers`; interval scheduling from API services to worker runtime. Preserve one-sweep functions/DI/tests.

Move complete shared closure: callback receipt/repository/processing/transaction/inquiry; checkout evidence/reservations; order pricing/write/shared helpers; shipping services/repositories/adapters, necessary catalog/bundle discounts/domain/DB-error/actor-grant eligibility helpers. Split HTTP coupling; preserve service-level authorization rechecks. No duplicate repository or app-source imports.

- Dependency: API/worker -> backend -> database/shared; no app-to-app/backend-to-app/browser-to-backend transitive path. Automated imports/dynamic imports/re-export/alias/manifest boundary check.
- Explicit source exports and consistent NodeNext compiler roots/references; no eager barrel or disabled checks. Imports start no timers/listeners/bootstrap/DB mutation.
- Environment before DB/config import, reliable explicit local workspace path and injected-env precedence; one pool/process, dedicated test DB guards.
- Backend service/provider/repository tests, worker runner/runtime/health tests, API HTTP/auth tests; test-only fixtures excluded from runtime; DB-reset suites sequential across packages.
- Worker dev/build/bundle/lint/typecheck/test/start; backend build/lint/typecheck/test. Verify normal build and bundle, align start to emitted artifact.
- Workspace globs already cover apps/packages. Update manifests/lock/Turbo/root build/dev/test selectors; include worker for local backend jobs and safe sequential integration tests (root test currently allows concurrent DB users).
- API bundle: server/check-shipping; worker: own server/check-worker `.mjs`; backend inlined, mysql2 external with ESM compatibility. Worker runtime no API routes/bootstrap/uploads.
- Both Dockerfiles matched lock/revision/necessary workspace closure; preserve API builder migration target; consistent minimal external runtime dependencies.

## 6. Runtime/operational contract

Independent nonoverlapping loops: payment every 2 seconds, shipping 30 seconds, expiry minute; initial ten jobs/payment-shipping sweep, one in flight per loop/two-minute leases. Start one worker but prove two-instance/restart safety. Bosta latency cannot block payment admission; no HTTP under financial locks/unbounded batch.

Financial paths serialize session then needed attempt/reservation/order/inbox; shipping order before parcel/work; shared evidence reads acquire no financial locks from shipping. Explicit lock map and real MySQL contention tests.

SIGTERM/SIGINT stops new claims, checks between records, drains bounded work then closes pool. Worker 60-second Compose grace/55-second application deadline; API retains HTTP drain budget. Forced exit preserves leases/uncertain mutation markers.

Internal health port 4001 without host publication, three-second probe; completed-sweep timestamps even idle, DB/loop age/in-flight allowance/shutdown. Provider backoff means degraded jobs, not necessarily dead process. Staff queue metrics: oldest due age/counts/static reasons; warn above 60 seconds due age. API health proves no worker progress. Redacted structured bounded logs.

Dedicated worker service/image/Dockerfile, init/restart, healthy DB/successful migration dependencies, explicit resource/pool budget, no uploads/admin/JWT secrets. Measure memory; 256 MB is provisional. API retains existing port/uploads/project volumes. Image tags identify one release revision; worker neither depends on API health nor runs migrations.

API role gets initiation/HMAC/quotes/edits; worker inquiry/Bosta execution/reads; shared verified identities/contracts, no unused initiation credentials in worker. Do not fabricate provider account fields or modify real env/gates.

## 7. Ordered remaining implementation

All checkboxes are outstanding. Remove completed tasks after implementation and keep only concise current verification.

- [ ] **M01 Provider trust:** F01/F02 actual-shape recovery/edit regressions; F03/F04 authenticated identity/environment/token refresh/tamper tests; F12 strict role readiness/timeouts. Focused green/lint/typecheck/build before extraction.
- [ ] **M02 Evidence/recovery:** F05/F06 unified typed hold + indexed additive schema/old versions/provable backfill; preserve atomic effects/audit/inbox/live claim; F09 bounded expiry/stop. Real contention/crash/deadline/retry/decline/dispatch/backlog tests, F08 requeue groundwork.
- [ ] **M03 Extract:** backend and worker manifests/exports/compiler/build/tests/closure/five runners; independent runtime/health/drain; API zero loops/worker no HTTP/admin boot. Every import/selector/env/pool updated and boundary checks. Existing recovery stays until replacement consumer works.
- [ ] **M04 Async HTTP/UI:** F07 intake-only parser/receipt contract, worker-stopped persistence/no pre-sweep effects tests; F08 sibling status/no-store/bilingual result/paginated ERP queue-review-unbound/stable keys/audited scheduling-only requeue; F13 typing/filter. Preserve cart/auth/ownership/URLs.
- [ ] **M05 Shipping:** F10 state-specific terminal/refund barrier and current-state/follow-up/reopen; F11 conflict/proof/enrichment/backfill/gated related sync. Disabled behavior independently complete; E04 unresolved means no live linkage. No invented create/refund/restock; bounded replay evidence.
- [ ] **M06 Images/runtime:** Dockerfile.worker/Compose role env/probe/resources; adapt API/migration build. Quiet Compose validation, matched images/bundles/runtime dependencies; controlled local API-only/worker-only/combined smoke without provider writes, idle/DB/stuck/outage/drain/restart health and payment during Bosta timeout.
- [ ] **M07 Acceptance/docs:** README/folder/build/Docker/Bosta operational/env/local command updates and missing link. Focused first then final multi-area full workspace tests/lint/typecheck/build sequentially including bundles. Existing-row migration/backfill/journal/snapshot/reset-order verification; diff/import/secret review. Report code vs external readiness separately; no commit/deploy/activation implied.

## 8. Required acceptance evidence

| Boundary | Evidence |
| --- | --- |
| Bosta contract | Actual nested aliases/conflicts/type/tracking/ambiguous zoning/unique complete lookup/wrong identity-money-package; never resend on mismatch |
| Payment trust | Exact HMAC, unsigned tamper cannot steer money/binding/acceptance/holds; full authenticated inquiry identity/action/refund and token recovery |
| Intake | Bounded parser codes, acknowledgment after commit, storage non-2xx, duplicate original times/claims, no inline effects/HTTP |
| Financial concurrency | Real locks, early binding/expiry/retry/decline/dispatch/stale lease, final-inbox failure rolls back order/audit/stock, backlog cannot hide evidence |
| Ordering | One canonical fulfillment, early/growing/stale refund, original replay, distinct sibling/second capture, released-stock late money review |
| Shipping/custody | Saved result/restart, uncertain POST/PUT/DELETE no repeat, late create/refund, historical barriers, restock once |
| Scheduling/linking | Bounded expiry/independent progress/parking/corrections/refund barriers; exact original proof/conflict/backfill/unrelated rejection/no automatic return refund-restock |
| UI/auth/runtime | Queue/no-store/review/cart/retry/grants/hydration/requeue audit/row keys/filter; import isolation/pool/env guards/both images/probe/upgrade/drain |

## 9. External account/release blockers

Public docs/fixtures cannot close these. Historical remote observations are not current verification.

- [ ] **E01 Pricing:** negotiated Fayoum-origin account rates/VAT/material/COD fees/rounding/all bands/authoritative inclusive amount. Unverified pricing keeps quotes off.
- [ ] **E02 Shipment:** actual create/read/complete unique search/account/environment/default pickup/contact/sizes/no insurance-opening/prepaid zero COD/collection-confirmation-time units.
- [ ] **E03 Edit/cancel:** Full Access DELETE, supported fields/states and actual printing/pre-pickup/custody/cancel booleans. No fictional paths; unsupported capabilities off.
- [ ] **E04 Related:** real original-child discovery/relation/account/type/reference/late correction before enabling linkage.
- [ ] **E05 Deployment:** injected role settings/schema, dashboard X-Bosta-Webhook-Secret/URL, current intake-worker health, deliberate five-gate configuration.
- [ ] **E06 Inquiry:** API-key access, account/order/integration/environment/action semantics, token lifetime/cumulative refund cents against merchant account.
- [ ] **E07 Routing:** both card/wallet dashboard processed URLs and locale-neutral return. Notification URL is card-only; sending it alongside wallet is not routing proof; token actions excluded.
- [ ] **E08 Authorized sandbox:** card/wallet success/decline/retry/early binding/restart/backlog/one fulfillment/early-growing refunds/late review/shipping effects. Provider writes/live activation separately authorized.

## 10. Future cutover/pause/rollback

VPS actions one at a time when authorized. Record project/volumes/config/schema/images and DB backup; build matched images/quiet role validation. Agreed brief maintenance must return non-2xx rather than false callback acknowledgment; confirm provider retry policy. Drain old API (all current schedulers), apply additive migrations once, start healthy new worker then matching intake-only API and restore traffic/observe queue. No normal dual scheduler ownership.

Keep unverified shipping off and inquiry/dashboard routing verified before initiation. Shared settings require recreating both services; restart retains env. Preserve project/volumes/queues/audit/mutation markers. Worker pause may retain durable intake but requires backlog alert/new-initiation restriction; never discard paid evidence/holds. Sending-off retains read recovery; provider-HTTP-off may retain authenticated local replay/saved linking. Uncertain linked cancellation holds stock.

Rollback needs compatible inbox-aware payload/schema code and exactly one scheduler owner. Baseline already has recovery but may not understand new versions. Drain incompatible work/use compatible revision; no stale DB restore over payment/stock, queue deletion/schema removal or uncertain-write replay.

## 11. Primary sources rechecked

- [Bosta OpenAPI](https://docs.bosta.co/api/api.yaml): create/search/read/edit/terminate/calculator, nested `_id`. Examples do not prove account-specific completeness/custody.
- [Delivery creation](https://docs.bosta.co/docs/how-to/create-your-first-delivery/), [address format](https://docs.bosta.co/docs/how-to/format-bosta-address/), [webhooks/states](https://docs.bosta.co/docs/how-to/get-delivery-status-via-webhook/), [API-key scopes](https://docs.bosta.co/docs/how-to/get-your-api-key/).
- [Paymob intentions](https://developers.paymob.com/paymob-docs/intention-apis/create-intention): Secret Key/Token/cents/order/client secret/card-only notification/card-wallet redirect.
- [Callbacks](https://developers.paymob.com/paymob-docs/manage-callback/transaction-callbacks): server authority/cumulative refunds/browser distinction.
- [Transaction HMAC](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback): selected fields/SHA-512; transaction/order IDs signed, is_live/refund total/merchant reference absent.
- [Authentication](https://developers.paymob.com/paymob-docs/developers/authentication-request-generate-auth-token-1), [inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id): API-key/token/Bearer and identity/action/refund response. Rendered explorer hides some URL details; existing endpoint code is not freshly proved by rendered pages alone.
- [Docker Compose services](https://docs.docker.com/reference/compose-file/services/): separate image/command/dependencies/health/stop grace.

Product/commercial policy remains in [Bosta requirements](bosta-shipping-integration.md). [Release guidance](bosta-shipping-release.md) must update when migration lands. Intervals/leases/parking/resource budgets are application choices, not provider guarantees.
