# Bosta shipping integration

Updated: 2026-09-26. This is the single requirements, progress and continuation record.

**Current:** S05/S06 (Phase 2) are complete and locally verified. Merchant-account verification is unfinished and live shipping remains off by user instruction. This request ends at S06; **Phase 3/S07 has not started.** No implementation review gate.

## Work checklist

Checked means implemented and locally verified. Account verification is tracked separately; checked code does not mean live shipping is ready. Follow dependencies and checks, then continue without waiting for review within the requested phase.

- [x] **S01 ? Contracts and integration map:** repository behavior, data ownership, activation boundaries and unresolved decisions documented.
- [x] **S02 ? Storage and shared schemas:** migrations 0050/0051, immutable order shipping amounts, nonnegative checkout shipping, linked shipments/events, durable work, state history, staff flags and saved rates.
- [x] **S03 ? Provider client/config:** server-only credentials, HTTPS, inactive mode, timeouts, uncertain-write classification, HTTP errors and secret redaction.
- [x] **S04 ? Address/quote code:** district availability, exact size boundaries, verified pricing-contract gates, exact cents conversion, complete cache identity and real client/address/pricing/database composition.
- [ ] **S04 account verification ? O06/O26:** authenticated staging access; actual account rates, VAT/fees, size mapping, COD units and default pickup details. Required before live quotes/activation; continue independent code meanwhile.
- [x] **S05 ? Checkout/COD:** supported address selections; API-derived products + shipping; quote persistence/revalidation; summaries, retries and Arabic/English errors; fix zero-products/nonzero-shipping path. Depends on S02-S04 code; live pricing depends on O06.
- [x] **S06 ? Paymob:** shipping-inclusive charges, immutable session/address/quote snapshots, verified callback order creation, replay/refund ordering and original paid refund amounts. Depends on S05.
- [ ] **S07 ? Automatic sending:** persist intent with COD/verified-paid orders; claim/retry/restart recovery; store initial response; resolve uncertain creation before resending. Depends on S03/S05/S06; needs O27/O28.
- [ ] **S08 ? Synchronization/COD paid:** authenticate and deduplicate webhooks, handle late events, reconcile linked shipments, verify collected amount, reflect permitted Bosta edits. Depends on S07; needs O20/O21.
- [ ] **S09 ? States/edit guards:** separate manual/carrier/payment/custody state, record processing history, lock items/quantities/money, protect existing rejection paths. Depends on S08; needs O02-O04/O07.
- [ ] **S10 ? Cancellation/refunds:** shared staff/customer/expiry operation; block dispatch, reconcile carrier state/custody, cancel safely, apply stock effects once; handle D43 refunds and races. Depends on S09; needs O27.
- [ ] **S11 ? 96-hour expiry:** replace created-order 48-hour rule, fixed deadline, processing/address exceptions, safe COD rejection/restocking, paid-order staff flags; retain payment-session expiry. Depends on S10; needs O03/O04/O12.
- [ ] **S12 ? Permissions/ERP overview:** permission catalog/dependencies, staff labels, navigation, shipment list/detail, filters, flags/history and loading/error states. Depends on S08-S11; needs O18/O19.
- [ ] **S13 ? ERP actions:** authorized retry/reconcile, no-money edits, packing correction, manual state/history, cancellation and staff flag handling; guard concurrent updates. Depends on S12 and resolved state policy.
- [ ] **S14 ? Pickups:** individual/recurring list/create/edit/cancel, dates/recurrence validation, Bosta default location/contact, duplicate-safe retries. Depends on S13; needs O25 and account capabilities.
- [ ] **S15 ? Customer account:** owned-order bilingual timeline and eligible cancellation; show pending/exception outcomes, hide raw provider data. Depends on S10-S13; needs O24 and printing evidence.
- [ ] **S16 ? Returns/refunds:** approved request/eligibility flow, linked return, receipt/inspection, exactly-once sellable-stock restoration, full manual refund evidence. Depends on S08-S15; needs O13/O16/O29.
- [ ] **S17 ? Exchanges/fees:** agreed exchange or return/refund/reorder flow, replacement stock/payment, case-specific return/refusal collection, oversized exceptions. Depends on S16; needs O08/O14/O15/O17.
- [ ] **S18 ? Release preparation:** whole-flow regression, account verification, README/environment/deployment updates, migrations/webhook/worker setup, activation/disable/recovery instructions. Depends on completed S01-S17 and resolved relevant gates; deployment/provider writes need explicit authorization.

## Confirmed requirements

| ID | Requirement |
| --- | --- |
| D01 | Bosta Egypt; existing merchant account. |
| D02 | Automatically send new Capella orders only; no historical import. Store has not launched. |
| D03 | Send COD after order creation and Paymob only after verified payment creates the order. |
| D04 | Automatic delivery creation; pickup booking is separate. ERP supports individual and recurring pickups. |
| D05 | Separate ERP shipping area plus shipping controls in order details; implement supported operations within this scope. |
| D06 | Size uses products total after discounts, excluding shipping: ? EGP 7,000 Small; > 7,000 through 20,000 Medium; > 20,000 Large. Authorized staff may correct size. |
| D07 | No package opening before delivery acceptance. |
| D08 | Print only in Bosta. Staff may manually set Preparing, Ready for pickup, Printed, Delivered and Returned with history; these do not fabricate carrier events, collection or inspection. Conflict policy: O02. |
| D09 | Reuse Bosta's single existing warehouse/contact; no Capella warehouse setup. |
| D10 | Checkout uses supported Bosta addresses and district drop-off availability; governorate coverage alone is insufficient. |
| D11 | No insurance; verify account defaults do not enable it unexpectedly. |
| D12 | Manage linked Capella shipments only; reflect relevant Bosta-side changes without importing unrelated deliveries. |
| D13 | COD collection is in scope; settlements, payouts, cash-out and balance reconciliation are excluded. |
| D14 | Merchant-account rates are authoritative; public prices are reference only. |
| D15 | Customer shipping includes VAT; verify actual account semantics, never assume a VAT percentage. |
| D16 | Pricing outage uses the last valid matching saved rate, with no age expiry. No valid rate blocks order placement. |
| D17 | COD collection = products + customer shipping. |
| D18 | Paymob charges products + shipping; ordinary prepaid Bosta delivery collects zero. |
| D19 | Mark COD paid only after verified successful delivery and collection; this does not prove settlement to Capella. |
| D20 | Initiate Paymob refunds manually in its dashboard; ERP displays verified callback status. |
| D21 | Staff decide return/refusal shipping charges case by case; record/collect through Bosta where supported. Mechanics: O14. |
| D22 | Exchanges and positive price differences approved; linked exchange versus refund/reorder and cheaper replacements remain O15. |
| D23 | Orders survive sending failures; retry automatically, show ERP errors, prevent duplicate deliveries. |
| D24 | Untouched COD deadline is original customer order creation + 96 hours; automatic sending belongs to the same customer action. |
| D25 | Genuine processing, including printing, stops untouched expiry. Active/delivered/returned orders are excluded; exact event mapping: O03/O04. |
| D26 | Wrong/unclear address before collection requires a staff flag and retains the original 96-hour expiry. |
| D27 | Automatic expiry rejection/restocking applies only to COD. Untouched paid Paymob orders get staff flags, no automatic refund/restock. |
| D28 | Signed-in customers may cancel their own eligible orders before printing or warehouse departure; printed/dispatched orders cannot use direct cancellation. |
| D29 | Lock products, quantities and money for COD/prepaid, including equal-price substitutions. Money changes require cancellation/new order; permitted no-money recipient/address/notes/package edits depend on O07. |
| D30 | Returned stock becomes sellable only after staff inspection/approval. Full refunds only; whole-order return scope and fee treatment: O13. |
| D31 | Keep shipment, payment, return, collection and custody states distinct. Carrier cancellation does not prove warehouse custody. |
| D32 | Guests have no Capella history/tracking/lookup; their orders still receive internal shipping integration. |
| D33 | Signed-in customers get a simple timeline; detailed raw carrier events stay in ERP. |
| D34 | Capella staff alerts are in ERP only; no email/SMS/WhatsApp shipping notifications. |
| D35 | Add explicit staff shipping permissions; order-view access does not automatically allow modifications. |
| D36 | Lock customer shipping quote/size at checkout. Capella covers extra carrier cost from later packing correction; customer total stays fixed. |
| D37 | One outgoing box normally; unusual oversized orders need O17, not automatic multi-parcel shipping. |
| D38 | Unverified carrier cancellation/state at expiry: flag staff and retain stock until safe cancellation/custody is confirmed. |
| D39 | Fixed deadline, no extension/reset/exemption; genuine processing stops the untouched rule. |
| D40 | Customer account return/exchange requests approved; simple refund flow requested. Approval/eligibility and exchange scope remain O15/O16. |
| D41 | Eligible paid customer cancellation gets a full manual Paymob refund of products + shipping. |
| D42 | Carrier outage during cancellation shows Cancellation pending and blocks ERP dispatch. Finalize only after rechecking safe cancellation; ERP cannot prevent physical Bosta actions. |
| D43 | Verified full pre-dispatch Paymob refund stops unsent work and requests linked cancellable shipment cancellation. Retain stock until custody is safe; moving shipments/failures need staff handling. Unexpected partial refund blocks dispatch and raises a staff flag. |

## Unresolved decisions and account evidence

Skipping implementation reviews does not answer these questions. Ask only when the affected work needs an answer; continue independent work. Resolved O01/O05/O09/O10/O11/O22 are already captured above.

| ID | Missing decision/evidence | Affected work |
| --- | --- | --- |
| O02 | Which status is displayed when manual and carrier events disagree? Manual state never proves payment/custody. | S09/S13 |
| O03 | Exact genuine-processing event map, including printing; notes/ordinary edits do not count. | S09/S11 |
| O04 | Later pre-collection address trouble after preparation: does previous processing remain decisive? | S09/S11 |
| O06 | Merchant VAT, COD surcharges, discounts, size mapping, response fields/units, COD input units and pickup defaults. Shipping-inclusive COD may need quote iteration; no fee policy is invented. | S04/S05 |
| O07 | Allowed no-money fields and carrier states; destination edits cannot change the agreed total. | S09/S13 |
| O08 | Cancel/reorder flow after printing/dispatch and its return/refund coordination. | S17 |
| O12 | Paid untouched-order flag timing and whether staff may clear it with a note; prior blank answer did not settle either. | S11 |
| O13 | Whole-order return scope, post-delivery shipping refund and separate case-specific fees. | S16 |
| O14 | Bosta return/refusal fee collection mechanics; fallback if unsupported. | S17 |
| O15 | Linked exchange versus full return/refund/new order; cheaper/equal/more-expensive replacements; inclusion in the simple-refund phase. | S17 |
| O16 | Approvals/eligibility for simple returns. Proposed request ? staff approval ? pickup ? inspection ? manual refund is unconfirmed; no eligibility deadline/unopened rule approved. | S16 |
| O17 | Orders that cannot fit one Large box: staff handling versus an explicitly approved alternative. | S17 |
| O18 | Final permission granularity for implemented actions. | S12 |
| O19 | ERP overview groups/filters/bulk actions/pickup view/alerts. | S12/S13 |
| O20 | Provider delivery/collection evidence and amount mismatch handling; sending is not payment. | S08 |
| O21 | Ownership of Bosta-side address, collection, size and history edits; never overwrite locked items/customer totals. | S08 |
| O23 | Lost/damaged/refused/repeated-failure handling and explicit stock disposition; no insurance/settlement scope. | S08/S13 |
| O24 | Simple bilingual timeline steps and exception/cancellation/return copy. | S15 |
| O25 | Recurrence days/dates/parcel count and edit/cancel controls; reuse Bosta defaults. | S14 |
| O26 | Authenticated merchant staging access; staging documentation alone does not verify this account. | S04/S18 |
| O27 | Editing/cancellation restrictions and safe lookup/correlation for uncertain delivery creation; do not assume business-reference uniqueness. | S07/S10 |
| O28 | Package contents/notes language and product/bundle/SKU detail; never expose buying costs. | S07 |
| O29 | Manual refund method/evidence for collected COD after a return; no settlement accounting. | S16 |

## Implementation rules

- Read `AGENTS.md` and this file; recheck concurrent changes. Preserve the existing unrelated staff-save transaction fix/tests. No commits, sub-agents, deployment or production shipment/pickup writes without explicit authorization.
- Before each slice, record intended files/contracts/checks here. Use focused baseline and TDD for behavior changes; run conflicting checks sequentially. After checks pass, update progress and continue. No reviewer, handoff or acceptance gate.
- Derive money/size server-side. Store integer cents and immutable product/bundle, quote/address/size and paid snapshots. Browser prices never authorize a charge.
- Separate raw carrier state/code/type, normalized state, manual history, payment evidence and custody/stock disposition. Numeric state ordering and dashboard tabs do not establish progression.
- Authenticate/authorize every operation; enforce customer ownership. UI hiding is insufficient; permissions cannot override carrier restrictions.
- Persist intent before provider calls, without keeping a database transaction open across a slow request. Recover after restart; handle worker races, retries, delayed responses and duplicate/out-of-order callbacks idempotently.
- Uncertain creation is not definite failure: reconcile before resend, otherwise flag staff. Cancellation/refund intent prevents stale dispatch; reconcile late successful creates. Store the initial create response because creation has no state-change webhook.
- Stock effects happen once and require safe cancellation/custody or approved return inspection. Restock sold bundle snapshots, never current bundle contents. Protect existing payment-rejection and expiry paths.
- Inactive integration preserves current checkout behavior. Enabled shipping requires a valid quote; no zero-shipping bypass. Disabling later must retain recovery for existing shipments/cancellations and preserve audit history.
- Preserve guest checkout, bilingual loading/error/pending states and shared/mobile compatibility. No new mobile shipping UI, Redis, provider framework, packing algorithm, product dimensions, guest tracking, ERP printing, insurance, settlement, partial-refund initiation or unapproved multi-parcel flow.

## Integration map and contracts

| Area | Files / required connection |
| --- | --- |
| Checkout | `apps/storefront/src/components/checkout/{checkout-form,checkout-summary}.tsx`, `apps/storefront/src/hooks/use-checkout.ts`; replace fixed/free-text address flow, zero shipping and products-only expected amount. |
| COD | `apps/api/src/modules/orders/orders.service.ts`; shipping-inclusive pricing/collection, immutable quote and durable create intent. Zero product subtotal alone cannot imply a free order. |
| Paymob | `apps/api/src/modules/checkout/paymob-checkout.service.ts`, `apps/api/src/modules/payments/paymob/paymob-transaction.service.ts`; charge/session/callback/refund snapshots must agree. Unpaid sessions never create shipments. |
| Inventory/expiry | `apps/api/src/repositories/order/write.ts`, `apps/api/src/modules/checkout/checkout-expiry-worker.ts`; replace unsafe immediate restock/48-hour created-order expiry while preserving separate payment-session expiry. |
| Persistence/shared | `packages/database/drizzle/schema.ts`, migrations `0050_shipping_foundation.sql`/`0051_shipping_rates.sql`, `packages/shared/src/schemas/{shipping,checkout}.schema.ts`, DTOs/types/i18n and consumers. |
| ERP | API `erp-permissions.service.ts`; ERP `staff-editor-form.tsx`, `admin-shell.tsx`, shipping/order pages and details: matching labels, dependencies, guards, filters, actions and history. |
| Customer | Authenticated owned-order routes/account views; simple timeline and shared cancellation/return operations; no guest lookup. |

Quote: supported address IDs + server products/payment/collection context ? quote ID, VAT-inclusive cents, estimated size, rate identity, timestamp. Checkout re-derives/revalidates after cart/address changes and rejects stale/tampered quotes without silently changing the agreed total. COD/Paymob totals = products + stored shipping.

Storage: `orders` shipping snapshot; `checkout_sessions` quote/address/payment snapshots; linked outgoing/return/exchange `shipments`; deduplicated `shipment_events`; durable `shipping_work_items`; `order_review_flags`; `order_state_history`; `shipping_rates`. Returns/exchanges keep separate tracking references.

Saved-rate key `bosta:v2` binds account, environment, pricing contract, pickup/destination, Capella/provider size, service, payment method and COD cents. Old incomplete keys cannot serve new quotes. Only classified recoverable pricing outages use fallback; malformed successful responses and definitive rejections do not.

Proposed permissions: `shipping.read`, `retry`, `update`, `cancel`, `manage_pickups`, `create_return`, `create_exchange`, `approve_restock`, `update_state` under the shipping prefix; no-money order-edit key pending. Define read/`orders.read` dependencies, preserve explicit existing grants/admin behavior; no print permission.

## Provider reference and configuration

Public documentation was checked 2026-09-26; merchant behavior remains unverified. Recheck official documentation when implementing a dependent operation.

| Operation | Documented reference |
| --- | --- |
| Create/read/search | `POST /deliveries?apiVersion=1` (delivery type 10); `GET /deliveries/business/{trackingNumber}`; `POST /deliveries/search`. |
| Edit/cancel | `PUT /deliveries/business/{trackingNumber}`; `DELETE /deliveries/business/{trackingNumber}/terminate` needs Full Access and verified state/custody constraints. |
| Return/exchange | Creation types 25 (customer return pickup), 30 (exchange); payment semantics remain open. |
| Addresses | Cities/zones/districts, `/cities/getAllDistricts?countryId=60e4482c7cb7d4bc4849c4d5`; verify drop-off availability. |
| Prices | `/pricing/calculator`, `/pricing/shipment/calculator`; shipment inputs `dropOffCity`, `pickupCity`, `cod`, `type`, `size`; success response fields/units/VAT/fees require account evidence. |
| Pickups/defaults | Pickup CRUD/available dates/recurrence and account pickup-location/contact endpoints; reuse defaults. |
| Webhooks/printing | Custom auth headers; creation does not emit a state-change event. Printing metadata is unverified; AWB printing remains outside ERP. Commented draft paths are not supported guarantees. |

Server config implemented: `BOSTA_ENABLED` (off by default), `BOSTA_API_KEY`, `BOSTA_BASE_URL`, `BOSTA_WEBHOOK_SECRET`, `BOSTA_TIMEOUT_MS`. Keep secrets in untracked server environment files, never client bundles/docs/logs. Production provider base: `https://app.bosta.co/api/v2`; documented staging host: `https://stg-app.bosta.co`, merchant access unknown. API key uses `Authorization`.

Capella production domains: storefront `capellacares.com`, ERP `erp.capellacares.com`, API `api.capellacares.com`. Webhook route is not implemented/chosen; it belongs on Capella's API, not Bosta's domain.

Sources: [API/OpenAPI](https://docs.bosta.co/api/api.yaml), [addresses](https://docs.bosta.co/docs/how-to/format-bosta-address/), [delivery](https://docs.bosta.co/docs/how-to/create-your-first-delivery/), [pickups](https://docs.bosta.co/docs/how-to/create-your-first-pickup/), [webhooks](https://docs.bosta.co/docs/how-to/get-delivery-status-via-webhook/), [key access](https://docs.bosta.co/docs/how-to/get-your-api-key/), [whitelisting](https://docs.bosta.co/docs/how-to/whitelisting/), [official SDK/staging](https://github.com/bostaapp/bosta-php), [public pricing](https://bosta.co/en-eg/pricing).

Public screenshot reference, **EGP before VAT; never checkout/account prices**:

| Service | Cairo | Alex | Delta-Canal | Upper-RedSea |
| --- | ---: | ---: | ---: | ---: |
| Delivery Small/Medium | 97 | 102 | 110 | 140 |
| RTO/Cash collection | 87 | 87 | 87 | 87 |
| Customer return pickup | 107 | 107 | 107 | 107 |
| Exchange | 112 | 117 | 125 | 155 |
| Light Bulky | 197 | 202 | 210 | 240 |
| Heavy Bulky | 564 | 614 | 694 | 994 |

Large pricing and account/governorate region mapping are unknown. Small/Medium sharing a public row does not verify account rates; Medium/Large must not be mapped to bulky services by guesswork.

## Verification and continuation

CodeRabbit follow-up (Phase 2 only): reviewed all 72 uncommitted files; its single finding is fixed. `bosta-address.service.ts` shares validated districts across concurrent lookups and COD calculations for 30 seconds, refreshes expired data and retries failed loads. A real COD quote now downloads addresses once instead of four times. Regression/related shipping tests **45/45**, API build/lint/typecheck and diff checks passed. Baseline: address/composition 11/11; workspace build/lint/typecheck 17/17. No Phase 3 work or live activation.

Phase 2 (S05/S06): server-priced, durable quotes bind cart/discount snapshots, destination, payment method and customer; unchanged quotes keep their identity across refreshes. Submission revalidates the agreed rate and total. COD charges products + shipping; prepaid quotes collect zero. Paymob sessions/attempts charge that same total and preserve address/quote/size/product snapshots through retries, verified callbacks, duplicate callbacks and out-of-order refunds. Free products with positive shipping still require payment; a truly zero total stays free. Supported bilingual city/area/district controls, pending/error/retry states and exact cents displays are connected. Product sales exclude shipping. No sending worker, shipment creation, new cancellation lifecycle or 96-hour rule was added.

Migration **0052_checkout_shipping_snapshots** adds durable quote records and order/session shipping snapshots; applied only to `localhost/capella_test`. Public routes: `GET /api/v1/checkout/shipping` and `POST /api/v1/checkout/shipping/quote` (cart items, payment method and destination IDs; authenticated customer identity comes from the token). Enabled checkout requires an agreed quote; inactive checkout retains the existing address flow and zero shipping.

Activation also requires server-only `BOSTA_QUOTE_SETTINGS_JSON`: verified account/evidence/ID, pickup city, COD units, all three size mappings, the verified response contract, and account-confirmed `codPricingPolicy: "collection_total"`. COD calculator quotes iterate against products + shipping until the amount agrees; cycles or failure to converge within eight calculations block quoting. No VAT, COD fee or size mapping is assumed. Keep `BOSTA_ENABLED` off until O06/O26 are verified.

Phase 2 verification: whole-workspace build/lint/typecheck **17/17 tasks passed**. Full tests: API **625/625**, storefront **553/553**, ERP **227/227**, mobile **89/89**, shared **39/39**, database **44/44**; **1,577 tests passed**. Targeted shipping/checkout/payment checks passed first (API 191/191; browser 41/41). Test database: `localhost/capella_test`; provider responses were controlled fixtures. No deployment, merchant-account activation or provider writes.

Latest S03/S04 checks (2026-09-26): **80/80 selected shipping tests, API typecheck and build passed** using controlled provider responses and isolated `localhost/capella_test`. Coverage includes money boundaries, context isolation, live-save/fresh-service outage fallback, malformed/definitive rejection, inactive/unverified gates, city/district validation, uncertain writes and secret redaction. No merchant requests or activation. API lint is the same TypeScript check as typecheck.

Earlier S02 evidence: database 44/44, shared 34/34; staff-save tests 14/14. Current full-suite results are recorded above. Earlier defects were corrected: guessed bulky mapping, price-unit/precision handling, incomplete cache identities, malformed-success fallback, HTTP status loss and credential exposure. Release-flow verification remains S18 work.

Targeted commands (run sequentially; first command from `apps/api`, others from repository root):

```powershell
node scripts/run-tests.mjs tests/services/bosta-config.test.ts tests/services/bosta-client.test.ts tests/services/bosta-address.test.ts tests/services/bosta-pricing.test.ts tests/services/bosta-quote.test.ts tests/services/bosta-rate-context.test.ts tests/services/bosta-quote-composition.test.ts tests/repositories/shipping-rate.repository.test.ts
pnpm --filter @capella/api typecheck
pnpm --filter @capella/api build
```

Other selected checks: ERP/storefront `pnpm --filter @capella/<app> exec vitest run <test>`; shared `pnpm --filter @capella/shared exec tsx --test <test>`. Inspect package scripts and database test-migration tooling before using them; verify test database destination, never production. For small slices check only the touched area; run broader checks for high-complexity work per `AGENTS.md` and at S18.

Continuation: Phase 2 is finished; stop at the requested phase boundary. S07 is the next unfinished slice and has not started. Keep account gates explicit and live shipping off. Future work records intended files/checks here and continues within its authorized scope without a review pause. VPS work uses one command at a time; deployment/production writes require their own authorization.
