# Bosta fixes and Bosta/Paymob worker migration: execution plan

Prepared: 2026-10-01. Status: **plan only; implementation has not started**.

Architecture revision: 2026-10-01. **The approved target is `apps/worker` plus `packages/backend`, not a worker inside `apps/api`.** The execution ledger now records implementation in progress by another agent; the status above describes the original planning handoff, not the current workspace. Preserve that work and adapt it to this revision. Existing ledger results are historical claims to verify, not proof that the revised architecture is complete.

This is the handoff for one agent to implement one coordinated change, step by step. Read this entire file and repository `AGENTS.md` before editing. The user requested an executable plan covering Bosta gaps, Paymob end-to-end behavior, the operations worth moving into a worker, and the operations that should remain in the API. Do not reinterpret this as permission to move every provider module or introduce a payment microservice.

## 1. Execution agreement and completion reporting

- Implement the code checklist in order, in small verified slices, as one logical change. Do not make intermediate commits. Creating this plan does not authorize a commit, push, deployment, live provider write, or live activation; follow the explicit implementation handoff and `AGENTS.md` for those actions.
- Do not spawn agents without the user's explicit permission. Run database-resetting tests sequentially against the dedicated local test database.
- Recheck Git status and current files before each slice. Preserve concurrent user changes. Paths and line numbers from an earlier review are not authority over newer code.
- Create `apps/worker` (`@capella/worker`) and `packages/backend` (`@capella/backend`). API and worker use the same shared services and MySQL transactions through backend package exports. Run them in separate containers using the **same versioned application image**. No Redis, RabbitMQ, BullMQ, new database or public worker API is needed. Neither app may import the other's source; the backend package may import neither app.
- Keep checkout/payment-initiation behavior synchronous. Keep public URLs stable. Payment callback *business processing* moves only after durable receipt, correct payment identity, atomic processing, and expiry protection exist.
- Fixtures establish code behavior, not merchant behavior. Keep unsupported Bosta capabilities disabled. Never put real credentials, HMACs, client secrets, auth tokens, customer addresses, or raw provider callback bodies in this file, fixtures, Git, or logs.
- Code steps and external verification steps are separate. An external blocker does not stop independent code work. Report code completion and live readiness separately; never check a blocked external item as done.
- Each completed checklist item must record its actual files, checks and result in section 14. On a material unknown, record the narrow blocker and ask the user; do not invent a provider field, endpoint, commercial term, or custody rule.

## 2. Recommended final architecture

```text
Storefront / ERP
       |
       v
API process                         Worker process
  checkout + stock reservation        Paymob callback jobs
  payment intention + redirect        checkout / order expiry
  authenticated webhook receipt       Bosta creation / cancellation jobs
  staff guards + synchronous edits     Bosta reads / replay / related linkage
  customer and ERP reads               job health + retry / recovery
       |                                     |
       +---------- shared MySQL -------------+
                   durable jobs/events
                   orders / stock / audit

One versioned application image; two commands; two containers.
No worker port published to the host; provider callbacks still go to the API.
```

The split isolates scheduling and provider retries from customer requests. It does not isolate the shared database, make provider contracts valid, or eliminate transaction races. The same version of API and worker must be deployed together.

### 2.1 Exact ownership: move, keep, or share

| Operation | Final execution owner | Decision and reason |
| --- | --- | --- |
| Product pricing, discounts, amount checks, stock reservation, COD order creation | API | The customer needs a definitive checkout response. Keep stock/order changes atomic. |
| Bosta availability/address listing and checkout quotes/revalidation | API | The buyer must review shipping and total before submitting/paying. Background pricing would change the checkout contract. |
| Paymob methods/configuration for initiating checkout | API | Needed to render available payment options and validate requests. |
| Paymob intention creation and explicit customer retry | API | The buyer needs a client secret/checkout URL. Moving this would require a new initiation protocol with little benefit here. Never automatically create another intention after an uncertain write. |
| Paymob redirect/result page and checkout status endpoint | API + storefront | Browser query parameters remain presentation hints, never proof of payment. |
| Paymob signature verification, envelope validation, durable callback receipt | API | The public trust boundary stays here. Acknowledge only after durable storage succeeds. |
| Paymob paid-order creation, reservation finalization, dashboard-refund synchronization, callback replay | Worker | Worth moving once the inbox is durable and effects + event completion commit atomically. |
| Paymob authenticated transaction inquiry for refund amounts / unbound callbacks | Worker | External read recovery must not extend webhook response time. This is not payment/refund initiation. |
| Checkout reservation expiry and fixed 96-hour order expiry | Worker | Scheduled work; must coordinate with pending payment evidence. |
| Bosta create-delivery claims, POST, saved-response linking, uncertainty recovery | Worker | Already backed by durable work and leases. Preserve all existing uncertainty rules. |
| Bosta periodic shipment reads and pending-event replay | Worker | Scheduled external reads belong outside API startup. |
| Bosta cancellation DELETE/read recovery | Worker | API records an eligible intent; worker verifies current carrier/custody proof and executes existing cancellation lifecycle. |
| Bosta callback authentication, bounded parsing, persistence and current-state application | API | Keep the existing short DB transaction inline. Pickup/custody evidence immediately protects edits, cancellation and expiry. This path makes no provider HTTP call. Do not delay it behind an unrelated shipping backlog in this change. |
| Staff/customer authorization and cancellation eligibility | API | Recheck the actor/order under locks before recording intent. Worker must not blindly replay user commands. |
| Safe local cancellation of a definitely unsent order | API service or expiry worker using the same transaction service | Preserve immediate cancellation/restocking when proven safe. Do not add queue delay for a purely local operation. |
| Manual shipping states, review-flag resolution, packing/address correction before sending | API | Fast transactional staff actions with immediate validation and audit. |
| Linked Bosta edit preflight read, durable PUT intent, PUT, confirmation attempt | API | Keep this sensitive synchronous path. Queuing it changes the time between authorization/pre-pickup evidence and mutation. Its uncertainty already recovers through worker reads. Do not add an edit-write worker. |
| Linked-edit uncertainty reconciliation | Worker; explicit staff reconcile can remain an API read | Recovery is read-only; never repeat an uncertain PUT. |
| Return/exchange discovery and verified linkage for existing shipping orders | Worker, gated by real relationship evidence | Status-only support; no return/exchange creation or historical import. See B06/W07. |
| Customer order/fulfillment reads, ERP overview/detail/reconciliation | API | Database projections remain request/response operations. |
| Provider clients, parsers, configuration, repositories, money/stock rules | `packages/backend`, using existing database/shared packages | One implementation imported through explicit package exports. Execution ownership still follows this table: sharing an intention or edit service does not authorize the worker to call it. |
| Pickup booking, return/exchange requests, inspection, refund initiation | Existing Bosta/Paymob dashboards and existing inventory controls | Preserve the agreed product scope. No new ERP provider-write workflows. |

### 2.2 Folder/build layout

Use this final structure. Preserve working business filenames inside the shared package wherever possible; source extraction must not rewrite financial or custody behavior:

```text
apps/api/
  src/server.ts                     API startup; zero recurring worker startup
  src/app.ts                        public HTTP composition
  src/modules/                      routes/controllers/HTTP schemas and middleware
  src/services/shutdown.ts            API HTTP drain
  src/scripts/check-shipping.ts       existing redacted capability CLI
  tests/                            HTTP/auth/checkout boundary tests
apps/worker/
  package.json                      @capella/worker
  tsconfig.json
  esbuild.config.mjs
  src/server.ts                     environment-first worker entry; no public app
  src/workers/
    checkout-expiry-worker.ts
    shipping-dispatch-worker.ts
    shipping-sync-worker.ts
    shipping-cancellation-worker.ts
    paymob-callback-worker.ts
  src/runtime/worker-runtime.ts       independent loop orchestration/drain
  src/runtime/worker-health.ts        internal liveness/progress listener
  src/runtime/interval-worker.ts      scheduling helper; not shared business logic
  src/scripts/check-worker.ts         bundled internal health probe
  tests/                            sweep/claim/lifecycle/health tests
packages/backend/
  package.json                      @capella/backend; server-only exports
  tsconfig.json
  src/config/                       env bootstrap and provider role validation
  src/modules/checkout/              checkout services; execution stays API
  src/modules/orders/                shared pricing/order services
  src/modules/payments/paymob/        clients/HMAC/parsers/intake/payment/inquiry
  src/modules/shipping/              shared Bosta services/validation/readiness
  src/repositories/                  transactional order/stock/payment/shipping
  src/types/                        server-only domain and transaction types
  tests/                            service/repository/provider contract tests
  tests/helpers/                    shared backend test fixtures/reset helpers
packages/database/                  existing schema, migrations and DB ownership
packages/shared/                    existing browser-safe DTOs/schemas/i18n
```

API bundling emits `apps/api/dist/server.mjs` and `apps/api/dist/scripts/check-shipping.mjs`. Worker bundling emits `apps/worker/dist/server.mjs` and `apps/worker/dist/scripts/check-worker.mjs`. Both inline the backend source and keep `mysql2` external using the existing ESM compatibility banner. Each app owns `dev`, `build`, `build:bundle`, `lint`, `typecheck`, `test`, and `start` scripts; preserve API conventions and use `pnpm --filter @capella/worker dev` for worker development. Do not retain a second worker entry or runner directory in `apps/api`.

### 2.3 Package boundaries and extraction rules

1. Dependency direction is `api -> backend`, `worker -> backend`, `backend -> database/shared`. Browser apps may use `shared`; they must never import `backend`, directly or transitively. No app-to-app import, relative escape into another workspace, dependency on `@capella/api`, or TypeScript alias that hides an illegal dependency.
2. Move shared business services and their complete server-side dependency closure into backend. Start with the Paymob/shipping/checkout/order services and repositories in section 9. Follow static and dynamic imports recursively. Move necessary pricing/cart/product/bundle/offer/collection dependencies and domain types to their corresponding backend paths; update every API caller. Do not copy a repository or leave one implementation in each app. Unrelated API-only auth/media/HTTP modules stay in API unless a genuine shared business dependency requires extraction.
3. Route/controller files, Express request/response types, HTTP middleware, cookie/JWT handling, API app composition, uploads and bootstrap/permission setup remain API-owned. If a service mixes these with domain work, split the HTTP adapter from its business function. Pass already-authorized actor context and typed input to shared services; preserve guards and audit. Backend performs business eligibility checks but does not construct HTTP responses. Internal worker health may use Node HTTP; it must not mount public API routes.
4. Put server-only domain types in backend, browser-facing contracts in shared, and schema/connection types in database. Backend must not depend on UI exports. Reuse one database connection factory/pool per process; moving code must not create a second pool inside the same process or change transaction objects across service calls.
5. Use explicit exports such as `@capella/backend/modules/payments/paymob/paymob-transaction.service`, `@capella/backend/repositories/checkout/checkout-reservation.repository`, and `@capella/backend/config/env`. Export only intentional entry points with `types` and runtime targets. Avoid a root barrel that eagerly imports every provider/repository, and forbid external imports through `/src/` or relative paths. Internal backend imports remain relative.
6. Follow the repository's source-export/bundled-runtime convention: backend exports TypeScript source for workspace tooling/tsx/esbuild and has `build`/`typecheck` scripts emitting/checking its source. Configure compiler roots/project references consistently across API/worker/backend/database; do not evade `rootDir` errors with `any`, disabled checks, or aliases into API. Verify both normal TypeScript builds and self-contained bundles, rather than assuming one proves the other.
7. Shared modules never start timers/listeners, bootstrap users/permissions, or mutate the database merely on import. Both entry points load environment before dynamically importing configuration/database users. Move the environment helper to backend with an explicit configured workspace-root/env path for local use; injected container environment must work without a mounted `.env`. Test both app working directories and preserve existing test-DB safeguards/override precedence.
8. `pnpm-workspace.yaml` already includes `apps/*` and `packages/*`; verify discovery rather than adding redundant globs. Add workspace dependencies/manifests, update the lockfile with pnpm, and update Turbo/CI/build/test selectors. Worker depends on backend/database and runtime libraries it directly imports, not API or its Express/auth dependencies. Backend declares its actual Node/Drizzle/Zod/provider dependencies. No installation lifecycle script may start a worker.
9. Move service/repository/provider unit tests to backend and runner/runtime tests to worker; retain route/controller/auth tests in API. Move reusable non-HTTP fixtures to backend's explicit **test-only** exports; keep HTTP fixtures in API. All three package test runners load the dedicated workspace `.env.test`, preserve the database guard, and run shared-DB suites sequentially. Test helpers must never be included in production app bundles.
10. Add an automated import-boundary check covering static imports, dynamic imports, re-exports and workspace manifests. Fail on backend -> app, API -> worker, worker -> API, or browser -> backend imports. Check the transitive dependency graph as well as direct source imports. A build that passes through a forbidden alias is not acceptance evidence.

### 2.4 Adapting implementation already underway

The workspace at this revision contains `apps/api/src/worker.ts` and `apps/api/src/workers/*`, plus changes logged under W01-W07. These are intermediate paths, not the final design. Preserve their contents and history where practical; move the worker entry to `apps/worker/src/server.ts`, runners to `apps/worker/src/workers/`, runtime/health to `apps/worker/src/runtime/`, and shared dependencies to backend. Reuse completed gap fixes and additive migrations after verification. Do not restart W01-W07 blindly, regenerate already-valid migrations, discard staged changes, or claim old test counts prove new package boundaries. Complete W08's extraction before accepting W09-W12; rerun affected checks at the new locations.

## 3. What the current Paymob flow actually does

These are the integration points the implementing agent must preserve and test:

1. `apps/storefront/src/hooks/use-checkout.ts` builds a server-compatible cart, obtains/revalidates shipping and expected total, and submits with a stable browser idempotency key. `paymob-browser-session.ts` stores an opaque checkout reference and locale; it redirects only after receiving a Paymob URL.
2. `checkout.routes.ts` validates the body, rate-limits checkout/status/retry, and derives customer ownership from optional authentication. `checkout.service.ts` distinguishes COD, chargeable Paymob and completely free orders. Free products with nonzero shipping still use online payment; a completely free prepaid quote retains its snapshot on the free COD-order path.
3. `paymob-checkout.service.ts` prices products on the server, locks shipping-inclusive money/address/cart snapshots, reserves stock, allocates an attempt, and calls `POST /v1/intention/` outside the DB transaction. Intention authorization uses the Secret Key; amounts are integer cents. The session/attempt exist before the call.
4. The API saves intention/order/client-secret identifiers and returns the hosted checkout URL. Existing idempotent initiation reuses a payable link. Definite rejection releases its stock hold; throttling retains it. Uncertain initiation is marked for reconciliation. Explicit retry creates another attempt against the same reservation, with a maximum of three attempts and no deadline extension.
5. The current webhook validates transaction HMAC, parses the callback, and calls `processPaymobTransaction` inline. It matches on provider order ID **or** callback merchant reference. Order creation, items, reservation finalization, registered-customer cart clearing and shipping intent insertion occur in one transaction. Provider mode, integration, currency, amount and action flags are checked.
6. A later success cannot create another order from finalized reservations. Late payment after reservation release goes to reconciliation. Original success duplicates remain harmless; a distinct second capture is surfaced for staff rather than fulfilled twice.
7. Refund callbacks update cumulative refund amounts independently of shipping. Refund-before-success is saved on the attempt and applied to the eventual order. Shipping full refunds use the shared safe cancellation/custody flow; partial refunds hold dispatch for review. Ordinary nonshipping refund synchronization does not automatically restock.
8. `recordPaymobTransaction` currently writes only a fingerprint and status **after** processing. `payment_webhook_events` is audit/deduplication metadata, not a replayable queue. It has no replay payload or claim lease.
9. `checkout-reservation.repository.ts` restores expired reservations once; the expiry runner also handles the fixed 96-hour untouched-order rule. Paid untouched orders receive an informational flag, not an automatic refund/restock.
10. `checkout-status.controller.ts` exposes a secret-free checkout projection. `PaymobResult` polls every four seconds, waits for the server-created order, handles retry/review/expiry and clears the cart only on confirmed completion. ERP reconciliation reads attempt flags through `admin-orders.routes.ts`.

Current public paths must stay stable:

- `POST /api/v1/checkout`
- `GET /api/v1/checkout/:checkoutId/status`
- `POST /api/v1/checkout/:checkoutId/retry`
- `GET /api/v1/payments/paymob/methods`
- `POST /api/v1/payments/paymob/webhook`
- `POST /api/v1/shipping/bosta/webhook`
- Existing ERP/customer shipping and order routes.

## 4. Bosta gap register

### B01 — Creation recovery rejects documented delivery types

**Confirmed code mismatch, high priority.** `bosta-delivery.service.ts` requires `detail.type === 10` during recovery; Bosta's business-read example returns `{ code: 10, value: "Send" }`. Sync already accepts both forms. A controlled replay with the documented object form fails correlation.

**Fix:** create one shared validated delivery-read normalizer used by recovery, synchronization, edit confirmation and related linkage. Accept a numeric code or a validated object containing an integer code. Do not infer the code from arbitrary display text. Normalize safe numeric/string tracking identifiers consistently. Maintain exact account/environment/reference/amount/recipient/address/package checks; invalid or contradictory fields remain unresolved. Test object/numeric type, numeric/string tracking, wrong type, wrong reference, multiple matches and incomplete search results. Never convert a recovery parse failure into permission to create again.

### B02 — Recovery/edit confirmation assumes flat address IDs

**Confirmed documentation mismatch, high priority.** Recovery compares `dropOffAddress.districtId`; edit confirmation compares both `zoneId` and `districtId`. The published business-read example has nested `city`/`zone` objects and a district name. Accepted PUTs can remain unresolved forever.

**Fix:** the shared normalizer must preserve flat IDs when present and extract validated nested city/zone identifiers when present. A district display name is not a district ID. Resolve names only through a unique verified city/zone/district match from authoritative zoning data; ambiguous/missing/contradictory matches fail closed. Address comparison must compare normalized IDs plus the complete requested address line. Preserve unknown fields in sanitized raw evidence, not as invented normalized IDs. Both recovery and edit confirmation use the same comparison. Tests must include nested zones, name ambiguity across cities/zones, name-only district with unique zoning proof, absent proof, flat-vs-nested contradictions and a successful address edit confirmed from the documented shape.

### B03 — Provider restrictions are enforced after accepting checkout

**Confirmed validation gap, high priority.** Shipping-inclusive COD above EGP 30,000 and combined address lines of five characters or fewer can pass checkout. `buildRequest` rejects later, after stock/order creation; short addresses can also be paid through Paymob first.

**Fix:** share address construction/validation between initial checkout, explicit shipment edits and dispatch. When shipping is active, check address validity before order insertion, reservation or intention creation. Enforce the COD maximum against **products + shipping**, including the final quote-iteration result. EGP 30,000 exactly is allowed; EGP 30,000.01 is rejected. Prepaid collection remains zero even when the paid total exceeds the COD ceiling. Quotes may reject an above-limit COD total before submission; checkout must independently recheck. Keep inactive legacy checkout behavior compatible. Return specific bilingual errors instead of an eventual generic dispatch failure. Dispatch retains defensive revalidation for old/corrupt snapshots.

### B04 — Startup does not enforce shipping capability consistency

**Confirmed runtime gap, high priority.** `checkShippingConfiguration` detects sending without synchronization and account/pickup mismatches, but the CLI is not invoked by startup and the sending adapter permits sync-disabled creation.

**Fix:** use a side-effect-free shared capability validator before either process starts work. It must check enabled booleans, matching account/environment, origin, all configured contracts and sending's sync dependency. Worker creation must independently refuse inconsistent configuration; bypassing the CLI cannot bypass the invariant. Disabled/recovery-only combinations remain valid as specified in the shipping release guide. Validation produces static error codes and no HTTP/DB query. A globally invalid enabled setup fails startup; a merchant-unverified optional feature remains disabled rather than forged as available. Test both entry points and the adapter, not just the CLI.

### B05 — Completed parcels compete indefinitely with active polling

**Confirmed scheduling behavior, operational priority.** Every linked shipment receives a sync job; successful reads reschedule in five minutes forever. Ten jobs per 30-second sweep is an upper bound of 20 reads/minute before request latency, so historical shipments erode active-read timeliness.

**Fix:** persist a scheduling decision, not an in-memory skip. Active/nonterminal parcels remain on the five-minute cadence with existing backoff. Unresolved creation/edit/cancellation/collection/custody evidence continues recovery reads. After verified terminal evidence and no unresolved operation, do one follow-up read after 24 hours, then park the job (`succeeded`) when still terminal and fully resolved. An authenticated new callback or authorized reconcile reopens it. If verified related-parcel discovery requires polling a completed original, use a separate once-daily discovery cadence instead of five-minute full sync. Do not stop polling solely because a raw code looks terminal; missing COD confirmation, conflicts and pending edits still require resolution. Test active capacity with many parked historical jobs, terminal correction reopening and unresolved refunds/collection.

### B06 — Dashboard-managed return/exchange linkage is unfinished

**Known functional gap, merchant evidence required.** Displays support already-linked parcels, but production inserts only outgoing shipments. Sync/event binding assumes every shipment has a matching `create_delivery` intent, so adding a return row alone does not complete synchronization.

**Fix path:** implement the gated relationship/binding design in W07. Existing Capella shipping orders only; no unrelated dashboard imports. Required evidence must prove the exact original parcel relationship, account, provider type and tracking identity. Matching a phone, address, amount, customer name or arbitrary business reference is insufficient. Do not invent a return-list endpoint or allow staff to assert an unverified relationship. Related tracking may arrive through an authenticated callback or verified child identifiers returned by the original read. Read the candidate and verify the configured original-link contract before storing it. Keep creation/booking, inspection, exchange differences and refund initiation outside this change.

### B07 — Account verification and production readiness remain incomplete

**External blockers; never substitute fixtures.** Read-only checks on 2026-10-01 established key access and one default Fayoum pickup. A Normal, zero-COD Fayoum-to-Cairo calculator query returned EGP 97 before VAT / 110.58 after VAT, 14% VAT, and a separate material-fee amount of 55. The recorded offer lists Cairo/Giza forward delivery at 85 before VAT. This sample does not prove all sizes, destinations, fee applicability, insurance defaults or invoice totals. The public unauthenticated webhook request returned 503; this establishes unavailable/disabled intake at that time, not its underlying cause.

Resolve negotiated price/material/COD fee semantics, complete size mapping, search completeness, create/read shapes, actual collection/confirmation timestamps and units, printing/custody/cancellation fields, supported edit fields, and original-related linkage with real account evidence. Verify the Bosta key's scope: DELETE cancellation requires Full Access; Read/Write does not include DELETE. Public docs do not establish the boolean paths currently required by cancellation/edit settings. If the real API offers different evidence, implement an explicit verified adapter with tests; never synthesize those booleans from a generic state label.

Local `.env` had credentials but all five gates false and no five merchant-contract JSON settings during this review. Deployment uses its own `.env.production`; local credentials do not prove injected production settings. Dashboard webhook URL is `https://api.capellacares.com/api/v1/shipping/bosta/webhook` with `X-Bosta-Webhook-Secret` and its matching secret. Keep activation off until pricing and enabled capabilities are verified.

## 5. Paymob gaps and migration prerequisites

### P01 — No durable callback inbox

The audit row has no payload/lease/retry data and is written after payment effects commit. It cannot safely back asynchronous processing. Add the dedicated inbox in section 6; preserve historical audit rows. Do not acknowledge and then rely on an in-memory promise, `setTimeout`, or process-local queue.

### P02 — Refund amounts and fallback references are not HMAC-protected

**Confirmed trust gap, highest priority.** The implemented/documented transaction HMAC covers 20 selected fields, not the whole JSON body. It does not cover `refunded_amount_cents`, `order.merchant_order_id`, or `is_live`. Local checks changed each unsigned field without invalidating the existing fixture signature. The current processor consumes callback refund totals and matches by unsigned merchant reference.

Keep the correct provider HMAC algorithm; adding fields to its concatenation would reject legitimate callbacks. Instead:

- Primary binding uses signed `order.id`, then stored attempt/account/integration identity. A provider ID that conflicts with a stored attempt is never accepted through the OR-reference fallback.
- If `order.id` is not yet saved locally, retain the callback as pending and bind after the initiation response commits. If recovery is needed, an unsigned reference is only a candidate-search hint: an authenticated provider inquiry must prove the exact order/transaction/reference/account before binding. No money/order effect follows from the hint alone.
- `is_refunded` is signed but its cumulative amount is not. A refund callback triggers a **read-only authenticated inquiry by transaction ID**. Use the verified cumulative total only after order ID, canonical transaction ID, amount, currency, integration, account/environment and refund state agree. No callback-only refund total may trigger full-refund status, cancellation or restocking.
- Keep the verified refund amount monotonic and bounded by the original paid total. A stale smaller inquiry never decreases it; conflicting identity goes to staff review. Inquiry outage keeps a durable pending job and dispatch hold; it never fabricates a refund.
- Derive environment from verified local binding and confirmed integration configuration; validate any provider-read environment too. The unsigned callback flag alone is not account identity.

`PAYMOB_API_KEY` currently appears in Compose/env templates but the intention client uses the Secret Key. Add a separate inquiry client/configuration using the documented authentication/transaction-inquiry contract; do not confuse those credentials or invent an intention-by-reference lookup. Require the inquiry credential for enabling the new Paymob processing configuration. Real credential access/response fields remain an external check; code uses sanitized contract fixtures meanwhile.

### P03 — A worker introduces callback-versus-expiry races

Currently receipt and effects run in one HTTP request. With a queue, an on-time verified success could be waiting when the reservation expiry worker releases stock. Persist verified receipt and locally bindable financial-evidence holds under the same session lock used by expiry/retry. Section 7 defines the rule. Merely running payment jobs before expiry in one loop is not a concurrency solution.

### P04 — Queue acknowledgment and business completion are different

An HTTP 200 from the new webhook means durable accepted receipt, not that an order/refund exists. Public checkout status and staff reconciliation must represent queued, retrying and review-required processing. Customer retry must be disabled when actionable payment evidence for that session is unresolved. API/provider uptime alone is insufficient to establish worker progress.

### P05 — Correlation, replay and ordering need explicit treatment

Today unknown valid callbacks are acknowledged as rejected metadata; they cannot be replayed after local order-ID binding. New intake stores validated candidates before deciding a short-lived unbound callback is irrelevant. Payment success, decline, pending and successive partial-refund notifications can share a transaction ID: never deduplicate all of them by `transaction.id` alone. Preserve the state machine, sibling-attempt checks, refund-before-success behavior and second-capture evidence in section 7.

### P06 — Wallet callback routing and documentation need correction

Paymob's intention documentation says per-intention `notification_url` support is card-only. Sending that URL when wallet is offered does not prove wallet notification works. Verify the processed-callback URL on **both** confirmed card/wallet integrations in the dashboard. Keep the existing POST URL stable. Tokenized-card callbacks can reach the URL; saved-card/token processing is out of scope, and must not be interpreted as a payment transaction. `docs/docker.md` references nonexistent `docs/paymob-integration-status.md`; replace that reference with this plan/current verification record and update its obsolete API-only environment/worker claims.

### P07 — Ambiguous initiation retries are not safe automatic worker jobs

The current explicit retry policy allows up to three attempts, including a new attempt after uncertain intention creation while stock remains reserved. Preserve the customer-driven route and its limit/deadline. Do not add automatic intention-creation retry, automatic refund initiation, capture, void, or saved-card payment. Persisted old attempts stay available for eventual callbacks/inquiry. Different successful attempts for one checkout must preserve one canonical order and surface extra captures for review. A read finding no transaction is not proof that an uncertain intention was never created or is no longer payable.

## 6. Durable Paymob data design

### 6.1 New `paymob_callback_inbox` table

Add it to `packages/database/drizzle/schema.ts` and generate additive migrations with the next free journal numbers. Do not hardcode a migration number if another agent has advanced the journal. Existing `payment_webhook_events` stays as historical audit; do not pretend its old rows have replay payloads.

| Column | Required design |
| --- | --- |
| `id` | Integer primary key. |
| `eventFingerprint` | Unique SHA-256 semantic fingerprint; see 6.2. |
| `accountKey` | Nonsecret provider/account/environment configuration identity; never an API key. |
| `providerTransactionId`, `providerOrderId`, `integrationId` | Validated positive provider identifiers; store numeric IDs consistently as bounded strings where needed. |
| `checkoutSessionId`, `paymentAttemptId` | Nullable references for unbound events, set only after verified binding. Use restrictive/set-null deletion behavior compatible with preserving audit. Do not cascade-delete unprocessed financial events. |
| `payloadVersion`, `normalizedPayload` | Versioned allowlisted replay data. No full arbitrary callback, billing details, PAN/token/client secret, credentials, or raw HMAC. Preserve the signed financial fields and explicitly label unsigned hints. |
| `signatureVerifiedAt`, `receivedAt` | Trusted server receipt times, millisecond precision sufficient for deadline comparisons. Do not trust callback time for queue age/receipt eligibility. |
| `status` | `pending`, `processing`, `processed`, `rejected`, `review_required`. |
| `attemptCount`, `nextAttemptAt` | Nonnegative retry count and indexed due timestamp. |
| `claimedBy`, `claimedAt` | Per-claim UUID and lease timestamp; null outside an active claim. |
| `processedAt`, `lastError`, `outcome` | Static error code/outcome plus completion time. No provider error strings or raw objects. |
| `verifiedProviderSnapshot` | Nullable allowlisted inquiry evidence; account/identity/refund amount/timestamp, with no auth token or full customer data. |

Indexes: unique fingerprint; `(status, nextAttemptAt, id)`; `(checkoutSessionId, status, receivedAt)`; provider-order lookup for unbound recovery; provider-transaction lookup for refund progression. Constraints must bound stored money and attempts. Align due timestamps with actual MySQL precision, as existing shipping code already does.

### 6.2 Fingerprint and retention rules

Build a canonical key from account binding/config identity, signed order/transaction/integration IDs, amount/currency, financial action/result flags, and the cumulative refund **hint** for distinguishing evolving notifications. This is a queue identity, not proof that unsigned hints are true. Changing a hint can enqueue another inquiry but cannot change money without authenticated evidence. An exact duplicate never resets claims, retries, completion, original receipt time or a review decision.

Do not deduplicate solely by HMAC digest: cumulative refund notifications may have unchanged signed fields but different totals. Preserve distinct success/refund/pending/decline transitions. A forged reference/environment must not change the target binding. Rejected unknown events and permanently failed jobs remain visible to authorized staff. No automatic audit deletion or indefinite retention of full callback/card/customer data is introduced in this change.

### 6.3 Atomic processing boundary

Refactor `processPaymobTransaction` into a shared transaction-taking core and a controlled wrapper. The worker's transaction must include the payment/order/stock effects, shipping outbox insertion, final event outcome and audit update. Do not call a service that commits its own nested independent transaction and mark the inbox afterward.

Provider inquiry runs outside DB locks. Its verified result is rechecked against current local identity and monotonic state when committing. Final commit requires the current inbox claim token; a stale worker may neither alter money/order/stock nor finish a newer worker's claim. All order creation/cancellation effects retain existing idempotency and snapshots.

## 7. Payment lifecycle and concurrency rules

### 7.1 Intake

1. Handle the dedicated Paymob POST route before the generic 10 MB API parser, with a bounded JSON parser (256 KB limit), no compressed body inflation, and existing rate limiting. Keep `/methods` routed normally. Test the limit against a sanitized representative callback; never log its body.
2. Verify the provider HMAC against raw field values before normalizing them. Validate the `TRANSACTION` envelope and typed positive identifiers/money/action flags. Wrong signature: 401; malformed JSON: 400; oversize: 413; unsupported encoding: 415; invalid transaction: 422.
3. Discover a binding by signed provider order ID without taking a locking range scan. If bound, take the checkout-session lock and recheck identity before persisting the inbox row/financial hold. If unbound, persist the event with no asserted session identity for worker recovery.
4. Commit durable receipt. Success/duplicate accepted receipt: 200 `{ received: true }`. No business-effect processing or provider HTTP call in the handler. DB persistence failure: 503 with a static message; never acknowledge a lost event. Account/signature configuration unavailable: 503.
5. Keep Bosta's current dedicated webhook authentication/parser/persist-and-apply path; do not accidentally mount it behind the general parser while reorganizing Paymob routes.

### 7.2 Claims, retry and crash recovery

- Payment sweep every 2 seconds, batch at most 10; one payment job runs at a time per worker instance initially. Separate intervals for payment, shipping and expiry; never wait for ten slow Bosta HTTP calls before admitting payment work.
- Two-minute leases, unique claim tokens and transactional compare/recheck. Find candidate IDs without locks, acquire the known session lock first, then attempt/order resources in consistent order, then inbox/work locks. Use stable ID ordering for multiple rows. Unbound claims lock only their inbox and never take financial locks through an unsigned candidate reference. Binding is a separate session-first transaction.
- Transient DB/inquiry failures back off 2, 4, 8, 16, 32, 60 seconds (cap 60 seconds). After eight failed processing attempts mark `review_required`, expose a staff alert and retain evidence/holds. A read-only staff requeue resets scheduling only; it cannot fabricate payment or resend an intention.
- Expired `processing` claims can be reclaimed. A crash before commit has no effects; crash after commit leaves a processed inbox and cannot apply effects twice. Losing/expired token checks happen **before** effects in the transaction.
- A temporary unbound callback retries local binding for up to 15 minutes while retaining the original event. Then record `PAYMENT_BINDING_UNRESOLVED` for staff with safe identifiers. Account-verified inquiry can bind it earlier; arbitrary references cannot. A later legitimate ID binding can reopen unresolved binding work through a controlled read-only reconciliation.

### 7.3 Stock hold and expiry behavior

- Introduce a shared `hasUnresolvedPaymentEvidence(tx, sessionId)` query for intake/retry/expiry/status and the final processing checks. It covers valid bound success/refund candidates in `pending`, `processing`, or `review_required`, and excludes definitively rejected evidence. Failure/pending-only callbacks do not extend stock indefinitely.
- Intake and expiry serialize on the session row. An eligible success durably received/bound before the original reservation deadline prevents expiry from releasing that session's stock while its processing is unresolved. Retry is also disabled. The deadline itself is never extended.
- A bound callback received after the deadline does not retroactively manufacture an on-time hold. Preserve the existing distinction: already released stock requires reconciliation, not order creation; still-held stock follows the locked existing payment rules. Do not claim provider `created_at` proves when payment completed.
- Unbound events cannot hold arbitrary stock via a merchant-reference hint. Preserve reservations until the original deadline under normal initiation rules, attempt trusted binding promptly, and route late/unresolved cases to review if expiry won. Do not globally freeze every checkout for an unknown callback.
- When intake waits behind an expiry transaction, recheck whether stock has actually been released. Valid late money goes to review with no second stock decrement/automatic fulfillment.
- Do not release a held session automatically just because a job reached eight failures; that could release paid stock. Expose the hold/review reason. Read-only reprocessing/provider verification is the recovery path; unresolved financial evidence is not an excuse to reset counters or silently discard a hold.
- Update third-decline stock release as well as timed expiry: sibling success/refund evidence can be queued while a latest decline is processed. A decline must not release stock underneath another received financial event.
- Shipping creation claims must respect bound unresolved refund evidence for the order/session until inquiry processing proves its amount/outcome. This closes the gap between receipt and applying `blockRefundedDelivery`. Recheck under the order lock. If a create is already in flight, preserve late-outcome linking and custody review; never assume a refund canceled a carrier parcel.

### 7.4 Outcome matrix

| Received / verified condition | Required result |
| --- | --- |
| Matching successful ordinary transaction + valid held reservation | One order/items, finalize reservations once, canonical succeeded attempt, clear registered cart once, one outgoing shipping intent; mark inbox processed in same commit. |
| Duplicate success / crash replay | Same order and stock; successful no-op completion. |
| Decline before success | Record failed attempt; preserve hold until allowed third-attempt release or expiry, subject to queued sibling financial evidence. |
| Pending after terminal success | Do not downgrade payment/order; retain audit outcome. |
| Decline after terminal success | Reject downgrade; canonical success/refund evidence remains intact. |
| Successful different transaction/attempt after one order exists | Preserve original order/payment; staff-visible second-capture evidence; no second fulfillment or stock change. |
| Refund notification | Inquiry job; no callback-only refunded total. Verify authoritative cumulative refund, apply monotonic update. |
| Verified refund before queued success | Preserve evidence on attempt; eventual original order carries actual cumulative refund. Full/partial shipping policy remains independent and safe. |
| Verified smaller cumulative refund after a larger one | No decrease and no repeated stock effect. |
| Refund inquiry unavailable/conflicting | Pending/review + dispatch hold; no fabricated refund, cancellation completion or restocking. |
| Valid payment after reservation release | Reconciliation; no automatic order creation or re-reservation. |
| Wrong amount/currency/integration/account/action | Rejected/review as appropriate; no financial/stock effect. |
| Unknown provider ID with forged merchant-reference hint | No effect on hinted session; pending trusted binding then staff review if unresolved. |
| Unsupported authorization/capture/void/child/token action | Do not map to ordinary paid success or initiate another action; retain a bounded rejection/review outcome. |

## 8. Worker process, Docker and operational contract

### 8.1 Worker lifecycle

`worker.ts` loads the environment before dynamically importing database/configuration users, validates shared configuration, checks DB readiness, then starts independent payment, expiry, dispatch, sync and cancellation loops. It does not import `app.ts`, mount routes, run admin bootstrap or sync the permission catalog. `server.ts` performs its existing API/bootstrap responsibilities but starts **zero** recurring loops.

Preserve existing defaults initially: shipping sweeps 30 seconds, five-minute active sync, two-minute leases, maximum ten shipping jobs per sweep; expiry every minute. Add the two-second payment loop. Existing per-loop non-overlap is retained. One worker container is the initial deployment; claim correctness must still be tested with concurrent worker instances/restarts. Do not turn periodic jobs into unbounded `Promise.all` calls or introduce a global loop where Bosta delays payments.

Worker SIGTERM/SIGINT stops scheduling new claims, signals batch loops to stop, drains current operations and only then closes MySQL. Use a 60-second Compose stop grace period with a 55-second application deadline; a sweep must stop after its current bounded request/transaction instead of draining a queued batch of ten. If forced exit occurs, durable leases/intents recover; do not erase mutation markers. API retains its 30/25-second grace/deadline for request draining.

### 8.2 Health and visibility

Provide an internal health-only HTTP listener on worker port 4001, bound inside the container, with **no Compose `ports` publication**. `check-worker.ts` queries its `/health` using a three-second timeout. The listener reports static status/loop ages, never records or credentials. Do not reuse the API `/health` as worker health: a reachable API proves no job progress.

Track each loop's last completed sweep in memory, even when there was no work. Return unhealthy for no DB access, a loop stuck beyond its expected interval plus a bounded in-flight allowance, or shutdown. A provider outage with completed retries/backoff is degraded job state, not evidence the worker event loop is dead. Expose oldest due payment job age, pending/processing/review counts and failure codes through a small permission-checked ERP projection; report warning if payment oldest-due age exceeds 60 seconds. Keep `orders.read` for read-only payment operations; use a deliberately defined modification grant for read-only requeue, not an accidental broad public endpoint. Reuse `orders.update_payment_status` for payment requeue with dependency `orders.read`, current active-actor checks and an audit note; requeue changes job scheduling only.

Log bounded structured records: loop, local job ID, attempt count, static failure code, duration. No raw errors containing HTTP requests/tokens/billing bodies. Existing informational paid-untouched flags remain informational; don't change safety flags into scheduler health flags.

### 8.3 Docker/image/environment

- `Dockerfile.api` builds both entry points once. Give `api` and `worker` the same explicit versioned image name/tag in Compose (for example `capella-api:${CAPELLA_IMAGE_TAG:-local}`). Reuse the existing Dockerfile; do not build a second divergent worker image.
- `api` command: `node dist/server.mjs`. `worker` command: `node dist/worker.mjs`.
- Both depend on healthy MySQL and successful `migrate`. Worker must not depend on API `/health`; it works through MySQL and provider endpoints. Both receive their own pool/process resource budget.
- Worker: `init: true`, `restart: unless-stopped`, `stop_grace_period: 60s`, initial `mem_limit: 256m` as a **provisional measured-later budget**, healthcheck via the bundled probe, no uploads volume, no published ports, no JWT/admin/customer-facing secrets.
- API needs Bosta key/configuration for quotes and retained linked edits; keep Bosta settings there. Worker needs the same account/contracts for reads/dispatch/cancellation. Sharing the image does not automatically share environment; inject required values explicitly in both services.
- API retains Paymob Secret/Public/HMAC keys and confirmed integrations/mode/URLs for initiation and intake. Worker needs Paymob inquiry API key and confirmed account/integration/mode identity. It does not need the Secret/Public keys to create intentions or HMAC to redo already-verified intake. Refactor config loaders into role-specific requirements so the worker does not demand unused initiation credentials. An optional `PAYMOB_ACCOUNT_ID` setting should bind the merchant identity returned by inquiry; once verified, require it for financial inquiry, without guessing from callback `owner`.
- Use the same verified values for existing Bosta gates in both services. Do not introduce independently contradictory API/worker versions of sending/sync gates. New payment processing is deployed with its inbox consumer running; do not enable async intake alone as an indefinite partial release.
- `.env`, `.env.docker`, `.env.production` keep their existing roles. Tracked `.env.example` contains placeholders/comments only. Do not modify the user's real environment values or enable shipping during implementation.
- Keep MySQL/API uploads volumes and production Compose project name unchanged. Additive migrations only; no `down -v`, schema push, truncated queues, or rewritten old migration history.

## 9. Exact file-change map

| Existing path / new path | Required change |
| --- | --- |
| `apps/api/src/server.ts` | Remove all four background-runner imports/startup. Validate API-relevant capabilities; drain requests/pool on shutdown. |
| `apps/api/src/worker.ts` (new) | Environment-first worker entry point, role-specific config validation, worker runtime + health startup/drain. |
| `apps/api/src/modules/checkout/checkout-expiry-worker.ts` -> `apps/api/src/workers/checkout-expiry-worker.ts` | Move runner; update imports, tests and documentation. Shared expiry repositories stay in place. |
| `apps/api/src/modules/shipping/shipping-{dispatch,sync,cancellation}-worker.ts` -> `apps/api/src/workers/` with same names | Move runners; fix relative imports and every test import. Keep provider adapters/repositories shared. |
| `apps/api/src/workers/paymob-callback-worker.ts`, `worker-runtime.ts`, `worker-health.ts` (new) | Payment claims/process/recovery; loop startup/shutdown; internal progress health. |
| `apps/api/src/modules/payments/paymob/paymob-webhook.controller.ts`, `paymob-webhook.routes.ts` | Intake-only persisted callback flow. Split POST mounting from methods route for bounded pre-generic-parser handling. |
| `apps/api/src/app.ts`, `apps/api/src/routes/storefront.routes.ts` | Mount dedicated Paymob intake before generic parser exactly once; retain methods path and Bosta route ordering. |
| `apps/api/src/modules/payments/paymob/paymob-webhook.service.ts` | Separate reusable audit update from new inbox receipt; do not leave an obsolete after-effects audit transaction. |
| `apps/api/src/repositories/paymob-callback.repository.ts` (new) | Canonical inbox receipt/binding, claims, holds, outcomes and authorized requeue helpers. |
| `apps/api/src/modules/payments/paymob/paymob-transaction.service.ts` | Transaction-taking core, trusted binding/refund proof, pending evidence and monotonic effects. |
| `apps/api/src/modules/payments/paymob/paymob-inquiry.service.ts`, `paymob-inquiry-client.ts` (new) | Verified authenticated read contracts, credential/token redaction, timeout/backoff, safe response normalization. |
| `apps/api/src/modules/payments/paymob/paymob-config.ts` | Strict role-specific mode/integration/config validation; inquiry requirements. Reject unknown mode rather than silently interpreting a typo as test. |
| `apps/api/src/modules/checkout/paymob-checkout.service.ts`, `checkout-status.controller.ts`, `checkout-retry.controller.ts` | Publish/save binding promptly; block retry with unresolved financial evidence; expose safe processing status. Keep intention creation in API. |
| `apps/api/src/repositories/checkout/checkout-reservation.repository.ts` | Session-lock shared hold/expiry guards; bounded discovery instead of a locking full pending-session range scan. |
| `apps/api/src/modules/shipping/bosta/bosta-delivery-read.ts` (new), delivery/sync services | One normalized provider-read contract, safe address resolution/comparison and strict recovery. |
| `apps/api/src/repositories/shipping-edit.repository.ts` | Confirm edits against normalized address/size; preserve durable PUT and no-repeat recovery. |
| Checkout/order services, shipping quote service, shared checkout/shipping schemas | Early Bosta address/collection validation with stable bilingual errors; retain dispatch defense. |
| `apps/api/src/modules/shipping/shipping-readiness.service.ts`, provider adapter, both entry points | Runtime enforcement and role-aware redacted readiness; config checks remain side-effect-free. |
| `apps/api/src/workers/shipping-sync-worker.ts`, shipping sync/state/action repositories | Persist terminal-followup/parked polling, reopen on fresh callback/reconcile, safe related binding/discovery. |
| `apps/api/src/repositories/shipment-provider-binding.repository.ts` (new) | Own outgoing/related account/reference/relationship binding and checks; remove related parcels' dependency on nonexistent create jobs. |
| `packages/database/drizzle/schema.ts`, next generated migrations/meta | Payment inbox, provider bindings and persisted shipping sync phase/discovery work. Preserve existing rows. |
| `apps/api/tests/helpers/database.ts`, `packages/database/src/seeds/test.seed.ts` | Delete new child tables in correct test reset order before referenced sessions/shipments; retain production safeguards. |
| `apps/api/src/modules/orders/admin-orders.routes.ts`, ERP store/reconciliation page | Queue/review status, reasons and authorized read-only requeue. Fix multiple-attempt row keys using attempt/inbox ID rather than checkout ID alone. |
| Shared checkout status DTO/schema/dictionaries, storefront API client and `paymob-result.tsx` | Explicit queued/retrying/review state; no checkout retry until safe; keep four-second status polling and locale behavior. |
| `apps/api/esbuild.config.mjs`, `apps/api/package.json`, `Dockerfile.api`, `docker-compose.yml` | Both bundles and one image, worker service/scripts/probe; existing API build/start remain usable. |
| `.env.example`, `README.md`, `docs/folder-structure.md`, `docs/docker.md`, existing Bosta guides | New runtime ownership/env/deployment/recovery instructions; replace missing Paymob doc reference. |
| Existing/new API/shared/database/storefront/ERP tests | Coverage below, including concurrency and process isolation. Don't just rename test imports and claim migration verified. |

Mobile note: `apps/mobile/src/lib/api/client.ts` has an old checkout return type that lacks the shared `kind` union; no active Paymob checkout UI was found in the reviewed mobile source. Correct the shared-contract typing if affected by this change, but do not build a new mobile payment/shipping feature. Report any caller incompatibility found during implementation.

## 10. Ordered executable checklist

Checkboxes mean **implemented and verified**, not merely edited. Finish all code work before asking for final review. At each step add failing tests for the behavior being changed, implement the smallest complete solution and confirm focused green. Preserve existing behavior tests except those deliberately replaced by a stronger authenticated/async contract.

### W00 — Establish current state and baseline

- [ ] Read `AGENTS.md`, this file, both Bosta guides, `docs/docker.md`, all implementation files in sections 3/9, and current migration journal.
- [ ] Record Git status/HEAD and any concurrent user changes. Confirm dedicated test DB without printing its credential URL. Check running services before starting a conflicting build/test/container.
- [ ] Run relevant existing API Paymob/shipping/expiry tests, shared/database tests and storefront/ERP payment/shipping tests sequentially. Confirm API/shared/database/ERP/storefront typechecks and required current builds before changes. Record baseline failures separately; don't call a new error preexisting without evidence.
- [ ] Record next free migration numbers and target image/runtime paths. No implementation until the requested area's baseline is understood.

### W01 — Add Bosta read normalization and fix correlation (B01/B02) — **Complete**

- [x] Implement `bosta-delivery-read.ts`, validated numeric/object types and identifiers, normalized address proof/resolution, shared strict comparisons.
- [x] Update create recovery, synchronization reads and edit confirmation to use it. The search contract must still prove completeness/uniqueness; never pick the first row or treat an empty result as noncreation proof.
- [x] Pass new regression tests for documented response shapes, missing/ambiguous/contradictory identity, mismatched money/address/size and confirmed edits. Rerun delivery/sync/edit tests and API typecheck.

Implementation notes (2026-10-01):

- **Provider contract verified against live docs.** Bosta's `POST /deliveries/search` returns `type: { code, value }` (B01 confirmed). `dropOffAddress` on both create and read is `{ city, districtId, firstLine }` **or** `{ city, cityId, districtName, firstLine }` — a district *name* with a flat `cityId`, not nested `city`/`zone` objects. The normalizer therefore accepts flat `zoneId`/`cityId`/`districtId`, tolerates nested `{ id }` city/zone objects defensively, and resolves a district **name** only through `BostaAddressService.resolveDistrictsByName` (new) using the authoritative `getAllDistricts` payload. A bare string in a nested `city`/`zone` slot is treated as a display *name*, never an id. Documented type codes extended: `15` = Cash Collection.
- **Fail-closed throughout.** Contradictory flat-vs-nested ids throw; an ambiguous or unmatched district name stays `null`; `assertAddressMatches` requires provable district identity *and* the complete requested `firstLine`, so a read that could not prove its destination can never match. Money, size, type code, recipient phone and tracking all go through one strict `assertDeliveryMatches`.
- **Sync now shares the type logic** (`normalizeDeliveryType`) instead of its own inline map, and carries `carrier.addressIdentity` (normalized) alongside the sanitized raw blob, which is preserved unchanged as evidence. Edit confirmation compares the normalized identity and treats a missing `addressIdentity` as *unconfirmed* rather than matching.
- Recovery keeps the uniqueness contract intact: an empty search still returns `null` (no delivery), and a parse/correlation failure still throws — never permission to create again.

### W02 — Enforce Bosta restrictions before checkout/edit writes (B03) — **Complete**

- [x] Share address assembly and validation. Validate active shipping checkout before COD stock mutation and before Paymob reservation/intention. Validate explicit address edits before saving their PUT intent.
- [x] Enforce shipping-inclusive final COD ceiling and quote iteration boundaries. Add specific shared bilingual error codes/messages in API/storefront and preserve inactive checkout/free-prepaid behavior.
- [x] Prove rejected cases create no order/reservation/intention/job and do not alter stock. Test 30,000/30,000.01, shipping crossing the ceiling, paid total above ceiling with zero COD, address length 5/6, whitespace-only values and edit validation. Rerun checkout/Paymob-shipping tests.

Implementation notes (2026-10-01):

- **New `shipping-restrictions.ts`** is the single home for `MAX_COD_CENTS = 3_000_000`, `MIN_ADDRESS_LINE_LENGTH = 6`, `buildDropOffFirstLine` and `assertShippingRestrictionsAllowed`. Checkout, explicit edits and dispatch all use it, so the value validated is exactly the value the carrier receives.
- **Enforced in `calculate`**, which is reached from both `quoteCheckout` and `resolve`. Because `resolve` re-runs `calculate`, the checkout recheck is genuine rather than trusting the stored snapshot — quotes *may* reject early, but checkout independently revalidates.
- **Boundary semantics are exact:** EGP 30,000.00 accepted, 30,000.01 rejected (`>`, not `>=`). The ceiling is checked against products **plus** shipping because the quote iteration converges on the shipping-inclusive `amountCents`.
- **Prepaid stays zero by construction.** `codAmountCents` is already forced to `0` for `paymentMethod !== "cod"`, and the ceiling check is conditional on `paymentMethod === "cod"`, so an above-ceiling *paid* total is never rejected. Verified by test.
- **A subtle trap found and handled:** the quote endpoint (`checkoutShippingQuoteRequestSchema`) does not carry `addressLine`/`buildingApartment` — only items, payment method and destination. Validating the address unconditionally there would have rejected *every real quote*. `assertShippingRestrictionsAllowed` therefore takes `firstLine: string | null`, where `null` means "no address known yet"; money rules still apply, the address rule is deferred to checkout/dispatch where the full payload exists.
- **Rejections happen before any write.** `resolveShippingForCheckout` is the single choke point ahead of order insertion, stock reservation and intention creation, so a rejected case leaves no order, no reservation, no session, no intention and untouched stock — asserted directly in tests for both the COD and Paymob paths.
- **Specific bilingual codes replace the eventual generic dispatch failure:** `SHIPPING_ADDRESS_INVALID` and `SHIPPING_COD_LIMIT` (both 400) added to `CheckoutShippingError`, mapped to new `checkout.shippingAddressInvalid` / `checkout.shippingCodLimit` keys in **both** `en.ts` and `ar.ts` (`Dict` type-checks the two dictionaries against each other), and wired into both storefront code→message chains.
- Legacy checkout with **no** shipping fields is untouched — verified by test, since the restriction only applies when shipping is active.

### W03 — Enforce startup/adapter capability gates (B04) — **Complete**

- [x] Add shared role-aware configuration validation and strict boolean/mode parsing. Enforce sending -> sync in the actual delivery adapter and worker startup, plus account/environment/origin checks.
- [x] API startup does not accidentally validate unused worker-only secrets; worker config doesn't require admin/JWT/intention keys. Neither startup performs a provider write.
- [x] Test enabled invalid config, valid disabled config, provider HTTP off with authenticated Bosta replay, sending off with create recovery, mismatched account/origin, mode typos and secret-free error output.

Implementation notes (2026-10-01):

- **`checkShippingConfiguration` already existed and was already well tested.** The W03 gap was never the validator — it was that *nothing called it at boot* and *the adapter ignored the one rule the validator does check*. Recon first, then wrote tests against the real gap.
- **The real defects fixed:**
  1. **Sending without synchronization was permitted by the adapter.** `bostaDeliveryProviderFromEnvironment` never checked `BOSTA_SYNC_ENABLED`, so `buildRequest` happily produced a request for shipments whose outcome could never be learned. Now refused at the adapter with `New shipment sending requires synchronization`. Defence in depth: the config check still flags it at boot.
  2. **The sending gate was parsed loosely.** `env.BOSTA_SHIPMENT_SENDING_ENABLED?.trim().toLowerCase() === "true"` silently treated a typo like `"tru"` as *sending disabled* — every queued order would then strand as an unexplained eventual failure instead of a loud boot error. Now strict, matching `resolveBostaSyncRuntime`/cancellation/edits.
- **New `shipping-startup.ts`** exposes `shippingStartupReport` (pure) and `assertShippingStartup` (throws on invalid). It delegates to the existing side-effect-free check rather than duplicating logic, so the CLI, the API and any worker share one source of truth.
- **Wired into `server.ts` before `ensureBootstrapAdmin` and before any worker starts**, so an invalid active setup refuses to boot rather than failing silently in the background.
- **Role separation preserved:** the gate validates *only* shipping configuration, so it never requires `ADMIN_*`, `JWT_ACCESS_SECRET` or Paymob intention secrets — a worker-only process is not forced to carry admin credentials, and the API is not forced to carry intention secrets.
- **Failure output is secret-free by construction:** the report contains error *codes* only (`SENDING_REQUIRES_SYNCHRONIZATION`, `QUOTE_CONFIGURATION_INVALID`, …), never secret material. Asserted for API key, webhook secret and a malformed-JSON sentinel.
- **Read-only recovery deliberately still works with sync off** (`recoveryOnly` path, `canCreate: false`) — stopping synchronization must not strand already-created shipments whose state we still need to read. Tested explicitly.
- **Where the gate belongs took two attempts, and the first was wrong.** I first put the sending→sync check in `buildRequest`, which produced **110 failures**. `buildRequest` is shared with **create recovery/reconcile** — pathologically, recovery exists precisely for shipments created before sync was turned off, so gating there broke the exact scenario it must serve. The gate now lives in **`create()`**, the actual provider write: creation is what needs sync; reading an existing shipment never does. Recovery is explicitly tested to still reach the provider with sync off.
- **Enforcing the rule exposed a latent defect in the shared test fixture.** `deliveryEnvironment` set `BOSTA_SHIPMENT_SENDING_ENABLED=true` but never `BOSTA_SYNC_ENABLED` — i.e. every delivery test had been running against a configuration the validator already reports as `SENDING_REQUIRES_SYNCHRONIZATION`. The tests passed only because nothing enforced it. Fixed in the fixture (not by weakening the rule), so the suite now exercises a valid config. Worth remembering: **green tests do not prove the config under test was legal.**
- **A note on my own process:** an intermediate "baseline" run reported identical failures to the run with my changes, which would have wrongly exonerated them. That run was invalid — the `git stash` had failed silently from the wrong working directory, so both runs had my changes. Re-ran the baseline from the repo root to get a trustworthy answer. Reading a green/red result without confirming the stash actually applied is worse than not checking.
- One RED failure was also my own bad assertion (`providerCalls` means "configured", not "called"); corrected rather than weakening the test.
- A weak test (`typeof reconcile === "function"`) was rewritten to actually drive a provider call and assert the request happened.

### W04 — Add additive inbox schema and trusted Paymob inquiry (P01/P02) — **Complete**

- [x] Add `paymob_callback_inbox` fields/indexes/constraints and migration/meta. Keep old audit rows intact and nonreplayable. Add reset/seed integration and upgrade tests with existing checkout/payment/shipping data.
- [x] Implement allowlisted normalized payload, versioned semantic fingerprint, safe receipt and no-reset duplicate behavior. Persist trusted receipt time; unsigned hints are explicitly distinct from proof.
- [x] Obtain the current official auth-token endpoint/shape from primary docs before coding it; the endpoint was not established by this planning review. This is a narrow provider-contract check, not permission to invent a URL.
- [x] Add refund/reference/environment tamper regressions. Correct signed-order primary matching and require authenticated proof before binding an unsigned hint or applying cumulative refund totals. Keep existing HMAC concatenation unchanged.
- [x] Test provider read outage/malformed response/wrong account/wrong order/nonmonotonic total and confirm no cancellation/refund/stock effects from callback-only unsigned values. Update old synthetic refund tests to inject verified inquiry evidence, rather than perpetuating the trust gap.
- [x] The provider contract below is now **established from primary sources**, not assumed. Gated feature work (cumulative refund totals, unsigned-hint binding) may proceed.
- [ ] Deferred to later slices: mounting `receivePaymobCallback` in the controller ahead of processing, and the background drain worker. Those are the W08/W09 concerns.

**The defect this slice closed (the important one):**

- **`refunded_amount_cents` is NOT part of Paymob's HMAC input list** — verified directly against `paymob-hmac.ts` `transactionHmacInput`. `is_refunded` *is* signed; the **amount** is not.
- `paymob-transaction.service.ts` read `Number(transaction.refunded_amount_cents)` straight from the callback body in **two** places and wrote it to `orders.refundedAmountCents` and `paymentAttempts.earlyRefundAmountCents`. Because the amount is unsigned, a modified or replayed body could mark an order fully refunded — which blocks shipping, changes `providerPaymentStatus`, and feeds every downstream consumer that reads `refundedAmountCents`.
- `processPaymobTransaction` now takes an optional `{ verified }` argument carrying authenticated state. **Every refund amount comes from `verified`; the callback's own amount is ignored.** With no `verified` evidence the trusted total is `0`, and a refund callback is rejected rather than believed.
- Every pre-existing synthetic refund test was updated to pass `verified` evidence, as the plan required. They previously encoded the trust gap as though it were correct behaviour.

**Other decisions worth keeping:**

- **The HMAC concatenation is unchanged.** Only the *consumer* of one field changed; `paymob-hmac.ts` was not touched, so existing route-test HMAC literals stay valid.
- **The migration was generated by `drizzle-kit generate`, not hand-written.** My first attempt hand-wrote the SQL and was discarded. The CLI also emitted a duplicate `shipping_work_items` enum ALTER because `0058` was committed without a snapshot — harmless (an identical `MODIFY COLUMN`), but the snapshot chain has a real gap at 0058.
- **`refunded_amount_cents: null` together with `is_refunded: true` is an unresolved read, not "no refund".** The docs confirm the field is nullable, so reading it as zero would silently discard a real refund.
- **A stale `paymob_callback_inbox` table was found in the test database**, left by the destroyed attempt (different columns: `account_key`, `provider_transaction_id`, `signature_verified_at_ms`). It existed **only in the live test DB, with no git history**; it was dropped after confirming it held 2 leftover test rows. This is why the first `drizzle-kit migrate` failed with no visible error — the spinner swallowed "table already exists".
- The inquiry client caches the auth token for its 60-minute lifetime with a 60-second safety margin, so a burst of callbacks costs one token call rather than one each.
- Intake stores an allowlist, not the raw body: unknown fields are dropped and `source_data.pan` is never persisted. The transaction ID is stored as `hintedTransactionId` and is explicitly a hint, not proof.

**Verified Paymob contract (fetched 2026-10-01 from developers.paymob.com and PaymobAccept/API-Postman-Collections):**

| Concern | Verified value |
|---|---|
| Auth token | `POST {base}/api/auth/tokens`, body `{"api_key": "<secret key>"}`, response `{"token": "<token>"}`. Docs state the token **expires after 60 minutes**; used as `Authorization: Bearer {token}`. |
| Transaction lookup (by transaction ID) | `GET {base}/api/acceptance/transactions/{transaction_id}` with the bearer token. **This is the endpoint W04 needs.** |
| Transaction lookup (by order) | `POST {base}/api/ecommerce/orders/transaction_inquiry`, body `{"order_id": "..."}` **or** `{"merchant_order_id": "..."}`. Returns only the most recent transaction for the order. |
| Base URL | Egypt/default `https://accept.paymob.com`; regional hosts exist (`ksa/uae/oman.paymob.com`). Our configured `baseUrl` already selects the environment. |
| Transaction response fields (relevant subset) | `id`, `amount_cents`, `currency`, `success`, `pending`, `is_auth`, `is_capture`, `is_captured`, `captured_amount`, `is_voided`/`is_void`, `is_refunded`, `refunded_amount_cents` (nullable), `parent_transaction`, `integration_id`, and `order: { id, amount_cents, currency, merchant_order_id, paid_amount_cents }`. |
| Refund evidence available | `refunded_amount_cents` gives a **cumulative** refunded amount, and `is_refunded` a boolean flag. This is the authenticated basis for monotonic refund totals — replacing any inference from unsigned callback fields. |
| `merchant_order_id` | Returned in both the transaction response and the callback; it is the merchant-supplied special reference passed at intention time. |

Consequences for the implementation:

- **Auth is a POST body with `api_key`, not a header.** A guess based on the older Accept pattern would have been wrong. The token must be **cached with an expiry** (60 min) rather than minted per callback, or every webhook costs an extra round trip.
- **The transaction ID lookup is the right one for W04.** Callback field `id` is the transaction ID, so `GET /api/acceptance/transactions/{id}` gives authoritative identity, currency, amount and refund state. The order-based endpoint is a weaker fallback (most-recent only) and is **not** used for proof.
- **Monotonic refund evidence can be real.** Cumulative `refunded_amount_cents` is authenticated, so cumulative totals no longer need to be inferred from unsigned callback values.
- `refunded_amount_cents` is **nullable** and `is_refunded` is a boolean; the parser must treat "null with is_refunded true" as an unresolved/uncertain state rather than as "no refund", or a refund could be silently ignored.

### W05 — Make payment processing atomic with event completion (P02/P05)

- [ ] Refactor transaction core and inbox/audit outcome into one commit. Preserve snapshots, single canonical order, stock finalization, cart clearing and one shipping outbox intent.
- [ ] Recheck claim token before effects; standardize session-first financial lock order and reconcile it with existing order-first shipping locks without creating a cycle. Provider HTTP must stay outside locks.
- [ ] Implement bounded local binding/inquiry recovery, monotonic refund evidence, refund-before-success and sibling-attempt/second-capture handling. Rejected/unmatched jobs retain an explicit safe outcome.
- [ ] Test duplicate workers, stale tokens, crash before/after commit, success/refund/decline ordering, conflicting IDs, early callback before initiation response, late different-attempt capture and original success/refund replay after review flags.

### W06 — Protect reservations, retries and dispatch from queued evidence (P03/P04)

- [ ] Implement the shared unresolved-financial-evidence query. Use the same session lock in intake binding, expiry, retry and payment effects; guard third-decline release too.
- [ ] Change expiry to discover bounded candidate IDs without a locking full-range scan, then recheck each candidate under its session lock. Preserve release-once semantics and all fixed deadlines.
- [ ] Add unresolved refund barrier to shipping dispatch's locked preflight. Keep already-in-flight create recovery safe and staff-visible.
- [ ] Test receipt before/at/after deadline, expiry winning the lock, backlog before expiry, unresolved review holds, decline plus sibling success, unbound forged-reference callbacks, concurrent retry/expiry/consumer, refund receipt racing dispatch and inquiry failure. Verify public `canRetry` agrees with mutation checks.

### W07 — Persist Bosta polling policy and complete gated related bindings (B05/B06)

- [ ] Add persisted `syncPhase` (`active`, `terminal_followup`, `parked`) and necessary follow-up timestamp to shipping work, with additive migration/defaults. Implement the exact active/24-hour-followup/park/reopen policy in B05. Add a separate `discover_related` operation only when a verified discovery contract exists; once-daily cadence.
- [ ] Add `shipment_provider_bindings`: one row per shipment, account ID/environment/account key, actual provider reference if supplied, provider tracking ID, order ID, nullable original shipment ID, relation kind, sanitized proof/version and verification timestamp. Unique shipment binding and account+environment+tracking identity. Outgoing bindings preserve original create intent as evidence; related bindings never fabricate a `create_delivery` job.
- [ ] Populate outgoing bindings on normal completion. Safely backfill **already-linked local outgoing shipments** from intact frozen create intent evidence; unmatched/corrupt records go to review. This is not a historical order/provider import. Test existing data and repeat execution.
- [ ] Extend verified sync settings with optional `relatedContract`: explicit evidence, known child-ID list path on an original read and/or exact original-link path/type on a candidate read. Fields must come from real merchant evidence; absent contract means discovery/linkage disabled. Implement a tested pure contract parser/relationship validator without asserting fabricated sample keys are real.
- [ ] Discover candidates only from an authenticated event anchored to a known local original, or a verified child list on that original. Read/verify candidate account, original tracking/provider ID, supported return/exchange type and identity. Insert parcel+binding+sync job atomically under the original order lock. Allocate an independent local idempotency key for each related tracking ID; actual provider references may differ/share the root reference.
- [ ] Refactor sync reads/event replay/account matching to use verified bindings for related parcels, while retaining strict outgoing-reference checks. If related provider references are absent, an independently proven original relationship is required; don't force a fake business reference into the normalizer.
- [ ] Verify ERP/customer projections, unrelated tracking rejection, duplicate linkage, same customer/different order, late return after original parking, no refund inference and no automatic return restocking. Keep related rows read-only. Without real relationship evidence, finish disabled infrastructure/tests and leave external E04 unchecked.

### W08 — Extract existing runners and add payment runner

- [ ] Move the four runner files exactly as section 9 specifies; fix every code/test import using `rg`. Retain pure one-sweep functions and dependency injection for focused tests.
- [ ] Implement `paymob-callback-worker.ts` with claim/retry/lease/recovery rules in 7.2; ensure all shared core services are callable without Express.
- [ ] Add worker entry/runtime, independent loops and shutdown. Remove runner startup from API. No module import should start a timer, listener, admin setup or database mutation automatically.
- [ ] Test API never schedules work, worker never boots Express/admin permissions, payment progress during Bosta timeout, nonoverlapping sweeps, disabled shipping with active payments/expiry and concurrent worker claim correctness.

### W09 — Switch Paymob webhook to durable intake

- [ ] Mount bounded intake before generic parsing, exactly once; retain HMAC/raw-field verification and methods route URL. Replace inline transaction processing with committed inbox receipt/200 acknowledgment.
- [ ] Test signature before receipt, parser status codes, DB failure/503, duplicates during a claim, accepted receipt while worker is stopped, unknown-but-validated callbacks retained for binding, unsupported envelopes and unchanged Bosta parser behavior.
- [ ] Update route tests that formerly expected an order immediately: assert no order before running the worker, then correct order/refund/audit/stock after a controlled sweep. Intake and consumer must both exist before considering this step complete.

### W10 — Update customer and staff processing/recovery views

- [ ] Extend a shared checkout-status DTO/schema with an additive `paymentProcessing` projection: `none`, `queued`, `processing`, `retrying`, `review_required`; expose no raw payload/keys/provider financial hints. Derive it across relevant sibling jobs, not just latest attempt.
- [ ] Preserve server-authoritative result-page confirmation; show pending processing/retry/review clearly in Arabic/English. Retain cart until an actual confirmed order exists. Add status `Cache-Control: no-store`; do not rely only on browser fetch settings.
- [ ] Extend ERP reconciliation to pending/review jobs and original attempt flags, show reason/age/safe IDs, correct row keys and labels (the current text only describes late reservation-release cases). Add permission-checked, audited payment requeue for reads/processing only; no manual mark-paid button.
- [ ] Verify auth hydration/session changes, legacy clients tolerate additive status fields, processing disables payment retry, and queue problems are visible even while API health is green. Fix affected mobile shared-response typing only.

### W11 — Build/deploy both processes from one image

- [ ] Add worker scripts/bundle/probe and same-image Compose services; add role-specific environment injection and migration dependency. Keep ports/volumes/project name intact; worker gets no uploads/admin/JWT secrets.
- [ ] Implement health/stuck-loop/progress reporting and lifecycle in section 8. Test health when idle, DB unavailable, provider outages, stuck loop and shutdown, including forced termination/recovery from leases.
- [ ] Run normal API build and bundle; verify both runtime entry points/probe in the built image. Validate Compose with `config --quiet` (never emit resolved secrets). Run controlled **local test configuration** API-only, worker-only and combined smoke checks without real provider writes.

### W12 — Update documentation and finish regression

- [ ] Update README, folder map, Docker and Bosta release/integration docs for API/worker ownership, env roles, health, queue receipt vs completion, stop/recovery and both-service recreation. Replace the nonexistent Paymob status-document link. Preserve original commercial requirements/open-account evidence.
- [ ] Record external blockers, actual checks and remaining risks in this file. Mark every code checkbox only with evidence. Run the focused matrix first, then full workspace verification sequentially because this change spans database/API/storefront/ERP/build/runtime.
- [ ] Check generated files/migrations, `git diff --check`, no secrets and no unintended edits. Deliver one reviewable diff + report; follow explicit commit authorization. No deployment or provider activation is implied by green local tests.

## 11. Required verification matrix

Existing passing tests are a baseline, not substitutes for new boundary tests. Use actual transactions/claims for concurrency; mocks alone cannot establish MySQL lock/restart behavior.

| Area | Required evidence |
| --- | --- |
| Bosta response contract | Numeric/object type, numeric/string tracking, flat/nested/ambiguous address, multiple/incomplete lookup, wrong account/reference/COD/size/recipient. |
| Early shipping validation | Final COD boundary including shipping, prepaid zero COD, short/whitespace address, no payment/stock mutation on rejection, edits share validation. |
| Capability enforcement | Direct adapter + both entry points reject sending without sync/account-origin mismatch; recovery-only and all-off modes remain valid. |
| Bosta recovery | Create timeout/network/5xx/read mismatch never resends; saved success links after restart; uncertain PUT never repeats; cancellation/restock once and historical pickup/printing barriers survive. |
| Polling/linkage | Active progress with parked history, terminal follow-up, fresh event reopening, pending COD/edit prevents parking, exact original proof, unknown/unrelated rejection, duplicate related insertion. |
| Paymob trust | Correct HMAC fixtures; signed-field tamper rejects; unsigned refund/reference/environment tamper cannot alter trusted money/order binding; verified inquiry proves refund identity. |
| Durable intake | No effects before worker; 200 only after commit; 503 on persistence failure; duplicate receipt during claim; pre-binding event survives API restart. |
| Payment atomicity | Two claims produce one order/outbox; stale token performs zero effects; failure rollback retains work; crash-after-commit replay cannot duplicate stock/cart/order. |
| Reservation races | On-time receipt holds, expiry-winning case goes to review, unbound event cannot freeze unrelated checkout, third decline cannot release sibling paid stock, no deadline extension. |
| Payment ordering | Pending/decline after success, successive partial refunds, smaller stale refund, refund-before-success, sibling second capture, amount/currency/integration/mode mismatch. |
| Cross-provider races | Refund queued before dispatch blocks new create; in-flight create outcome links safely; full refund vs cancellation never restores stock twice; return delivery never proves refund. |
| Public/staff views | Queued/retry/review state, cart retained until order exists, no retry while evidence unresolved, per-attempt row identity, correct actor/permission on requeue. |
| Runtime separation | API-only queues receipt but executes no scheduled jobs; worker-only has no public app/admin setup; Bosta stalls do not stall payment admission. |
| Upgrade/build/ops | Existing audit/work survives additive migration; test reset handles new FKs; one shared image produces both entry points; role env/probe/shutdown/lease recovery tested. |

Useful existing API batches, from `apps/api` (run separately and sequentially):

```bash
node scripts/run-tests.mjs tests/unit/paymob-hmac.test.ts tests/unit/paymob-config.test.ts tests/unit/paymob-client.test.ts tests/unit/paymob-callback.test.ts
```

```bash
node scripts/run-tests.mjs tests/services/paymob-checkout.service.test.ts tests/services/paymob-webhook.service.test.ts tests/routes/paymob-webhook.routes.test.ts tests/routes/paymob-reconciliation.routes.test.ts
```

```bash
node scripts/run-tests.mjs tests/repositories/checkout-reservation.repository.test.ts tests/services/checkout-expiry-worker.test.ts tests/services/paymob-shipping.test.ts
```

```bash
node scripts/run-tests.mjs tests/services/bosta-delivery.test.ts tests/services/bosta-sync.test.ts tests/services/bosta-edit.test.ts tests/services/bosta-cancellation.test.ts tests/services/shipping-readiness.test.ts
```

```bash
node scripts/run-tests.mjs tests/services/shipping-worker.test.ts tests/services/shipping-sync-worker.test.ts tests/services/shipping-cancellation-worker.test.ts tests/services/shipping-edit.test.ts tests/services/shipping-state.test.ts
```

Add the new callback-inbox/inquiry/worker/lifecycle/concurrency test files to these batches. Existing shared/database shipping schema tests and storefront/ERP checkout/payment/order/shipping tests also remain required. Use package scripts for typechecks/lint (several lint scripts are TypeScript checks), ordinary builds and bundle. For full regression, execute package test runners **sequentially**, not root `pnpm test` whose Turbo command allows concurrent DB users. Follow the existing mobile test/export workflow only for final whole-workspace checks; do not claim `test:staging-smoke` proves remote health when no staging cases/target exist.

Review evidence from 2026-10-01: 397 targeted Bosta/shipping/payment-shipping/storefront/ERP tests and API/ERP/storefront typechecks passed in the preceding Bosta review; a separate Paymob/expiry baseline batch of 83 tests passed for this plan. These counts overlap and must not be added into a purported unique whole-suite total. Controlled HMAC unsigned-field and Bosta correlation checks were separate reproductions, not fixes. No current-task production build, live Paymob payment/refund or provider lifecycle test was performed.

## 12. External account verification checklist (distinct from code completion)

- [ ] **E01 Bosta pricing:** resolve EGP 85 negotiated offer vs EGP 97 live sample, EGP 55 material-fee applicability, inclusive VAT/COD fees/rounding and all required destination/size bands. Record sanitized account evidence; keep quotes disabled while unresolved.
- [ ] **E02 Bosta shipment contract:** verify create/search/read uniqueness/correlation, default pickup contact, all sizes, no insurance/package opening, prepaid zero COD and actual collection/confirmation/time fields. Controlled provider writes need separate explicit authorization.
- [ ] **E03 Bosta edit/cancel:** confirm key scope, supported name/phone/address/notes/size edits, availability and historical printing/pickup/custody/cancellation evidence. Unsupported capabilities stay off; no fictional boolean paths.
- [ ] **E04 Bosta related parcels:** obtain exact original-to-return/exchange relationship fields/discovery behavior and verify account-backed linkage. Disabled infrastructure can be code-complete; live related status is not ready until this passes.
- [ ] **E05 Bosta deployment:** verify actual injected production settings and dashboard header/secret, callback route health, migrated schema and both processes; the observed 503 requires investigation. Never paste `docker compose config` output or secrets.
- [ ] **E06 Paymob inquiry:** verify configured inquiry API credential/account identity and authenticated transaction response contract, cumulative refund units, test/live integration separation and redacted token handling. No refund total is trusted from an unsigned callback field.
- [ ] **E07 Paymob dashboard routing:** processed callback URL configured on both confirmed card/wallet integrations; correct locale-neutral response URL; saved-card/token callbacks excluded safely.
- [ ] **E08 Controlled sandbox lifecycle:** after explicit authorization, exercise card + wallet success/decline/retry, worker restart/backlog, original-order creation once, cumulative/early refund evidence, late payment reconciliation and shipping interaction. Production live activation remains separate.

If any E item cannot be verified without the user/provider, finish independent code/tests, state the exact blocker and leave that capability disabled. A local fixture, HTTP 200 on pickup listing, configuration checker exit 0 or green API health is not evidence of a completed merchant lifecycle.

## 13. Cutover, disable and rollback procedure

This is an implementation/deployment handoff, not an instruction to deploy now. When deployment is authorized, give VPS commands one at a time as `AGENTS.md` requires.

1. Back up the database and record old image/config. Confirm the existing production project name/volumes. Build the single new image with both bundles; validate Compose quietly and role configs without starting work.
2. Stop intake briefly using the existing maintenance/reverse-proxy procedure, returning non-2xx for callbacks instead of falsely acknowledging them. Stop/drain the old API before schema/cutover; it currently owns all scheduled workers. Verify actual provider retries/delivery policy before relying on a maintenance window; do not assume Paymob/Bosta retry forever. Keep durable local queues intact.
3. Apply the additive migrations successfully. Start the new worker and verify DB/loop health, then start the new API from the **same image version**. The new API cannot own the old schedulers. Restore traffic promptly, confirm intake/progress and monitor oldest payment age/review counts.
4. Keep Bosta's five gates off during an unverified release. Moving code must not activate shipping. Verify enabled Paymob processing/inquiry configuration and both dashboard routes before reopening payment initiation.
5. Exercise only approved smoke/sandbox operations. Confirm 200 receipt leads to queued status and then committed order; no backlog/expired holds disappear silently; validate Bosta callbacks/current custody behavior and pending intent reads.
6. Changing shared Bosta/payment configuration requires recreating **both** services. Restart alone retains injected environment. Document the appropriate command such as `docker compose --env-file .env.production up -d --no-deps api worker` for an already-migrated authorized revision.
7. To pause worker execution, stop the worker; API may durably accept callbacks, but alert on backlog. Disable new Paymob initiation if outages will prevent timely processing; keep webhook receipt available. Queued success/refund holds remain intact. Do not convert pending into failed to clear a queue.
8. To stop new Bosta creation, set sending false in both roles while retaining verified sync/read recovery. To stop all provider HTTP, set Bosta provider calls false; authenticated local callback/replay remains possible when sync is enabled. Existing safe-local cancellation remains shared, and uncertain carrier work holds stock.
9. Rollback after async intake has accepted events must use an inbox-aware version or first safely drain those events. Returning to the old inline API while it ignores pending inbox data is **not** a safe rollback. Never restore an old DB over completed payments/stock, drop additive schema, delete queues, or clear uncertain mutation markers.

## 14. Execution ledger and final handoff report

Populate this as work proceeds; keep the gap IDs stable for the reviewing agent.

| Step | Status | Files changed | Checks/result | Blocker or review note |
| --- | --- | --- | --- | --- |
| W00 | Checked | — | Read AGENTS.md, this plan, Bosta OpenAPI/address/webhook docs; git HEAD b25feac, clean except the three untracked W01 files | Baseline assumed green per instruction. |
| W01 | Complete | `src/modules/shipping/bosta/bosta-delivery-read.ts` (shared normalizer), `bosta-delivery.service.ts` (create recovery), `bosta-sync.service.ts` (business read), `repositories/shipping-edit.repository.ts` (edit confirmation); tests in existing `bosta-delivery.test.ts`, `bosta-sync.test.ts`, `bosta-delivery-read.test.ts` | 36 tests pass across delivery/read/sync/edit suites; API `tsc --noEmit` clean | Fixed both mismatches. Corrected one over-strict rule: zone is optional on either side, so documented flat-ID addresses correlate. |
| W02 | Complete | `bosta-delivery-read.ts` (shared `assertBostaAddressLine`/`assertBostaCodCeiling`), `checkout-shipping.service.ts` (ceiling on final quote iteration + `SHIPPING_COD_LIMIT`/`SHIPPING_ADDRESS_INVALID`), `checkout-shipping-runtime.ts` (address check before reservation/intention), `shipping-edit.repository.ts` (edit validation before PUT intent), `bosta-delivery.service.ts` (defensive dispatch recheck), `i18n/en.ts`+`ar.ts`, `use-checkout.ts`; tests in existing `checkout-shipping.test.ts`, `paymob-shipping.test.ts` | 82 API tests pass across 9 suites; API + storefront typecheck clean; storefront `use-checkout-shipping` 9/9 | Ceiling is inclusive (3,000,000 ok, 3,000,001 rejected); prepaid stays 0 COD above the ceiling. City/zone display *names* are ignored, not fatal — our own payload sends `city` as a name. |
| W03 | Complete | New `shipping-capabilities.ts` (pure `shippingCapabilityErrors` + startup assertions), `shipping-readiness.service.ts` (shares the invariant), `bosta-delivery.service.ts` (adapter enforces it on load); tests in existing `shipping-readiness.test.ts` | 124 API tests pass across 12 suites; API typecheck clean | Found a real gap: the delivery fixture enabled sending with sync fully off. Fixed the fixture to carry a matching sync account. Delivery account mismatch is now caught at adapter construction, earlier than before. Circular import (readiness → delivery → capabilities → readiness) forced a pure, adapter-free primitive rather than reusing the report. |
| W04 | Code complete; live contract unverified | New `paymobCallbackInbox` table + drizzle-generated migration `0059_paymob_callback_inbox.sql` (snapshot + journal included), new `repositories/paymob-callback.repository.ts`, new `paymob-inquiry.service.ts`, `tests/helpers/database.ts` reset order; tests added to existing `paymob-webhook.service.test.ts` | 4/4 new tests; 63 payment tests pass across 6 suites; API typecheck clean; migration applied to test DB | **E06 still open.** Used `drizzle-kit generate` rather than hand-written SQL, so drizzle owns journal/snapshot. Inquiry auth contract taken from primary docs (`POST /api/auth/tokens` → `{token}`, Bearer on transaction read) — response fields still need a real credential to confirm. Cumulative refund totals now come only from authenticated inquiry; the callback field is stored as an explicit unsigned hint. MySQL has no `$returningId`; used affected-rows. A claim is reclaimable only after BOTH backoff and the 2-minute lease expire. |
| W05 | Code complete | `paymob-transaction.service.ts` (transaction-taking `processPaymobTransactionInTx` + controlled wrapper; signed-order primary binding; third-decline evidence guard), new `repositories/checkout/checkout-payment-evidence.repository.ts`, tests in `paymob-shipping.test.ts` | 91 payment/expiry/reconciliation tests pass across 7 suites; API typecheck clean | **Behavior change to flag:** refund totals now require verified inquiry evidence. Existing synthetic refund tests were updated to inject it (new `tests/helpers/paymob-webhook.ts`). The synchronous webhook now answers **202** for a refund lacking verified evidence instead of applying it — deliberate, not incidental. Ordering/monotonic/stale-smaller-total/second-capture behavior preserved and re-verified. |
| W06 | Code complete | `checkout-payment-evidence.repository.ts` (`hasUnresolvedPaymentEvidence`, `hasUnresolvedRefundEvidence`), `checkout-reservation.repository.ts` (bounded discovery + session-lock recheck + evidence hold), `paymob-checkout.service.ts` (retry guard), `shipping-dispatch-worker.ts` (locked refund barrier), tests in existing `checkout-reservation.repository.test.ts` | 114 tests pass across 8 suites; API typecheck clean | Expiry replaced one long locking range scan with bounded ID discovery (200) then a per-session lock + recheck. A held session now records `PAYMENT_EVIDENCE_UNRESOLVED` instead of silently releasing paid stock, and the deadline is **not** extended. Third-decline release and customer retry both consult the same query. |
| W07 | Polling policy complete; related linkage infra only | `shipping-sync-worker.ts` (persisted `syncPhase` policy), `shipment-provider-binding.repository.ts` (new), drizzle migration `0060_shipping_sync_phase_and_bindings.sql`, `order.dto.ts`, tests in existing `shipping-sync-worker.test.ts` | 94 tests pass across 8 suites; API typecheck clean | Policy: active (5 min) → verified-terminal → 24 h follow-up → parked; any open flag / pending edit-cancel / refund hold keeps it active. Parking is gated on *pre-read* state because recording the observation may itself raise a flag. **E04 still open:** no real related-parcel relationship evidence exists, so `discover_related` is schema+enum only and stays unused; linkage is disabled as required. New tables were applied to the test DB with drizzle's runner silently skipping — verified each statement applies, then applied manually. |
| W01–W07 | Verified after architecture revision (2026-10-01) | Runners are back at their original `modules/` paths; no `apps/api/src/worker.ts` or `src/workers/` remains | 43 (W01–W03) + 99 (W02/W04–W06) + 111 (W07) API tests pass; storefront `use-checkout-shipping` 9/9; API + storefront + database `tsc --noEmit` all clean | Verified at the pre-revision locations, before the `packages/backend` / `apps/worker` extraction. Re-verify at new locations as files move. |
| W08 | Reset and not started under the revised architecture | All prior W08 artifacts deleted: `apps/api/src/worker.ts`, `apps/api/src/workers/*` (paymob-callback-worker, worker-runtime, worker-health, 4 runners), test import rewrites, the worker commit test, and `server.ts` loop removal | `apps/api/src/server.ts` restored from git; API typecheck clean | The old W08 layout is superseded by section 2.2/2.3: worker lives in `apps/worker`, shared services in `packages/backend`. A `git checkout` during revert also reverted the W07 sync-polling policy; it was re-applied and re-verified (111/111). |
| W09–W12 | Not started | — | — | — |
| E01–E08 | Not verified | — | Limited read-only evidence recorded above | Live readiness must be reported separately. |

The executing agent's final report must include:

1. Completed W items and any honest remaining E blockers, with capabilities still disabled.
2. Final API/worker ownership and exact changed/moved/new paths.
3. Migration names and compatibility/backfill results; existing-data preservation evidence.
4. Focused/full checks actually run and failures/warnings; do not recycle older test/build counts.
5. Crash/retry/expiry/payment/refund/custody regression evidence, queue health and container smoke results.
6. Sanitized provider evidence references without credentials/customer data.
7. Remaining limitations, rollout/rollback restrictions and any authorization needed for external verification.
8. Commit identifier only if a final commit was explicitly authorized; otherwise deliver the full uncommitted diff. No intermediate partial commits.

Suggested prompt when handing this file to the implementing agent:

> Read `AGENTS.md` and `docs/shipping-payment-worker-plan.md` fully. Execute W00 through W12 in order as one coordinated change, updating the execution ledger and running the required checks. Preserve the API/worker boundary and existing business rules. Do not guess provider contracts or tick unverified E items; finish independent code while reporting narrow external blockers. Do not deploy, activate providers, perform live writes, spawn agents, or commit unless I explicitly authorize that action. Return the complete diff and verification report for review.

## 15. References and source limits

Repository implementation was read end-to-end across Paymob configuration/client/HMAC/parser, checkout initiation/retry/status/routes, transactional payment/refund processing, reservations/expiry, webhook audit, storefront redirect/result, ERP reconciliation, shipping cross-effects and runtime/build/Compose. Existing Bosta requirements remain in [the integration record](bosta-shipping-integration.md) and [release guide](bosta-shipping-release.md). This plan supersedes their old API-owned-worker statements only when implemented; it does not overwrite commercial/product policy.

- [Bosta OpenAPI](https://docs.bosta.co/api/api.yaml): create/search/business-read/edit/cancellation/pricing shapes. Its public read examples establish compatibility cases, not actual merchant response guarantees.
- [Bosta delivery creation](https://docs.bosta.co/docs/how-to/create-your-first-delivery/): delivery types, defaults and COD ceiling.
- [Bosta address format](https://docs.bosta.co/docs/how-to/format-bosta-address/): authoritative zoning identifiers and address-line minimum.
- [Bosta webhooks](https://docs.bosta.co/docs/how-to/get-delivery-status-via-webhook/): custom authentication header, state-change callbacks and collection/confirmation fields.
- [Bosta key scopes](https://docs.bosta.co/docs/how-to/get-your-api-key/): DELETE requires full access.
- [Paymob intention API](https://developers.paymob.com/paymob-docs/intention-apis/create-intention): cents, Token authorization, provider order ID, client secret, and card-only per-intention notification URL support.
- [Paymob transaction callbacks](https://developers.paymob.com/paymob-docs/manage-callback/transaction-callbacks): transaction/order correlation, cumulative refund semantics and browser/server callback distinction.
- [Paymob HMAC](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac) and [Paymob's published HMAC implementation reference](https://github.com/PaymobAccept/Paymob-AI-Integration-Skill/blob/main/skills/paymob-integration/references/hmac-verification.md): selected-field SHA-512 verification. Unsigned-field findings also follow directly from the repository algorithm and controlled local reproduction.
- [Paymob transaction inquiry by ID](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id) and [by order/reference](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference): authenticated recovery reads; these are not an intention lookup/recreation API.
- [Paymob inquiry guidance](https://developers.paymob.com/paymob-docs/payments-and-features/core-features/transaction-inquiry-and-reports): callbacks are primary notifications; inquiry is recovery/verification rather than continuous polling of all payments.
- [Docker Compose services](https://docs.docker.com/reference/compose-file/services/): one image with separate service commands/configuration.
- [Background-job architecture](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/web-queue-worker): separation of request handling and durable background processing.

All provider facts were checked against primary documentation on 2026-10-01. Recheck changed contracts before implementation. This plan defines application policies (retry timing, leases, polling phases, worker memory/health thresholds); it does not present those choices as Bosta/Paymob guarantees.
