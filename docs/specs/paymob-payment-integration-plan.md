# Paymob Payment Integration Plan

Status: implementation resumed after the user's 2026-09-12 checkpoint; continue all locally verifiable work until asked to stop. The Paymob flow is not ready for customer use or deployment. Do not infer that a payment method is enabled from this document or from an integration ID in `.env`.

Last updated: 2026-09-12.

## Current state (latest; supersedes historical checkpoints below)

The locally implemented path is: select a server-confirmed Paymob method in the storefront, reserve stock for 30 minutes, create a Paymob-hosted checkout intention, return to a local status page, and create the order only after a verified successful webhook. A declined attempt can be retried up to three total attempts; the third decline releases the stock. Expiry also releases stock. A verified success arriving after release is flagged for reconciliation rather than creating an order that cannot be fulfilled. The result page trusts only the local API status, not Paymob redirect parameters. Cash on Delivery remains available separately.

Completed supporting work includes idempotent checkout, signed/deduplicated callbacks, provider payment status separate from the order's operational status, cumulative partial/full refund accounting, customer and ERP payment-state display, read-only ERP reconciliation queue, and API-only Docker Compose Paymob settings. Shipping is temporarily **0 EGP**; a shipping-company integration is deferred. Refund operations remain in the Paymob dashboard, with no ERP refund action. Migrations `0034`–`0041` were applied to the `capella_test` database. Focused red/green tests cover these slices; this is **not** a claim of a completed sandbox transaction.

Still open before activation:

- Paymob must confirm whether test VPC integration `5885253` is the intended card/3DS integration and provide/confirm the mobile-wallet integration ID. Both `PAYMOB_*_INTEGRATION_CONFIRMED` flags must remain `false` until those confirmations and sandbox checks. Live keys/IDs are a separate later setup.
- Perform real sandbox card and wallet attempts, callback delivery, retry/expiry, and refund checks against the configured public HTTPS URLs; this cannot be proven from local mocks. Confirm dashboard callback settings, especially the processed callback used for wallets.
- Complete the repeat broad validation pass and resolve any failures. Docker CLI is unavailable in this workspace; render and start Compose on the VPS before enabling payment methods. The Docker variables are wired only into the API container; no VPS secret file was edited here.
- New COD and Paymob bundle order lines now persist their checkout-time component quantities and catalog unit prices (`0041_stormy_stingray.sql`), and COD denial/restock plus ERP sales use that snapshot. Bundle revenue is allocated in whole cents with the last component taking the remainder. Focused regression tests cover bundle and variant-price edits after checkout. **Legacy order lines with no snapshot still fall back to current catalog rows**, because their original composition and pricing cannot be reconstructed; historical legacy reports/restocks may remain inaccurate if those bundles were edited.
- Decide review eligibility for a Paymob-paid but not yet fulfilled order, and the operational action for a late paid transaction in the reconciliation queue. No automatic refund/fulfillment action is assumed.
- An ambiguous provider failure can leave stock held until the 30-minute expiry; there is no provider inquiry/recovery workflow yet. The storefront now shows a truthful no-checkout state when no browser reference exists (focused red/green test passed). A duplicate decline from an older attempt can no longer release the active third attempt's stock (red/green service test passed). Wider callback-order/void coverage remains.

Validation continuation: migration `0041` was generated as a single additive nullable column and applied successfully to `capella_test` through the test-migration script. Plain `db:migrate` against the separately configured default development database failed without a diagnostic in the wrapper; do not claim that database is migrated. API/database/shared/storefront/ERP typechecks and focused checkout, sales, order-payment-status, and Paymob service tests passed after `0041`; API typecheck was rerun after the price-snapshot addition. API unit (92), service (61), repository (58), routes (227 across six bounded groups), and contract (8) tests passed. Database (35), shared (28), storefront component (242), storefront unit/contract (246), and ERP (208) tests passed. The first oversized API route attempt returned no final result under the no-poll rule, so all route files were rerun in six smaller groups with definite passing results. API/database builds and all five package lint/typecheck commands passed after the final code change. Storefront and ERP Next builds were rerun with preserved exit codes and both passed; an earlier ERP attempt emitted extensive webpack cache-restore warnings. Docker Compose remains unavailable locally. A second complete validation pass is in progress; API unit/service/repository and the first route group passed, while one route group exceeded the return window and must be rerun in smaller batches.

The detailed sections below contain historical checkpoints and design notes. Where their older “not implemented” or test-count statements differ from this section, use this current state and verify the code before acting.

This document is the working source of truth for adding Paymob payments to the Capella storefront. It records verified Paymob behavior, the current Capella implementation, confirmed product decisions, unresolved decisions, the proposed architecture, and every known repository integration point.

## Implementation checkpoint (2026-09-12)

Work resumed for focused backend safety slices on 2026-09-12, then paused at the user's request. No feature should be inferred complete from the presence of foundation code alone. The checkpoint update at the end of this section supersedes any older test counts or state descriptions below.

### Completed and verified in focused tests

- Shared checkout validation accepts `cod` and `paymob` while removing client-owned provider fields such as amount, currency, status, and integration ID.
- Workspace environment loading no longer skips non-database `.env` values when `DATABASE_URL` was already injected.
- Paymob configuration supports Egypt test/live mode, a 30-minute expiration, server-only credentials, callback URLs, and independent card/wallet confirmation gates. An integration ID alone does not enable a method.
- The Paymob client creates an Intention API request in EGP minor units and validates the essential response identifiers without logging secrets.
- Transaction callback HMAC generation/verification uses Paymob's documented field order, SHA-512, normalized booleans, signature format validation, and timing-safe comparison.
- Database migrations `0034` through `0037` add checkout sessions, stock reservations, payment attempts, webhook-event deduplication, Paymob identifiers, and a provider payment status distinct from the existing operational order status.
- The test database migration and integrity coverage verifies reservation/attempt constraints, callback fingerprint uniqueness, provider-identifier uniqueness, and separated provider/operational payment states.
- Checkout reservation persistence atomically creates the session, conditionally decrements component stock, and can restore expired reservations exactly once.
- Authoritative checkout pricing was separated from immediate order creation so a Paymob checkout can snapshot and reserve a cart without creating an order.
- Paymob initiation creates an idempotent session/reservation/attempt, persists the Paymob Intention response, reuses the same result for an identical idempotency-key replay, and rejects a changed cart using that key.
- A verified successful transaction can create one order from the immutable checkout snapshot, finalize the reservation, retain the operational order status as pending, and mark the provider payment status succeeded without deducting stock twice.
- The checkout route fails closed with `503` while no payment integration is explicitly confirmed and requires an idempotency key for Paymob initiation.
- The webhook route rejects an invalid HMAC before recording or processing the event. Valid unknown callbacks are stored once by fingerprint and safely rejected/deduplicated.
- A correctly signed, matching successful webhook now invokes the transactional payment processor, creates the paid order once, and records a processed webhook event. Unknown or rejected signed events are recorded as rejected.
- A read-only `GET /api/v1/checkout/:checkoutId/status` route exposes local session state and an order reference, if present; browser query parameters cannot mark a payment successful.
- The Intention API request now has an abort timeout (10 seconds by default).
- Idempotent replays of completed or explicitly expired sessions no longer reopen a Paymob redirect.
- Strict processed-callback parsing rejects malformed payment identity, amount, and environment types after HMAC verification.
- Migrations `0038` and `0039` persist the integration IDs offered on an attempt and add a durable `reconciliation_required` attempt state. Both were applied to `capella_test`.
- Mixed card/wallet intentions correlate success against saved IDs. The card-only `notification_url` override is omitted when wallets are offered; wallet callbacks must be configured on the Paymob dashboard.
- Matching declines update the attempt without creating an order or releasing stock. A locked retry allocator creates attempt two or three only after the latest attempt fails, retaining the reservation.
- An API-startup expiry worker restores abandoned reservations. A verified success after stock release records the Paymob transaction and reconciliation flag without creating an unfulfillable order.
- Full dashboard refund callbacks update the provider order status without automatically restocking. No ERP refund action was added.
- The retry route, status attempt/retry fields, and secret-free method-availability endpoint are implemented.
- Global 500 responses no longer expose raw exception messages; provider outages return a sanitized 502 from checkout.

Focused tests observed red before implementation and then passed for the completed slices. Database package typecheck passed previously; API typecheck passed again after these latest backend changes. The user explicitly waived the full pre-change validation run; final repository-wide validation has not been run.

### Started but not complete

- The happy-path webhook and checkout-status red TDD slices were completed in the 2026-09-12 continuation. Their focused route suites pass; edge cases below remain unfinished.
- The storefront no-401-replay test command returned a running session without a completion result. Under the repository's no-poll rule, do not claim this test red or green or implement that slice until completion is available.
- A timed-out provider request is aborted and classified safely, but an ambiguous provider failure after stock reservation keeps the hold until expiry; no immediate provider inquiry/recovery exists.

### Not implemented

- Complete concurrent/out-of-order webhook and retry tests, partial refund and void edge cases, and richer reconciliation tooling/alerts.
- A positive HTTP retry-route test using a fake provider, explicit third-attempt exhaustion test, and safe return/status behavior for all terminal states.
- Operational resolution workflow for `reconciliation_required` (dashboard refund/manual fulfillment decision); the durable flag exists, but no ERP queue or alert exists yet.
- Storefront payment-method selection, redirect, result page, status polling, retry experience, cart preservation/clearing rules, translations, and disabled/unavailable presentation.
- Disabling automatic `401` replay specifically for checkout/payment mutations in the storefront API client.
- Customer-order and ERP representation of separated operational and provider payment states.
- Complete sales/review eligibility corrections and ERP permission/presentation changes. A narrow Paymob denial guard and sales filter have been implemented, but the broader work remains.
- Shipping-provider integration. Shipping remains deliberately `0 EGP` until that separate project is completed.
- ERP refund actions. Refunds remain a Paymob-dashboard-only operational process for the first release.
- Deployment wiring, Docker environment propagation, final documentation updates, sandbox end-to-end validation, and production activation.

### Known repository/migration issue discovered

Historical migrations `0032` and `0033` have no matching Drizzle snapshots. This caused the generator to initially duplicate announcement tables in the new migration. Only the new, unapplied migration was corrected; historical migrations were not rewritten. This historical snapshot gap remains repository maintenance work and must be considered before future migration generation.

### Current safety state

#### Exact stop checkpoint (2026-09-12)

Work resumed after this historical stop. The previously unobserved storefront `401` test was run again, failed as expected, and is now green after checkout mutations were changed to avoid automatic `401` replay. New red-to-green service tests verify that retry initiation does not return a link after its stock reservation is released during the Paymob request, and that an elapsed idempotent replay is rejected before the expiry worker runs. A new red-to-green storefront API-client test verifies that a caller-supplied idempotency key is sent in the checkout header; the client now returns the discriminated shared checkout DTO. At this point the storefront hook still needs to supply a durable key and handle Paymob redirect separately. No final whole-repository validation has been run.

Further continuation update: the storefront hook now fetches server-confirmed available methods, submits a SHA-256-based stable idempotency key without storing customer/address fields in session storage, prevents concurrent double submission, preserves the cart on Paymob redirect, and handles COD separately. The result page reads only Capella's no-cache local status, polls while pending, supports retry after a recorded failure, clears the cart only when an order is confirmed, retains it on expiry, and restores the shopper's saved language after the locale-neutral Paymob return URL is redirected by the storefront proxy. The checkout summary displays the approved `0 EGP` shipping charge. Focused red-to-green storefront tests cover the choice, API client, hook, result states, private browser storage, and shipping display; storefront typecheck passed after the initial integration but must run again after subsequent changes. The API retry route now sanitizes provider failures as `502`, and malformed successful provider JSON is classified as a provider failure; both focused tests passed. The original future-work ledger below is historical and should be read with this update; full validation and real Paymob sandbox flow are still outstanding.

Latest continuation: migration `0040_stormy_mandrill.sql` adds cumulative `refunded_amount_cents` to orders and was applied to `capella_test`. Full and partial refund callbacks persist it monotonically so out-of-order older callbacks cannot regress a full refund. ERP sales now recognizes the net paid amount after partial refunds and expands collection as well as offer lines; however historical bundle composition is still read from live catalog rows, and allocation across multiple bundle components still needs exact-cent reconciliation. After a third declined attempt the reserved stock is released immediately and the checkout expires, rather than blocking a new checkout. Customer order types and labels now distinguish paid/refunded Paymob from COD operational status. ERP order detail/list display Paymob provider status read-only; Paymob dashboard remains the only refund action. A read-only ERP reconciliation queue and API endpoint list late paid checkouts with Paymob IDs but no client secrets. `docker-compose.yml` now passes Paymob variables only to the API container and `docs/docker.md` documents VPS setup. Docker is unavailable here, so rendered Compose configuration/container startup remain unverified. Shared, database, API, storefront, and ERP typechecks passed after this work except for a transient API closure-narrowing error that was fixed and rechecked; run all again after later changes. No full suite or Paymob sandbox end-to-end test has run.

Implementation stopped immediately after inspecting the storefront checkout hook, form, summary, API client, types, and API-client tests. No storefront production change was made. The only storefront change is a test asserting that a checkout `POST` receiving `401` must not be replayed. Its focused Vitest command returned a running session (`94425`) and no completion result; repository instructions prohibit polling it. Therefore its red/green state is unknown and the no-replay code fix has **not** been made. Do not assume this test passes.

Additional completed code since the earlier checkpoint: the COD route returns `kind: "cod_order"`; the shared checkout response is a discriminated COD/Paymob schema and inferred DTO, with a focused passing shared test and typecheck. Checkout status returns attempt count, latest attempt status, and `canRetry`. The Paymob methods endpoint exposes only availability/method names, not secrets. A matching declined callback retains the hold for retry, a full refund callback changes provider payment status without restocking, and a paid Paymob order cannot be manually denied before full refund. Sales filtering now excludes denied orders and pending COD, but has not been fully verified for partial refunds or collection expansion. Initial intention creation rejects a redirect if the reservation expired during the provider request while retaining provider IDs for reconciliation. Focused red-to-green tests were observed for these completed slices. API typecheck was invoked after the latest changes but its final result was not visible at this stop; do not count it as green. No full final validation or sandbox end-to-end test has run.

Immediate correctness gaps to handle on resumption, before calling the integration complete:

1. Retry intention creation can still return a redirect after the 30-minute reservation expires during its provider call; mirror the initial-attempt post-provider expiry guard and retain identifiers for reconciliation. An idempotent replay can also return a redirect for an elapsed deadline if the expiry worker has not run yet.
2. Retry-route provider failures are not yet mapped to the sanitized `502` response, and checkout controller maps unknown failures to `400`. Malformed provider JSON can escape the Paymob-specific error classification. Test these paths first.
3. Add positive retry-route, third-attempt, concurrency, terminal-state, duplicate/out-of-order callback, pending, partial-refund, void, and mismatched-identity tests. Ambiguous provider failures still hold stock until expiry with no inquiry workflow.
4. Build the entire storefront journey: method availability and choice, safe non-replayed checkout mutation, redirect, local-status result page, pending/retry/expiry states, correct cart preservation/clear, translations, and temporary `0 EGP` shipping display. Existing summary says shipping is “calculated at checkout,” which contradicts the approved temporary zero charge. The configured return URL and locale-aware result route also need alignment; never trust redirect query parameters as proof of payment.
5. Complete customer-order and ERP display of separate operational/provider states. Review eligibility and analytics need deliberate paid/fulfilled rules. The current sales fix is partial: pending/denied filtering was narrowly changed, while partial refunds, collection expansion, and mutable bundle composition remain accuracy risks. Manual denial/restock after a Paymob refund must use the immutable reservation snapshot, not live bundle contents.
6. Add an operational queue/alert for `reconciliation_required` transactions. Keep refunds as Paymob-dashboard-only; do not add an ERP refund action without a new product decision.
7. Finish Docker/deployment propagation, canonical docs, migration and whole-repository validation twice, and Paymob sandbox tests. The unconfirmed VPC card ID `5885253`, missing wallet ID, live IDs, and publicly reachable callback remain release blockers. Both confirmation flags stay `false`.

Working-tree note: `docs/deploy.md` was deleted and `docs/docker.md` added concurrently by the user; these are unrelated user changes and must not be overwritten or treated as completed Paymob deployment documentation. All Paymob work remains uncommitted.

The online option remains unavailable by default. Keep both confirmation flags false until Paymob confirms the account-specific integrations:

```env
PAYMOB_CARD_INTEGRATION_CONFIRMED=false
PAYMOB_WALLET_INTEGRATION_CONFIRMED=false
```

Do not enable Paymob in the storefront or deploy the unfinished callback flow. Cash on Delivery remains the only complete customer checkout path at this checkpoint.

### Concrete file and migration ledger

The following workspace changes belong to this implementation checkpoint. They are uncommitted.

Continuation additions: `0038_tidy_matthew_murdock.sql` and `0039_graceful_piledriver.sql` plus snapshots/journal; `paymob-callback.ts` and its unit test; `checkout-expiry-worker.ts` and its service test; `checkout-retry.controller.ts`; changes to `server.ts` and global error middleware/tests; expanded checkout, webhook, client, and service tests. Backend retry, expiry, decline, late-success reconciliation, full-refund status, safe provider errors, and methods availability are implemented in focused tests. The shared response contract is now partly implemented; storefront production work, ERP presentation, comprehensive sales handling, deployment, and full validation remain unfinished.

| Area | Files | Checkpoint state |
| --- | --- | --- |
| Environment | `.env.example`, `apps/api/src/config/env.ts`, `apps/api/tests/unit/load-workspace-env.test.ts` | Paymob placeholders/confirmation flags and corrected workspace env loading are implemented and focused-tested. Local secret values are user-managed and are not documented here. |
| Shared checkout contract | `packages/shared/src/constants/payment-methods.ts`, `packages/shared/src/dto/checkout.dto.ts`, `packages/shared/src/schemas/checkout.schema.ts`, `packages/shared/tests/checkout-response.schema.test.ts`, `apps/api/tests/unit/checkout.schemas.test.ts` | `paymob` is accepted alongside `cod`; a discriminated COD/Paymob response schema and DTO are implemented and focused-tested. Order-summary/payment-status DTOs remain unfinished. |
| Database model | `packages/database/drizzle/schema.ts`, migrations and snapshots `0034`–`0039`, `meta/_journal.json`, `packages/database/tests/integrity.test.ts` | Foundation and continuation schema/migrations are implemented and migrated on `capella_test`; complete clean/existing-database release validation remains outstanding. |
| Test DB cleanup | `apps/api/tests/helpers/database.ts` | New tables are cleared in foreign-key-safe order for tests. |
| Paymob primitives | `apps/api/src/modules/payments/paymob/paymob-config.ts`, `paymob-client.ts`, `paymob-hmac.ts` and their unit tests | Implemented and focused-tested; client timeout/error taxonomy still incomplete. |
| Reservation persistence | `apps/api/src/repositories/checkout/checkout-reservation.repository.ts`, `apps/api/src/modules/checkout/checkout-expiry-worker.ts`, `apps/api/src/server.ts`, and tests | Atomic reservation, exactly-once expiry release, and automatic API-startup sweep implemented. |
| Checkout/pricing | `apps/api/src/modules/orders/orders.service.ts`, `apps/api/src/modules/checkout/checkout.service.ts`, `checkout.controller.ts`, `checkout.routes.ts`, `checkout-status.controller.ts`, `checkout-retry.controller.ts`, `paymob-checkout.service.ts`, related service/route tests | Authoritative pricing, gated initiation, idempotency, no-order-before-payment, local status, and locked retry allocation are implemented. Final shared DTO/storefront contract remains incomplete. |
| Webhook/payment processing | `apps/api/src/modules/payments/paymob/paymob-transaction.service.ts`, `paymob-webhook.service.ts`, `paymob-webhook.controller.ts`, `paymob-webhook.routes.ts`, `paymob-callback.ts`, `apps/api/src/routes/storefront.routes.ts`, route/service tests | HMAC rejection, strict core payload parsing, deduplication, paid order creation, decline state, full-refund status, and late-success reconciliation flag are implemented. Concurrent/out-of-order and partial-action coverage remain incomplete. |
| Recent red-to-green tests | `apps/api/tests/routes/paymob-webhook.routes.test.ts`, `apps/api/tests/routes/checkout.routes.test.ts`, `apps/api/tests/services/paymob-checkout.service.test.ts`, `apps/api/tests/unit/paymob-client.test.ts` | Matching-success webhook, local status, completed/expired replay rejection, and provider timeout now pass focused tests. |
| Planning | `docs/specs/paymob-payment-integration-plan.md` | This document is the authoritative checkpoint and remaining-work record. |

No storefront or ERP production files have been changed for Paymob at this checkpoint. A storefront API-client test was changed but has not completed its red test run. No Git commit was created.

### Implemented runtime flow at this checkpoint

```text
POST checkout with COD
  -> existing immediate COD order flow

POST checkout with Paymob + idempotency key
  -> configuration/confirmation gate
  -> authoritative server pricing and immutable cart snapshot
  -> checkout session + 30-minute reservation + attempt 1
  -> stock conditionally decremented inside the transaction
  -> Paymob intention request
  -> Paymob identifiers/client secret stored
  -> redirect data returned
  -> no order exists yet

Paymob webhook today
  -> verify HMAC
  -> invalid: 401, no trusted event processing
  -> valid + matching successful transaction: finalize reservation, create one paid order, audit as processed
  -> valid + matching decline/pending: update/retain attempt state without order creation
  -> valid + full refund: update provider order status without stock change
  -> valid + late paid success after released stock: reconciliation_required, no order
  -> valid + unknown/rejected transaction: audit as rejected
```

Identical initiation retries with the same idempotency key reuse the existing session and redirect result without another stock decrement or Paymob request. Reusing that key for a different cart is rejected.

### Focused verification record

The following focused suites reached green during TDD before this checkpoint:

- Checkout shared-schema tests: 6 passing.
- Environment-loading tests: 3 passing.
- Paymob HMAC tests: 2 passing.
- Paymob configuration tests: 2 passing.
- Paymob client mapping test: 1 passing.
- Database integrity suite: 24 passing after the new migrations.
- Checkout reservation repository tests: 2 passing.
- Checkout route suite at its earlier gated-initiation checkpoint: 9 passing.
- Checkout service suite: 14 passing.
- Paymob checkout service tests after continuation: 6 passing.
- Webhook route tests after continuation: 3 passing.
- Checkout route tests after continuation: 10 passing.
- Paymob client tests after continuation: 2 passing.
- Database package typecheck passed previously. API typecheck passed after the latest backend changes.

These are historical focused results, not a claim that the present whole worktree is green. The complete build, lint, typecheck, API/storefront/ERP tests, two final full validation passes, and sandbox tests have not been completed.

## Scope

The only complete customer-facing checkout remains Cash on Delivery. A backend Paymob foundation now exists, but it is incomplete and disabled. The requested outcome is a production-grade Paymob flow alongside COD. Native mobile payment is not in scope; a future React Native client may reuse the same backend foundation.

No Paymob secrets may be committed, exposed to the storefront, logged, or included in this document.

## Confirmed product decisions

| Topic | Decision |
| --- | --- |
| Website checkout experience | Use the Paymob-hosted Unified Checkout. This is the selected safety/maintenance-first option for the custom website. |
| Cash on Delivery | Keep COD alongside Paymob. |
| Online order creation | A real order must be created only after Paymob payment succeeds. Before success, the system stores a checkout/payment session rather than an order. |
| Failed-payment retry | Allow at most three Paymob payment attempts for the same checkout session. After the third failed attempt, the customer must begin a new checkout. |
| Launch payment methods | Cards and Egyptian mobile wallets. Each remains disabled until its account-specific integration ID is confirmed. |
| Stock reservation | Reserve component stock when Paymob checkout starts; expire and restore it exactly once after 30 minutes if payment is not confirmed. |
| Shipping | Temporarily charge `0 EGP`; the future shipping-company integration is explicitly deferred and must replace this before paid shipping launches. |
| Refund operations | Use the Paymob dashboard for the first release; no Capella ERP refund action is in scope. |
| Mobile application | Not part of this implementation. Do not add React Native or Paymob mobile SDK work. |
| Production storefront | `https://capellacares.com` |
| Production API | `https://api.capellacares.com` |
| Production ERP | `https://erp.capellacares.com` |
| Local storefront | `http://localhost:3000` |
| Local API | `http://localhost:4000` |
| Local ERP | `http://localhost:3001` |

## Open product decisions

These questions were intentionally left unanswered and must remain open until the user has consulted the relevant people.

1. Paymob support must confirm whether test integration `5885253` (`VPC`) is the correct normal card/3DS integration before `PAYMOB_CARD_INTEGRATION_CONFIRMED` is enabled.
2. Paymob must enable/provide the account-specific Egyptian wallet test integration ID before `PAYMOB_WALLET_INTEGRATION_CONFIRMED` is enabled.
3. Live card and wallet integration IDs remain required before production activation.

Do not implement assumptions for these items.

### Stock reservation decision, resolved

Online payment is not instant. A customer may open Paymob, wait several minutes, close the page, or return after another customer has bought the last unit.

The resolved question was:

> When a customer leaves Capella to pay through Paymob, should Capella temporarily hold the cart items for that customer? If yes, for how many minutes should the hold last before the stock becomes available to other customers again?

The evaluated behaviors were:

- Reserve stock: temporarily remove the quantities from availability while payment is pending. A successful payment converts the reservation into the order. A failed or expired checkout returns the quantities exactly once.
- Do not reserve stock: leave quantities available until Paymob reports success. This avoids abandoned holds, but two customers can pay for the last unit and the later successful payment may have no stock to fulfill.

Confirmed behavior: reserve stock for 30 minutes from checkout initiation. Successful payment finalizes the reservation; terminal failure or expiry restores it exactly once. A successful callback received after stock was already released must not create an unfulfillable order and requires explicit reconciliation/refund handling.

## Verified Paymob integration model

Capella is a custom-built website. Paymob's current documentation directs custom websites to its API integration path.

The current Paymob flow is:

1. Capella's backend creates a payment intention.
2. The intention supplies the amount, currency, enabled payment integration IDs, customer/billing information, and Capella's internal reference.
3. Paymob returns a `client_secret` and identifiers used to open the checkout experience and correlate later callbacks.
4. The customer completes payment through Paymob Unified Checkout.
5. Paymob redirects the browser back to Capella for user experience.
6. Independently, Paymob POSTs a transaction-processed callback to Capella's backend.
7. Capella verifies the callback HMAC before trusting any value.
8. The verified backend callback, not the browser redirect, is the source of truth for payment success and business actions.

Relevant official documentation:

- [Integration paths overview](https://developers.paymob.com/paymob-docs/integration-paths/overview)
- [API integration flow](https://developers.paymob.com/paymob-docs/integration-paths/apis)
- [Intention APIs overview](https://developers.paymob.com/paymob-docs/developers/intention-apis/overview)
- [Create Intention API reference](https://developers.paymob.com/paymob-docs/create-intention)
- [Checkout experiences overview](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/overview)
- [Unified Checkout (redirection)](https://developers.paymob.com/paymob-docs/unified-checkout-redirection)
- [Pixel (embedded)](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded)
- [Transaction callbacks](https://developers.paymob.com/paymob-docs/manage-callback/transaction-callbacks)
- [HMAC overview](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac)
- [HMAC for transaction callbacks](https://developers.paymob.com/paymob-docs/hmac/hmac-transaction-callback)
- [Payment methods](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods)
- [Cards](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/cards-all-regions)
- [Egyptian mobile wallets](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/mobile-wallets-egy-ksa)
- [Managing payments](https://developers.paymob.com/paymob-docs/payments-and-features/managing-payments)
- [Getting integration credentials](https://developers.paymob.com/paymob-docs/need-help/faq/getting-integration-credentials)
- [Test credentials](https://developers.paymob.com/paymob-docs/need-help/faq/test-credentials)
- [Integration checklist](https://developers.paymob.com/paymob-docs/getting-started/integration-checklist)

### Intention API contract (verified)

Facts confirmed from the Create Intention API reference and Unified Checkout page:

- Endpoint: `POST {region-base}/v1/intention/`; for Egypt the base is `https://accept.paymob.com`. Test and live share the same base URL; mode is controlled by the keys and integration IDs used.
- Authentication: `Authorization: Token <secret_key>` header. The Secret Key never leaves the server.
- `amount` is the total transaction amount expressed in cents (minor units). `currency` must match the currency of the selected integration ID (`EGP` for Capella).
- `payment_methods` takes the enabled integration ID(s) (numeric IDs or method names). Their test/live status must match the Secret Key's mode; a wrong or misconfigured ID returns a documented 404.
- The merchant reference field is `special_reference`; Paymob returns it in transaction callbacks as `merchant_order_id`. This is where the per-attempt unique reference goes.
- `notification_url` (per-request transaction-processed callback override) is supported only with card integration IDs. `redirection_url` (per-request browser return override) is supported for card and wallet methods only. If wallets launch, the dashboard-configured Webhook URL on each integration ID is the reliable callback path, and the webhook endpoint must also tolerate card-token callbacks (used by pay-with-saved-card), not only transaction callbacks.
- Paymob documents that the `client_secret` is intention-specific and expires in about one hour; the intention also accepts an optional `expiration` field. Attempt/session expiry design must account for this: a retry after expiry requires a fresh intention, not a reused client secret.
- Response identifiers to persist: intention ID, Paymob order ID (`intention_order_id`), and `client_secret`.
- If `items` is sent, each item requires `name` and `amount`. `billing_data.phone_number` is required. The request schema must be re-validated against the current reference during implementation.
- Unified Checkout URL (Egypt): `https://eg.checkout.paymob.com/?publicKey={public_key}&clientSecret={client_secret}`. The Public Key is browser-visible by design; it is not a secret.

### Why Unified Checkout was selected

Paymob documents two web checkout experiences for an API integration:

- Unified Checkout redirects the customer to a Paymob-hosted checkout and is the lowest-effort web integration.
- Pixel embeds Paymob's payment UI into the merchant website and provides more presentation control with more frontend integration work.

Both keep sensitive payment data with Paymob, and both still require the same server-created intention, verified callback, and local payment state. Unified Checkout was selected because the user prioritized safety, correctness, and maintenance over keeping the payment UI embedded in Capella.

### Why a mobile SDK is not used here

Paymob documents its SDK path for native mobile applications. A future React Native app would ask the Capella API to create the intention, then initialize the Paymob mobile SDK with the returned intention reference. Even in that flow, Paymob says the backend callback remains the source of truth. Native mobile work is explicitly outside the current scope.

### Paymob callback facts that affect the design

Paymob distinguishes:

- Transaction Processed Callback: server-to-server POST containing JSON transaction details.
- Transaction Response Callback: browser-facing GET redirect containing query parameters.

Paymob documents key transaction fields including the transaction ID, `success`, `pending`, amount in minor units, currency, integration ID, Paymob order ID, refund state, void state, capture state, environment marker, and payment source. The exact callback contract used in code must be validated against the Paymob dashboard/account configuration and the current endpoint reference during implementation.

Every callback includes an HMAC query parameter. Capella must reproduce Paymob's documented field concatenation and SHA-512 HMAC calculation using the HMAC secret, then compare the received and calculated signatures with a timing-safe comparison. No callback field may change application state before this succeeds.

The documented HMAC input concatenates the values of these keys in this exact order: `amount_cents`, `created_at`, `currency`, `error_occured`, `has_parent_transaction`, `obj.id`, `integration_id`, `is_3d_secure`, `is_auth`, `is_capture`, `is_refunded`, `is_standalone_payment`, `is_voided`, `order.id`, `owner`, `pending`, `source_data.pan`, `source_data.sub_type`, `source_data.type`, `success`. For the server POST (processed) callback the transaction and order keys are `obj.id` and `order.id`; for the browser GET (response) callback they are `id` and `order_id`. This list must be re-confirmed against the live reference at implementation time, since Paymob can change the contract.

Payment actions are asymmetric per method and must not be assumed uniform: cards support void, full/partial refund, and capture (capture only for Auth/Cap flows); Egyptian wallets support full/partial refund only, with no void or capture. This constrains open decision 2 (refund scope) and any ERP-side payment action UI.

### Credentials and dashboard configuration

Paymob documents the following dashboard credentials/settings:

- Test and live Secret Keys; mode-specific.
- Test and live Public Keys; mode-specific. The Public Key appears in the Unified Checkout URL the browser is sent to, so it is browser-visible by design, but it should still be supplied from server-side configuration and not committed.
- API Key; the same value for test and live according to the credentials guide.
- HMAC Secret.
- One numeric integration ID for each enabled payment method and environment.
- Webhook URL per integration ID (the transaction processed callback destination; labeled "Webhook URL" in the dashboard).
- Redirect URL per integration ID (the transaction response browser-return destination; labeled "Redirect URL" in the dashboard).

The selected test/live Secret Key and integration IDs must belong to the same Paymob account and mode.

Credentials must be placed only in server-side environment files. The intended production callback locations are:

```text
Webhook: https://api.capellacares.com/api/v1/payments/paymob/webhook
Return:  https://capellacares.com/{lang}/checkout/payment-result
```

The exact return URL shape is provisional until route design is implemented. Local callback testing requires a publicly reachable HTTPS deployment or tunnel; Paymob cannot call `localhost`.

## Current Capella behavior

### Existing flow

```text
Storefront checkout form
  -> POST /api/v1/checkout
  -> optional customer authentication
  -> shared Zod COD-only validation
  -> duplicate service-level validation
  -> server loads and prices product/offer/collection lines
  -> database transaction decrements component stock
  -> order and item snapshots are inserted
  -> order paymentStatus is pending
  -> storefront immediately clears the cart and displays the order code
  -> authorized ERP staff manually set pending/accepted/denied
  -> setting denied restores stock and permanently locks the order
```

### Existing strengths to preserve

- Server-side catalog lookup and pricing; client prices are not trusted.
- Integer positive quantities enforced by the shared schema.
- Product, offer, and collection cart lines.
- Atomic conditional stock decrement prevents concurrent overselling during order insertion.
- Offer and collection stock is expanded to underlying variants.
- Order items snapshot names, sizes, prices, and applied discounts.
- Guest checkout and authenticated-customer checkout.
- The authenticated customer ID is derived from the verified token; a body-supplied ID is ignored.
- Denial restocks inside a database transaction and denied orders are locked against repeated restocking.
- Money helpers convert calculations through minor units rather than accumulating raw floating-point totals.

### Existing problems and incompatibilities

1. `paymentMethod` is fixed to `cod` in the database enum, shared constant, DTO, schema, form, repository input, and order types.
2. `paymentStatus = pending | accepted | denied` conflates payment outcome with staff order acceptance.
3. The storefront clears the cart and shows success as soon as the API inserts a COD order; that is invalid for online payment.
4. The generic authenticated mutation client refreshes and retries checkout after a `401`. Checkout has no idempotency key, so a retry can duplicate an order and stock decrement. A test currently asserts this unsafe behavior.
5. There is no checkout session, payment attempt, provider reference, webhook event, refund, void, capture, failure, or expiry persistence.
6. There is no Paymob client, intention endpoint, callback route, HMAC verification, browser-result route, or reconciliation operation.
7. Stock is committed immediately with order insertion and has no pending-payment expiration mechanism.
8. Online orders must only exist after payment success, so the current order-first persistence path cannot be reused unchanged.
9. The checkout controller converts every service/database failure to HTTP 400, obscuring internal failures and making retry behavior unsafe.
10. The API installs `express.json({ limit: "10mb" })` globally. Paymob's documented transaction HMAC is field-based, but the final callback implementation must follow the exact current Paymob HMAC field contract and must not assume generic raw-body signing.
11. ERP staff can manually set payment status. A Paymob success state must never be manually fabricated; verified provider events must own online-payment state.
12. ERP sales analytics currently counts all orders and all order items as sales/revenue regardless of `pending` or `denied` status.
13. Review eligibility and prompts currently depend on `orders.paymentStatus === "accepted"`; separating payment from fulfillment requires a deliberate replacement rule.
14. Customer order screens and ERP screens assume exactly three payment states and COD-only orders.
15. The product specification and README explicitly say online payments are out of scope and must be updated when the implementation is complete.
16. The mobile plan says checkout is unfinished/COD-only. Mobile implementation is not part of this work, but its upstream assumptions must be kept accurate when the web/API behavior changes.
17. ERP sales analytics has no collection expansion. Collection order items have a null `variantId`, so the analytics loop skips them entirely: their order total is included in revenue while their units and per-product/per-variant revenue are omitted.
18. Offer and collection contents are not snapshotted on the order. Stock deduction, later denial/restocking, and sales expansion query the bundle's current component rows. If staff edit bundle contents after checkout, Capella can restore and report different variants or quantities from those actually deducted and purchased.
19. Catalog pricing reads occur before the stock/order database transaction. Product prices, discounts, bundle prices, bundle contents, or entity status can change between price resolution and stock decrement/order insertion, producing a snapshot assembled from different database moments.
20. The storefront resolves display lines by independently refetching the complete product, offer, and collection catalogs. A line missing from those responses is removed from the displayed summary, but `placeOrder` still maps and submits every raw cart line. With a partial catalog response, the displayed total can be lower than the server-created order total.
21. Shipping is displayed as “calculated at checkout,” but neither checkout nor the order service calculates, stores, or adds a shipping fee. The displayed total and persisted total are goods subtotal only. A gateway integration cannot safely charge a final amount until the shipping policy/amount source is defined or the UI explicitly states shipping is zero.
22. Guest checkout is allowed, but the success view offers a “View my orders” link to an authenticated-only page. A guest cannot retrieve the order that was just created.
23. Checkout initiation currently has no dedicated rate limit or abuse control. An unauthenticated caller can repeatedly trigger catalog/database work and stock-decrementing order transactions.
24. Checkout input strings have minimum checks but no trimming/normalization or database-compatible maximum lengths. Whitespace-only values can pass the shared schema, overlong values can reach MySQL, and the controller exposes resulting error messages as client-visible 400 responses.
25. The global error middleware returns raw `Error.message` values in 500 responses. The checkout controller also returns raw caught errors. Provider/database details must not leak once Paymob is integrated.
26. The API workspace env loader stops loading the root env file whenever `DATABASE_URL` is already present. In a local process where only `DATABASE_URL` is injected externally and Paymob values remain in the root `.env`, the Paymob variables would silently never load. Tests currently assert this early-return behavior.
27. The sales tests explicitly lock in counting all payment statuses, including denied and pending orders. Correcting sales semantics requires updating both implementation and this existing asserted contract rather than only adding a new test.
28. Storefront legal copy already claims Visa/Mastercard online payments, payment validation, and card refunds while the implementation and canonical technical specification say online payment is out of scope. Customer-facing legal claims and actual behavior are currently inconsistent.
29. Current sales expansion uses the live catalog variant name/size and live offer composition instead of immutable order snapshots. Later catalog edits can rewrite the apparent historical sales breakdown even without a payment change.
30. The current ERP order detail renders one payment status as a raw enum in its hero area while the order list uses localized labels. The status model migration must remove this inconsistent presentation rather than extending it.
31. The checkout success copy says a confirmation was sent to the customer's phone, but the checkout path contains no SMS/phone notification integration. The legal text also discusses confirmation email behavior without a corresponding checkout notification implementation.
32. Egyptian phone numbers are validated in several accepted prefix forms but are stored without normalization. The same customer can therefore be represented as `01...`, `+201...`, or `00201...`, and Paymob billing data cannot receive one canonical form without an explicit normalization step.
33. The checkout page shows the canonical governorate values only in English even on the Arabic storefront. The stored canonical value may remain English, but the Arabic UI needs localized labels rather than changing the value sent to the API.
34. The database does not enforce several order invariants that payment conversion will rely on: positive item quantity, non-negative monetary values, line total consistency, exactly one item owner matching `itemType`, registered orders having a customer ID, or order total matching its lines. Application code currently provides the only protection.
35. Sales analytics uses floating-point accumulation/allocation and does not round allocated bundle revenue back to minor units. Even after filtering valid sales, per-variant totals can contain fractions that do not reconcile exactly at currency precision.
36. The public order-success path has no guest-safe lookup capability. Creating online orders only after a callback makes this more important because a guest needs an unguessable way to see the final result without exposing sequential order IDs.
37. The storefront footer already advertises Visa, Mastercard, and Paymob even though checkout only accepts COD. This is a visible payment-capability claim that does not match the application.
38. The current automated test suite does not contain checkout hook/form/view coverage. API checkout behavior is tested, but cart-to-form rendering, partial catalog resolution, submission, clearing, and success UI can regress without a component-level failure.

## Proposed Capella architecture

This section is a design proposal. It must not be treated as final where it depends on an open product decision or an exact Paymob endpoint contract not yet captured from the account-specific API explorer.

### Core separation

```text
checkout session
  owns customer/address/cart snapshot and up to three attempts

payment attempt
  owns one Paymob intention and its transaction lifecycle

order
  created from the immutable checkout snapshot only after verified success
  or created immediately for COD
```

This satisfies the confirmed requirement that failed Paymob attempts must not create real orders.

### Suggested state models

Checkout session states:

```text
open | payment_pending | completed | failed | expired
```

Payment attempt states:

```text
created | pending | succeeded | failed | cancelled | expired
```

Refund/capture states must remain separate or be represented by additional fields/events if first-release refunds are approved. The final status vocabulary must be based on the exact Paymob transaction semantics used by the enabled integrations.

Order operational state and payment state must not be conflated. The current `accepted` and `denied` meanings need a product-level rename/migration into an order/fulfillment status. COD retains a pending payment state until the business confirms collection; Paymob success is set only by the verified provider callback.

### Data that must be persisted

Checkout session:

- Unpredictable public identifier.
- Optional authenticated customer ID and guest/registered classification.
- Contact and delivery snapshot.
- Cart-line snapshot and authoritative server price snapshot.
- Total amount in integer minor units and currency `EGP`.
- Attempt count with a database-enforced or transactionally enforced maximum of three.
- State, timestamps, and reservation expiration if reservation is selected.
- Created order ID after successful conversion.
- Client idempotency key with an appropriate uniqueness scope.

Payment attempt:

- Checkout session ID.
- Provider (`paymob`).
- Attempt number.
- Merchant reference unique to the attempt.
- Amount in minor units and currency.
- Paymob intention ID.
- Paymob order ID (`intention_order_id` where supplied by the current response contract).
- Paymob transaction ID.
- Integration ID and resolved payment source/method.
- Test/live marker.
- Status and provider failure information.
- Creation, update, completion, and expiration timestamps.
- Unique constraints for merchant reference and every stable Paymob identifier.

Webhook event/audit record:

- Provider and event/transaction identity.
- Receipt time and processing result.
- Sanitized payload or the minimum fields required for audit and replay analysis.
- Unique event identity so duplicate delivery is harmless.
- Never persist secrets or unneeded sensitive payment data.

Order:

- Payment method expanded beyond COD.
- Separate payment and operational/fulfillment status.
- Link to the successful payment attempt for Paymob orders.
- Existing customer, address, total, and item snapshots copied from the checkout session exactly once.

### Checkout initiation

The online initiation API should:

1. Validate the shared checkout request.
2. Authenticate optionally using the existing guest/customer rules.
3. Resolve every cart line and calculate authoritative prices on the server.
4. Create or reuse an idempotent checkout session.
5. Apply the selected stock strategy transactionally.
6. Atomically allocate attempt 1-3; refuse attempt 4.
7. Create a unique merchant reference.
8. Call Paymob's current Intention API from the server using test credentials initially.
9. Send the server-calculated amount, `EGP`, selected integration IDs, customer/billing fields, `special_reference` (the per-attempt merchant reference), notification URL, and redirection URL using the exact current Paymob request schema. Remember Paymob's per-request URL caveats: `notification_url` is card-only and `redirection_url` is card/wallet only, so dashboard-configured URLs on each integration ID remain the fallback and must always be set.
10. Validate Paymob's response before storing its identifiers.
11. Return only the public checkout information needed to redirect the browser. Never return a server Secret Key, API Key, or HMAC Secret.

The local database and remote Paymob API cannot share one transaction. The implementation needs an explicit recovery state for a local attempt created before a Paymob timeout/error, and idempotent reuse must prevent an ambiguous response from creating uncontrolled duplicate attempts.

Because the `client_secret` expires in about one hour, each attempt should create its own intention, and a checkout session or payment attempt that outlives its intention's validity must move to an expired state rather than reusing a stale client secret.

### Paymob webhook

The webhook must:

1. Accept Paymob's transaction-processed POST callback at a public HTTPS API route.
2. Validate the request shape without discarding fields required by Paymob's HMAC algorithm.
3. Recreate the documented HMAC input in the documented field order.
4. Compute SHA-512 HMAC with the server-only HMAC Secret.
5. Compare signatures using `crypto.timingSafeEqual` after validating equal lengths/encoding.
6. Return an authentication error without changing state when verification fails.
7. Correlate by stored Paymob identifiers and merchant reference; never trust a customer-provided local order ID alone.
8. Verify amount, `EGP` currency, integration ID allowlist, and test/live mode against the stored attempt.
9. Deduplicate by Paymob transaction/event identity.
10. Lock the checkout session/payment attempt rows before applying a transition.
11. On verified success, create the order and items exactly once from the immutable checkout snapshot, finalize stock according to the selected stock strategy, link the order to the successful attempt, and mark the session completed in one database transaction.
12. On a terminal failure, mark the attempt failed and restore any reservation exactly once. Keep the checkout session retryable while fewer than three attempts have been used.
13. Record refund/void/capture changes without interpreting them as a new sale.
14. Acknowledge successfully processed or already-processed callbacks with 2xx.

The handler must tolerate callbacks that are duplicated, delayed, or delivered after the browser redirect.

### Browser return and status

The redirect page must not trust callback query parameters to create an order or mark payment successful.

```text
Paymob redirects browser
  -> Capella payment-result page reads only an opaque checkout reference
  -> page asks Capella API for the local checkout/payment result
  -> succeeded: show order confirmation and clear the cart
  -> failed with attempts remaining: show retry action
  -> failed after attempt 3: require new checkout
  -> pending: show confirmation-in-progress and allow an explicit refresh/status check
```

Normal application behavior must not continuously poll Paymob. If a verified callback is missing, a controlled reconciliation operation may use Paymob's documented transaction inquiry capability; its precise operational trigger is still to be designed.

### COD branch

COD remains a local flow and does not call Paymob. It may continue creating an order immediately, but it must use the redesigned order/payment/operational state vocabulary and the same authoritative pricing and idempotency safeguards.

### Three-attempt rule

The limit belongs to the checkout session, not the final order, because the confirmed requirement says an online order does not exist before success.

```text
checkout session
  attempt 1 -> terminal failure
  attempt 2 -> terminal failure
  attempt 3 -> terminal failure
  session locked/failed -> customer must start a new checkout
```

Pending, duplicated, or ambiguous callbacks must not consume additional attempt numbers. Attempt allocation must be serialized in the database.

## Security and correctness requirements

- Store all Paymob secrets server-side only and fail closed when required production secrets are absent.
- Use test credentials and test integration IDs during development.
- Never trust client totals, currency, status, provider IDs, or success flags.
- Never trust the browser redirect as proof of payment.
- HMAC-verify every processed and response callback before using its fields; only the processed server callback may drive business state.
- Compare money as integer minor units.
- Allowlist integration IDs and expected environment.
- Use database uniqueness and row locking for initiation, attempt allocation, callback handling, order creation, and stock restoration.
- Make checkout initiation idempotent and disable automatic replay after `401` or ambiguous network failure.
- Prevent staff from manually setting a Paymob payment to succeeded.
- Sanitize logs and stored callback payloads.
- Define timeouts for outbound Paymob requests and preserve an inspectable recovery state after timeout.
- Do not store raw card data, CVV, full PAN, payment tokens not explicitly required, or Paymob secrets.
- Rate-limit public initiation/status routes without blocking Paymob callback delivery.
- Preserve guest privacy: status endpoints must use an unguessable capability/reference and expose only necessary information.
- Create alerts/logging for invalid HMAC, amount/currency mismatch, unknown integration ID, unmatched callback, and repeated internal processing failure.

## Repository-wide impact map

The following map is based on a repository-wide filename and content search for checkout, order, payment, status, transaction, webhook, stock, sales, and review dependencies. Paths marked "new" do not exist yet; exact names may change during implementation while preserving module boundaries.

### Database package

- `packages/database/drizzle/schema.ts`: expand the order model; add checkout sessions, checkout line snapshots, payment attempts, webhook events, idempotency uniqueness, and reservation data after the stock decision.
- `packages/database/drizzle/migrations/<next>_*.sql`: generated migration for the new schema and careful data migration from COD-only enums.
- `packages/database/drizzle/migrations/0000_glamorous_proudstar.sql` and `0001_handy_advices.sql`: historical sources of the original COD/payment enums; inspect for migration history only and never rewrite them.
- `packages/database/drizzle/migrations/meta/_journal.json`: updated by the migration generator.
- `packages/database/drizzle/migrations/meta/<next>_snapshot.json`: generated snapshot; historical migrations/snapshots must not be edited.
- `packages/database/src/seeds/test.seed.ts`: update seeded orders/statuses and add payment-session fixtures only where tests require them.
- `packages/database/tests/integrity.test.ts`: add foreign-key, uniqueness, state, attempt-count, and money constraints.
- `packages/database/tests/test-seed-source.test.ts`: update if the seed contract changes.
- `packages/database/scripts/run-test-migrations.mjs`: expected to remain structurally unchanged but participates in validating the new migration.

### Shared package

- `packages/shared/src/constants/payment-methods.ts`: add the decided Paymob-facing method representation while retaining COD; do not add undecided methods prematurely.
- `packages/shared/src/schemas/checkout.schema.ts`: accept the selected payment option and reject client-owned provider/status/amount fields.
- `packages/shared/src/schemas/index.ts`: continue exporting the updated schema.
- `packages/shared/src/dto/checkout.dto.ts`: change initiation/result DTOs to represent COD completion versus Paymob redirect/session creation.
- `packages/shared/src/dto/order.dto.ts`: expose the separated order/payment state and safe payment summary.
- `packages/shared/src/dto/index.ts`: export new DTOs.
- `packages/shared/src/types/index.ts`: replace COD-only order types and the conflated payment status; add safe checkout/payment result types.
- `packages/shared/src/i18n/en.ts`: add payment choice, redirection, pending confirmation, failure, retry-count, exhausted-attempt, and status copy; revise review/payment wording.
- `packages/shared/src/i18n/ar.ts`: Arabic equivalents for every new customer-facing state and revised review/payment wording.
- `packages/shared/tests/*`: add schema/type/i18n contract coverage for all new states and ensure Arabic/English keys remain aligned.

### API checkout and payment modules

- `apps/api/src/modules/checkout/checkout.routes.ts`: route the redesigned initiation and safe status/retry endpoints.
- `apps/api/src/modules/checkout/checkout.controller.ts`: return correct status codes and distinguish validation, conflict, provider, and internal failures.
- `apps/api/src/modules/checkout/checkout.schemas.ts`: parse the updated shared contract and route/query identifiers.
- `apps/api/src/modules/checkout/checkout.service.ts`: orchestrate idempotent session creation, attempt allocation, COD branching, and Paymob initiation.
- `apps/api/src/modules/payments/paymob/*` (new): typed Paymob client, configuration, request/response validation, HMAC verifier, callback controller/service/routes, and provider-to-domain transition mapping.
- `apps/api/src/repositories/checkout/*` (new): checkout session, snapshots, attempts, events, idempotency, and transactional state changes.
- `apps/api/src/routes/storefront.routes.ts`: mount public payment callback/status routes under the existing storefront boundary.
- `apps/api/src/app.ts`: confirm middleware order and callback parsing behavior against the exact Paymob HMAC contract.
- `apps/api/src/types/domain.ts`: map the revised shared DTOs/types.
- `apps/api/src/config/env.ts`: parse non-secret Paymob configuration and public return/callback bases if appropriate.
- `apps/api/src/config/secrets.ts`: fail closed for required Paymob production secrets without exposing values.
- `apps/api/src/middlewares/rate-limit.middleware.ts`: apply suitable limits to initiation/status routes while keeping callbacks reliable.
- `apps/api/src/lib/async-route.ts` and error middleware: use the existing async/error conventions instead of converting all failures to 400.

### API order, inventory, sales, and review integrations

- `apps/api/src/modules/orders/orders.service.ts`: split reusable authoritative pricing/snapshot work from immediate order creation; create an online order only from a verified successful session.
- `apps/api/src/modules/orders/money.ts`: reuse minor-unit conversions and add explicit safe conversion helpers if needed.
- `apps/api/src/repositories/order/write.ts`: separate stock reservation/finalization/restoration from COD creation; remove manual mutation of provider-owned payment success; retain exactly-once stock behavior.
- `apps/api/src/repositories/order/read.ts`: expose separated statuses/payment summary and exclude unpaid/cancelled/failed orders from sales revenue and units.
- `apps/api/src/repositories/order/shared.ts`: update shared order repository mappings/status sets.
- `apps/api/src/repositories/order.repository.ts`: export the redesigned operations.
- `apps/api/src/modules/orders/orders.controller.ts`: replace the conflated manual payment-status endpoint with allowed operational transitions and read-only Paymob state.
- `apps/api/src/modules/orders/admin-orders.routes.ts`: update routes and permission enforcement for the new controls.
- `apps/api/src/modules/orders/orders.routes.ts`: return the new safe customer order contract.
- `apps/api/src/modules/inventory/bundle-inventory.ts`: verify bundle availability against the selected reservation model.
- `apps/api/src/repositories/review.repository.ts`: replace `paymentStatus === accepted` with the explicitly chosen paid/fulfilled eligibility rule.
- `apps/api/src/services/erp-permissions.service.ts`: rename or replace `orders.update_payment_status` if it now controls operational status, and add refund permission only if ERP refunds enter scope.

### Storefront

- `apps/storefront/src/hooks/use-checkout.ts`: submit the selected method, preserve cart/session state across redirect, handle COD completion separately, and clear the cart only after verified online success.
- `apps/storefront/src/types/checkout-view.types.ts`: add method, session, redirect, pending, failure, and retry states.
- `apps/storefront/src/components/checkout/checkout-form.tsx`: retain COD and add the decided Paymob choice(s); prevent double submission.
- `apps/storefront/src/components/checkout/checkout-summary.tsx`: display the authoritative checkout total and any payment-specific copy without suggesting the client controls the charge.
- `apps/storefront/src/components/checkout/checkout-view.tsx`: replace immediate online success with redirect/pending/failure behavior.
- `apps/storefront/src/app/[lang]/checkout/page.tsx`: retain the initiation page and metadata.
- `apps/storefront/src/app/[lang]/checkout/payment-result/page.tsx` (new): render server-confirmed payment status and retry navigation.
- `apps/storefront/src/lib/api/client.ts`: add typed initiate/status/retry operations and change the checkout result contract.
- `apps/storefront/src/lib/api/client/http.ts`: support mutation-level `retryOn401: false`; checkout/payment initiation must never be automatically replayed.
- `apps/storefront/src/lib/cart.ts` and `apps/storefront/src/components/providers/cart-provider.tsx`: preserve the cart through redirect and clear it only when the matching checkout is confirmed.
- `apps/storefront/src/components/orders/order-presentation.tsx`: map separated order/payment states and chips.
- `apps/storefront/src/components/orders/orders-view.tsx`: display the new order/payment summary correctly.
- `apps/storefront/src/components/orders/order-detail-view.tsx`: display method and safe payment state; keep review eligibility consistent.
- `apps/storefront/src/app/[lang]/orders/page.tsx` and `apps/storefront/src/app/[lang]/orders/[id]/page.tsx`: consume the revised order contract.
- `apps/storefront/src/components/cart/cart-view.tsx`: ensure navigation/payment copy remains correct.
- `apps/storefront/src/components/layout/footer.tsx`: keep displayed payment brands aligned with methods that are genuinely enabled in production; it currently advertises Paymob/cards before they work.
- `apps/storefront/src/components/ui/icons.tsx`: retain only the payment marks actually used by the footer/checkout and verify accessible labels.
- `apps/storefront/src/components/products/product-detail.tsx`, `apps/storefront/src/components/offers/offer-detail.tsx`, and `apps/storefront/src/components/collections/collection-detail.tsx`: verify Buy Now behavior survives the redirect/session lifecycle.
- `apps/storefront/src/lib/seo.ts` and result-page metadata/robots handling: prevent payment-result URLs or sensitive query data from being indexed.

### ERP

- `apps/erp/src/lib/payment-status.ts`: map the new payment states and separate operational states.
- `apps/erp/src/lib/store/types.ts`: update sales and payment/order DTO shapes.
- `apps/erp/src/lib/store/normalizers.ts`: normalize new monetary/status/payment attempt fields.
- `apps/erp/src/lib/store/core.ts`: remove generic manual Paymob success mutation; add permitted operational actions and optional refund action only if approved.
- `apps/erp/src/app/orders/page.tsx`: update filters, columns, and chips for separated statuses/methods.
- `apps/erp/src/components/orders/order-details-view.tsx`: show Paymob identifiers, method, amount/currency, environment, failure/refund state, and attempt history without exposing secrets; do not allow manual Paymob success.
- `apps/erp/src/app/orders/[id]/page.tsx`: consume the revised detail contract.
- `apps/erp/src/app/sales/page.tsx`: display only correctly recognized sales and revised payment labels.
- `apps/erp/src/components/admin/staff-editor-form.tsx`: update the visible permission catalog if the payment-status permission is renamed or replaced.
- Staff editor and permission presentation that currently exposes `orders.update_payment_status`: update if the permission is renamed/replaced.

### API tests

- `apps/api/tests/unit/checkout.schemas.test.ts`: payment-option and forbidden-field validation.
- `apps/api/tests/unit/checkout.service.validation.test.ts`: service invariants and attempt limit.
- `apps/api/tests/services/checkout.service.test.ts`: COD, Paymob session creation, authoritative pricing, idempotency, reservations, and no-order-before-success.
- `apps/api/tests/routes/checkout.routes.test.ts`: initiation/status/retry route contracts and authentication behavior.
- New Paymob client tests: exact request mapping, minor units, credentials, timeouts, error mapping, and sanitized failures.
- New HMAC tests: official field order, valid/invalid signatures, type normalization, timing-safe comparison, and missing fields.
- New webhook route/service tests: duplicate callbacks, success, pending, failure, amount/currency/integration/environment mismatch, unknown transaction, late callback, out-of-order callback, attempt exhaustion, and exactly-once order creation/stock transition.
- `apps/api/tests/repositories/order.repository.test.ts`: successful-session conversion and COD behavior.
- `apps/api/tests/repositories/order.payment-status.repository.test.ts`: replace conflated status mutation/restock expectations.
- `apps/api/tests/routes/order-payment-status.route.test.ts`: update or replace manual-payment route coverage.
- `apps/api/tests/routes/orders.routes.test.ts`: revised customer/admin order response contracts.
- `apps/api/tests/routes/sales.routes.test.ts`: assert failed, unpaid, denied, or cancelled activity is excluded from sales.
- `apps/api/tests/routes/reviews.routes.test.ts` and repository review tests: assert the new review-eligibility rule.
- `apps/api/tests/contracts/storefront-contracts.test.ts`: revised checkout/order/payment response contracts.
- `apps/api/tests/helpers/database.ts`: reset all new payment/session/event tables in foreign-key-safe order and expose needed fixture IDs.
- `apps/api/tests/unit/load-workspace-env.test.ts`: Paymob environment discovery if workspace env loading changes.
- Order/payment fixture updates are also required in `apps/api/tests/routes/admin-auth.routes.test.ts`, `admin-collections.routes.test.ts`, `admin-offers.routes.test.ts`, `admin-products.routes.test.ts`, `admin-reviews.routes.test.ts`, `admin-staff-management.routes.test.ts`, `erp-permissions.routes.test.ts`, and `storefront-card-ratings.routes.test.ts` wherever the migrated order columns are inserted or asserted.
- Permission-catalog fixture updates are required in `apps/api/tests/services/admin-auth.service.test.ts`, `apps/api/tests/services/erp-permissions.service.test.ts`, and the relevant admin authorization route tests if `orders.update_payment_status` is replaced.
- `apps/api/tests/repositories/review-rating.repository.test.ts`: update order fixtures and review eligibility for separated payment/operational states.

### Storefront tests

- `apps/storefront/tests/unit/api-client.test.ts`: reverse the current checkout-401 retry assertion and test initiation/status/retry contracts.
- `apps/storefront/tests/unit/payment-status-chip.test.ts`: new separated statuses.
- Checkout hook/component tests (new or existing location): method selection, double-click prevention, redirect, pending, failure, retry limit, COD, cart preservation, and clear-on-confirmed-success.
- `apps/storefront/tests/components/orders-view.test.tsx`: revised state labels.
- `apps/storefront/tests/components/order-detail-view.test.tsx`: method/payment details and review eligibility.
- `apps/storefront/tests/components/order-page.test.tsx`: revised page/dictionary contract where needed.
- `apps/storefront/tests/components/cart-view.test.tsx`: checkout navigation remains correct.
- `apps/storefront/tests/contracts/storefront-client.contract.test.ts`: safe client-visible payment shapes.
- Add an end-to-end sandbox flow where Paymob test infrastructure is available; do not make the ordinary unit suite depend on Paymob network availability.

### ERP tests

- `apps/erp/tests/orders-page.test.tsx`: method/status filters and labels.
- `apps/erp/tests/order-detail-page.test.tsx`: provider state is read-only, operational actions obey permissions, and payment attempt details render safely.
- `apps/erp/tests/sales-page.test.tsx`: failed/unpaid orders do not inflate totals.
- `apps/erp/tests/store.test.ts`: revised DTO loading and allowed mutations.
- `apps/erp/tests/staff-edit-page.test.tsx` and `apps/erp/tests/staff-management-page.test.tsx`: permission rename/addition if applicable.

### Deployment and documentation

- `.env.example`: document placeholder Paymob variables only; never real values.
- Local `.env`, `.env.docker`, and production `.env.production`: user-managed secrets, untracked.
- `docker-compose.yml`: pass Paymob server-only variables to the API container only; storefront and ERP must not receive secrets.
- `Dockerfile.api`: expected to need no special payment dependency behavior, but the API build must include any newly added package.
- `Dockerfile.storefront` and `Dockerfile.erp`: no Paymob secrets; public configuration only if the selected checkout URL construction genuinely requires it.
- `docs/deploy.md`: document required Paymob variables, callback URLs, test/live mode, migration/deploy order, and post-deploy callback verification.
- `README.md`: replace the COD-only/out-of-scope statement after implementation is complete and link this plan.
- `docs/specs/storefront-erp-spec.md`: update the canonical checkout, order, payment, stock, ERP, sales, and out-of-scope sections after decisions are final.
- `docs/specs/folder-structure.md`: add the final payment modules, repositories, routes, tests, and shared files after implementation.
- `docs/specs/mobile-app-plan.md`: keep mobile implementation deferred, but update its claim that upstream web/API checkout is COD-only or unfinished after the new flow works.
- Reverse-proxy/DNS configuration outside this repository: ensure `https://api.capellacares.com` publicly serves the callback without browser authentication or redirect interference.

## Environment variable plan

Final names must follow the existing env-loading conventions and may be adjusted during implementation. The API will need server-only equivalents of:

```env
PAYMOB_SECRET_KEY=
PAYMOB_PUBLIC_KEY=
PAYMOB_API_KEY=
PAYMOB_HMAC_SECRET=
PAYMOB_CARD_INTEGRATION_ID=
PAYMOB_CARD_INTEGRATION_CONFIRMED=false
PAYMOB_WALLET_INTEGRATION_ID=
PAYMOB_WALLET_INTEGRATION_CONFIRMED=false
PAYMOB_MODE=test
PAYMOB_NOTIFICATION_URL=https://api.capellacares.com/api/v1/payments/paymob/webhook
PAYMOB_REDIRECTION_URL=https://capellacares.com/en/checkout/payment-result
```

Do not add a variable until the exact current Paymob endpoint contract proves it is used. In particular, credential availability in the dashboard does not by itself prove every key belongs in every Intention API request.

The bilingual return route may require a locale-neutral redirect endpoint that subsequently routes to Arabic or English; this remains an implementation detail to resolve without duplicating Paymob integration configuration.

## Validation and release gates

Before implementation, capture the repository's complete build, lint, typecheck, and test baseline as required by `AGENTS.md`.

Implementation must finish with:

- Database migration tests passing from an empty database and an existing migrated database.
- Shared type/schema tests passing.
- Complete API tests passing.
- Complete storefront tests passing.
- Complete ERP tests passing.
- Build, lint, and typecheck passing for all affected workspaces.
- The complete applicable validation suite run twice after reaching green.
- Paymob sandbox success, decline, cancellation/abandonment, duplicate callback, delayed callback, and invalid-HMAC scenarios validated.
- Three-attempt behavior validated concurrently, not only sequentially.
- Stock reservation/finalization/restoration validated concurrently after the stock decision is made.
- No real secret present in Git, browser bundles, logs, responses, fixtures, or screenshots.
- Production callback endpoint reachable over HTTPS.
- Paymob dashboard integration mode matches deployed credentials and integration IDs.
- A real low-value live payment validated only after Paymob technical/business approval and deliberate live credential configuration.

## Paymob onboarding state

Current state (this supersedes the historical checklist immediately below): dashboard/test access and local credentials exist; cards and Egyptian wallets are selected; reservation is 30 minutes; shipping is temporarily `0 EGP`; and refunds are Paymob-dashboard-only. Integration `5885253` is labelled `VPC` and remains unconfirmed as the correct card/3DS integration. Paymob still needs to confirm it and enable/provide the account-specific wallet test integration. Both confirmation flags must remain false until then. Public HTTPS callback/redirect deployment and same-account/test-mode verification are also still required.

### Original onboarding inputs (recorded for traceability)

These are status records, not a fresh request for already-provided information:

1. Paymob merchant dashboard/test access: provided.
2. Test Secret Key, Test Public Key, API Key, and HMAC Secret stored locally—not pasted into chat or committed.
3. Numeric test integration IDs: VPC `5885253` provided but not confirmed as the correct card integration; wallet still missing.
4. Same-account/test-mode confirmation: still required for each integration that will be enabled.
5. Stock reservation duration: resolved at 30 minutes.

Needed later for live launch:

1. Paymob paperwork, contract, risk, test validation, and technical approval completed according to Paymob's integration checklist.
2. Live Secret/Public credentials and live integration IDs stored in production secrets.
3. Production webhook and redirect configuration applied to the live integrations.
4. First-release refund operations: resolved as Paymob-dashboard-only; production operating instructions are still required.

## Explicit non-goals for the current implementation

- React Native or any other mobile SDK integration.
- Saved cards, card token storage, recurring payments, merchant-initiated transactions, or subscriptions.
- Auth/capture unless explicitly requested and approved later.
- Apple Pay certificates/domain verification unless Apple Pay is explicitly selected later.
- BNPL, kiosk, POS, Tap to Pay, Payment Links, or platform plugins unless explicitly added to scope.
- Manual trust of redirect parameters or client-reported success.

## Next step

Resume from the existing unfinished TDD slices; do not restart the integration or regenerate the existing migrations blindly.

1. Finish callback edge cases and concurrency tests: out-of-order decline/success/refund, mismatched identifiers, third-attempt exhaustion, and late paid success. Expose durable reconciliation cases to ERP operations.
2. Resolve ambiguous Intention request failures after reservation without creating duplicate Paymob intentions; add positive HTTP retry-route and terminal-status coverage.
3. Complete shared DTOs and the storefront availability, selection, redirect, status, retry, cart, translation, and payment-result flows. The 401 non-replay test was changed but its running test command has not yielded a result under the no-poll rule; do not implement that slice without observing red.
4. Finish customer-order, ERP, sales, review, and dashboard-only refund presentation. A paid Paymob order can no longer be denied in ERP before full refund, and denied orders are excluded from sales totals; remaining rules still need verification.
5. Finish deployment/documentation wiring, run the complete validation suite twice, and validate all sandbox scenarios. Do not enable cards or wallets before their account-specific integrations are confirmed.
