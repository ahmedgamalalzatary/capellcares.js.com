# Paymob, Checkout, and Orders — Verified Audit

**Verified:** 2026-09-20  
**Follow-up review:** 2026-09-20 (post-fix pass; new findings appended at the end)
**Code revision:** `f784785`  
**Scope:** Paymob initiation and callbacks, checkout reservations/retries/status, COD and Paymob order lifecycle, storefront checkout/result UX, ERP order and reconciliation views, database constraints, and related tests.  
**Method:** Direct inspection of the current repository. This document corrects the earlier adversarial report; no production exploit testing was performed.

## Executive summary

### Implementation update — 2026-09-20

The user approved fixes for executive items 1–4 and 6–10; item 5 remains intentionally out of scope because reconciliation cases are already durably marked. The approved items are now implemented:

- Early callbacks fall back to the verified Paymob merchant reference when the Paymob order ID has not been saved yet.
- Card/wallet intentions always include the processed callback URL.
- Pending COD orders expire after 48 hours and automatically return stock.
- COD and Paymob checkout both require idempotency; concurrent COD replays return the winning order.
- Expired Paymob attempts become terminal with `RESERVATION_EXPIRED`.
- Successful Paymob orders become operationally `accepted`.
- The backend rejects manual `pending`/`accepted` changes for Paymob orders.
- The storefront refuses incomplete catalog summaries and sends the displayed amount; the API rejects checkout if current server pricing differs.
- Checkout creation, status, retry, and Paymob webhook routes have dedicated rate limits.
- Mobile checkout transports the same idempotency key across authentication retry.

Migration `0045_plain_scalphunter.sql` adds COD idempotency fingerprints and expiry timestamps. Migration `0046_powerful_pepper_potts.sql` expands bundle size snapshots and indexes recurring COD expiry lookups.

Original priority list (resolved items are recorded above):

1. **Webhook-before-persistence race:** Paymob can send a callback after creating an intention but before `paymobOrderId` is saved locally. The callback is unmatched, recorded as rejected, answered with `202 { received: true }`, and is absent from the reconciliation queue.
2. **Wallet callback dependency:** mixed card/wallet intentions omit the per-request `notification_url`. Wallet fulfillment therefore depends on the callback configured correctly in the Paymob dashboard.
3. **COD stock and duplicate-order abuse:** anonymous COD requests immediately decrement stock, have no TTL/automatic cancellation, no rate limit, and no idempotency protection.
4. **No reconciliation operation:** `reconciliation_required` is durable and visible in a read-only ERP list, but there is no worker, alert, pagination, or audited fulfill/refund/resolve action.
5. **Unsafe order-state API:** the backend can mark Paymob orders `pending` or `accepted` manually, and COD transitions are not governed by a proper state machine or audit log.
6. **Storefront/server mismatch:** unresolved cart lines may be hidden from the summary but still submitted, and displayed catalog prices may be stale relative to server pricing.
7. **Public checkout operations and unbounded polling:** checkout status/retry use an unguessable UUID but are not bound to the customer or a guest token. Failed and reconciliation states can poll indefinitely.
8. **Missing abuse controls:** checkout, retry, status, and webhook routes have no suitable rate/body limits.

## Corrected claims

The following claims from the earlier report are **not valid for the current code**:

- **Concurrent duplicate webhooks do not create two orders.** `processPaymobTransaction()` locks the matching payment-attempt row with `SELECT ... FOR UPDATE`. A second callback waits, then sees the succeeded attempt and existing order. Recording the webhook event after fulfillment remains an audit/recovery design weakness, not the claimed double-order race.
- **Paymob denial does not restore current catalog variants.** It restores the original checkout reservations. The existing repository test specifically verifies correct restoration after bundle catalog drift.
- **There is no current open redirect through `checkoutUrl`.** Production code constructs the URL using the fixed `https://eg.checkout.paymob.com` origin. A hostname assertion would still be useful defense in depth.
- **Concurrent refund callbacks do not regress the refund amount.** They serialize on the locked payment-attempt row, and the order update only accepts a larger cumulative refund.
- **The alleged float round-trip does not reject a genuine callback.** The same integer-cent value sent to Paymob is persisted on the attempt and used for callback validation.

## Verified critical findings

### Resolved findings

- **V1:** early callbacks can recover the attempt through the verified merchant/special reference before `paymobOrderId` is persisted.
- **V2:** card-only, wallet-only, and mixed intentions include `notification_url`; the dashboard callback remains required on both integrations.
- **V3/V4:** pending COD stock expires after 48 hours, abuse limits apply, and required idempotency prevents duplicate orders.
- **V6:** expiry changes only `created`/`pending` attempts to `expired` and preserves terminal states.
- **V7:** a verified successful Paymob payment creates an operationally accepted order.
- **V8:** the backend rejects manual `pending` or `accepted` overrides for Paymob orders.
- **V9:** unresolved catalog lines block submission, the displayed amount is submitted, and the API rejects changed server pricing.
- **V10:** dedicated checkout, status, retry, and webhook rate limits are implemented. UUID ownership/guest-token hardening and polling limits remain separate high-priority work below.

### V5 — Reconciliation is durable but operationally stranded

The system records `reconciliation_required` and exposes a read-only ERP list. It has no background consumer, SLA alert, provider inquiry, resolution action, audit trail, or pagination.

This affects late success after expiry, early refund followed by expiry, surplus/stale-attempt payments, and other ambiguous provider states.

## Verified high-priority findings

- Paymob repeat callbacks after success skip complete identity validation unless they represent a refund.
- A success for an older attempt can win after a retry and create a surplus capture requiring reconciliation; only one local order is created.
- A post-success decline or void is masked by the early “already succeeded” branch.
- Same-idempotency-key concurrent initiation uses check-then-insert; the unique-key loser is not converted into an idempotent response.
- Recycling a failed checkout deletes its session and attempts with cascade, potentially removing a provider mapping that is still useful for late callbacks.
- Ambiguous initiation failures remain pending for a verified callback or reservation expiry. The API does not call Paymob's unsupported `GET /v1/intention/?special_reference=...` endpoint.
- Guest orders have no authenticated or guest-token detail lookup; the payment result only exposes the final order code.
- The ERP order detail component conditionally returns before `useEffect`, violating React hook ordering when permissions change during the component lifetime.
- COD has no customer cancellation, return, or refund lifecycle.
- COD operational transitions allow `pending ↔ accepted`; denial is terminal, but there is no transition matrix or actor audit.
- Changing a COD order to denied restocks it without a separate fulfillment/shipping state, so already fulfilled stock can be restored.
- Storefront pending checkout state is per-tab `sessionStorage`; opening the return URL in another tab or losing storage produces “no checkout”.
- COD success is held only in component state; refreshing loses the receipt confirmation.
- Checkout fields remain editable while submission is running, catalog readiness is not required, and raw API errors are shown to customers.
- `crypto.subtle` and `crypto.randomUUID` are assumed. Production HTTPS and localhost provide them, but unsupported/insecure browser contexts fail generically.

## Verified medium findings

- HTTP 429 from Paymob is treated as a definitive rejection and releases stock; throttling should be treated as ambiguous/retryable.
- The webhook fingerprint omits amount, currency, creation time, merchant reference, and raw payload hash.
- `merchant_order_id` is not checked against the attempt’s `merchantReference` during normal callback validation.
- A `pending: true` callback receives HTTP 200. This may be acceptable if Paymob always sends a separate final callback, but that contract is not proven.
- Callback and redirect environment variables are checked only for presence, not HTTPS scheme or expected host.
- Paymob error response bodies and correlation information are discarded.
- Checkout error responses have inconsistent shapes and can expose internal error text as client-facing 400 messages.
- Expired attempts are not transitioned to `expired` or `cancelled`.
- Repository-level validation does not independently reject empty reservation lists, although current checkout callers normally produce positive reservations.
- Time is sampled multiple times during initiation; retry expiration can become zero/negative if the provider call consumes the remaining reservation lifetime.
- COD and Paymob normalize phone/notes differently; checkout state `open` is unused.
- Pricing/catalog checks occur before the COD write transaction. Stock decrement is atomic, but product availability and selected pricing can change before commit.
- Expiry sweeping is unbounded in one transaction and has only an in-process lock, so every API replica can run it.
- Item count and quantity have no upper bounds, increasing database work and integer-overflow risk.
- Fully refunded Paymob orders have no ERP close/deny action, while COD optimistic status updates have no error rollback/toast.
- ERP groups `failed`, `voided`, `pending`, and null provider states into a generic pending presentation.
- Sales analytics scans full order/item tables and clamps over-refund results to zero instead of surfacing data corruption.
- Webhook errors log only the error name; valid unmatched/rejected events generate no structured operational signal.
- Webhook and expiry paths acquire their locks in different orders, creating avoidable deadlock risk under concurrency.
- A corrupt `cartSnapshot` causes repeatable webhook HTTP 500 responses without a poison-event/DLQ workflow.

## Unproven items requiring sandbox evidence

- Whether Paymob accepts `items: []` for every enabled card and wallet flow.
- Wallet HMAC representations for missing/null/`NA` source fields.
- Exact behavior of delayed `pending` callbacks and whether a non-200 response is required for later delivery.
- Auth, capture, void, chargeback, partial-refund, and full-refund callback shapes for this Paymob account.
- Whether wallet `notification_url` is supported per request or must be dashboard-only.

## Test gaps

- Parallel duplicate-success webhook test asserting exactly one order and one stock finalization.
- Out-of-order success/decline/refund/void tests, including stale attempts.
- Wallet, uppercase-HMAC, array-HMAC, card-token, auth, capture, void, and merchant-reference vectors.
- Paymob order transition-matrix tests.
- 429 provider classification, reservation-aligned intention expiration, and unsupported-lookup removal tests.
- Storefront catalog-failure, multi-tab, lost-storage, unknown-state, polling-limit, and browser-crypto failure tests.

## Recommended implementation order

1. Durable callback inbox, unmatched-event reconciliation, and automatic provider inquiry/replay.
2. Real card/wallet sandbox verification and remaining callback vectors.
3. Reconciliation worker, alerts, pagination, and audited ERP resolution actions.
4. Checkout ownership/guest-token binding, polling limits, and browser session recovery.
5. Enforced payment/fulfillment state machines and audited operational transitions.
6. Lock-order, batch-expiry, body-limit, structured logging, and remaining callback tests.

## Relevant implementation files

- `apps/api/src/modules/payments/paymob/paymob-webhook.controller.ts`
- `apps/api/src/modules/payments/paymob/paymob-webhook.service.ts`
- `apps/api/src/modules/payments/paymob/paymob-transaction.service.ts`
- `apps/api/src/modules/payments/paymob/paymob-hmac.ts`
- `apps/api/src/modules/payments/paymob/paymob-client.ts`
- `apps/api/src/modules/checkout/paymob-checkout.service.ts`
- `apps/api/src/repositories/checkout/checkout-reservation.repository.ts`
- `apps/api/src/repositories/order/write.ts`
- `apps/storefront/src/hooks/use-checkout.ts`
- `apps/storefront/src/lib/paymob-browser-session.ts`
- `apps/storefront/src/components/checkout/paymob-result.tsx`
- `apps/erp/src/components/orders/order-details-view.tsx`

---

# Follow-up review — 2026-09-20

Post-fix verification pass over the current tree. HMAC field list/order was checked
against Paymob's published transaction-callback documentation and matches the
implementation exactly. The full API test suite was run: **487 pass / 4 fail**
(see N7). Only findings not already covered above are listed here; items marked
**[sharpened]** extend an existing finding.

Resolved during this follow-up: the early-callback fallback now reads Paymob's
nested `obj.order.merchant_order_id`, and its regression test uses the real
callback shape.

## New critical findings

- **N1 — Rate limits are keyed on `req.ip` with no `trust proxy` configured.**
  `app.ts` never calls `app.set("trust proxy", ...)`, and the API is deployed
  behind a reverse proxy (bound to `127.0.0.1:4000`; the default
  `PAYMOB_NOTIFICATION_URL` is `https://api.capellacares.com/...`). Behind a
  proxy, `req.ip` is the proxy's IP for **every** request, so the checkout POST
  limit (20 per 10 minutes, `checkout.routes.ts`) becomes a **global cap shared
  by all customers** — modest traffic will 429 everyone at checkout. Buckets are
  also an in-process `Map`, so they are per-replica and reset on restart. Even
  with `trust proxy` fixed, Egyptian mobile CGNAT means many genuine customers
  share one public IP; the checkout limit needs re-sizing.
## New high-priority findings

- **N3 — A second successful transaction on an already-succeeded attempt is
  silently swallowed. [sharpened]** The early return when
  `attempt.status === "succeeded" && session.createdOrderId` performs **no**
  `transaction.id === attempt.paymobTransactionId` check (the refund branch
  does). A user who re-pays with the still-valid `client_secret` (open Paymob
  tab, another attempt on the same intention) produces a second real capture
  that returns 200, is recorded "processed", and — because
  `payment_webhook_events` stores only a fingerprint that omits amount and
  transaction id — leaves no usable audit trail and is invisible to the ERP
  reconciliation list (which reads only `payment_attempts`).
- **N4 — Concurrent same-key Paymob initiation leaks a raw MySQL error.**
  `initiatePaymobCheckout` is check-then-insert; the loser of the
  `checkout_sessions_idempotency_key_unique` race gets `ER_DUP_ENTRY`
  propagated to the generic 400 handler, exposing `Duplicate entry '...' for
  key ...` as the customer-facing message. The COD path already handles this
  (catch + fingerprint replay); the Paymob path needs the same.
- **N5 — A retry that Paymob definitively rejects bricks the payment-result
  page.** Reachable: attempt 1 fails → user retries → attempt 2's intention
  creation gets a definitive 4xx → `failPaymobInitiation` sets the session to
  `failed` and releases stock. The storefront `CheckoutStatus` type omits
  `failed` (it only knows `payment_pending | completed | expired`), and
  `paymob-result.tsx` only stops polling / renders terminal UI for
  `completed`/`expired`. On `failed` it polls every 4 s for up to 30 minutes
  showing "Payment confirming…", `canRetry` is false, and the user has no
  forward path.
- **N6 — Stock-hoarding abuse via unbounded quantities. [sharpened]** The
  checkout schema allows any positive `qty` and any number of items, with no
  line-count, per-line, or cart-total ceiling. Every initiation reserves real
  stock for 30 minutes; if variant stock levels are exposed via the catalog, an
  attacker can reserve exactly the available stock of each variant per session
  and keep the store continuously sold out within the rate limit. Extreme
  quantities can also overflow `int amount_cents` / `decimal(10,2)` → raw 500s.

## New medium/low findings

- Webhook `401` (bad HMAC) and `422` (schema-invalid) deliveries are recorded
  **nowhere**; a 422 makes Paymob retry forever with no DLQ.
- `payment_webhook_events` persists only a hash — no amount, transaction id, or
  payload — so it cannot support forensics for N2/N3-style swallowed events.
- The schema **requires** `is_live` as a boolean; if any real Paymob callback
  omits it, every webhook 422s invisibly (ties into the sandbox items above).
- `CheckoutStatus.status` also omits the unused-but-possible `open` session
  state; the TypeScript type misrepresents the API.
- **N7 — Test suite is red on the current tree: 487 pass / 4 fail.** Two
  failures in `orders.routes.test.ts` are stale tests that create COD orders
  without the now-mandatory `idempotency-key` header; two in
  `auth.controller.test.ts` pass a mock `req` without `.get`. None are product
  bugs, but they mask real regressions.

## Re-verified as still open from the original report

- Paymob repeat callbacks after success skip complete identity validation (now N3).
- Same-idempotency-key concurrent initiation loses the unique-key race (now N4).
- Ambiguous initiation failures wedge the idempotency key until expiry.
- Recycling a failed checkout deletes session + attempts and can remove useful late-callback mappings.
- Reconciliation is durable but operationally stranded (no alerting/worker/actions).
- Checkout status/retry remain capability tokens with no ownership binding.
- Unbounded item count/quantity (now N6) and in-memory per-replica rate limiting
  (now N1).

## Recommended next steps

1. `app.set("trust proxy", …)` + re-size the checkout limit (production availability).
2. Identity-check the success early-return and record swappable events with
   retrievable data (N3).
3. Catch `ER_DUP_ENTRY` in the Paymob initiation path and replay (N4).
4. Handle the `failed` session state in the storefront (N5).
5. Enforce cart quantity/size/total ceilings (N6).
6. Fix the four failing tests (N7).
