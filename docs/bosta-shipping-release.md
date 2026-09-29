# Bosta shipping release

Use `bosta-shipping-integration.md` as the requirements, account evidence and progress record. This guide covers the release procedure. Configuration validation and fixture tests do not establish merchant behavior. The integration currently stays off.

## Server environment

Store local values in untracked `.env`, Docker development values in `.env.docker`, and VPS values in `.env.production`. JSON contracts must be single-line values; use single quotes around JSON when the environment-file loader requires quoting. Keep the same account ID and HTTPS API environment across all contracts. Do not copy fixture evidence into merchant settings.

Compose passes these settings to the API only:

| Setting | Purpose / default |
| --- | --- |
| `BOSTA_ENABLED` | Provider calls and shipping quotes; false |
| `BOSTA_SHIPMENT_SENDING_ENABLED` | New outgoing delivery creation; false |
| `BOSTA_SYNC_ENABLED` | Authenticated webhooks and linked-shipment synchronization; false |
| `BOSTA_CANCELLATION_ENABLED` | Verified pre-print/pre-pickup provider cancellation; false |
| `BOSTA_EDITS_ENABLED` | Verified linked-shipment edits before pickup; false |
| `BOSTA_API_KEY` | Server-only account key |
| `BOSTA_WEBHOOK_SECRET` | Random shared callback secret, identical in Bosta and the API |
| `BOSTA_BASE_URL` | `https://app.bosta.co/api/v2`; use a separately verified staging host/account for staging |
| `BOSTA_TIMEOUT_MS` | HTTP timeout; 10000 |
| `BOSTA_QUOTE_SETTINGS_JSON` | Account, pickup city, COD units, collection-total policy, size mapping, VAT/fee-inclusive amount path |
| `BOSTA_DELIVERY_SETTINGS_JSON` | Account, default pickup/contact, no insurance, size mapping and complete lookup-result contract |
| `BOSTA_SYNC_SETTINGS_JSON` | Account, webhook/read units, timestamps and actual collection/delivery confirmation paths |
| `BOSTA_CANCELLATION_SETTINGS_JSON` | Account and boolean printing/pre-pickup/warehouse/cancellation paths |
| `BOSTA_EDIT_SETTINGS_JSON` | Account and boolean editable/pre-pickup paths, backed by supported payload evidence |

The exact JSON requirements are in the integration plan and the corresponding runtime schemas. Verify every size, including Large above EGP 20,000. The public calculator's Normal/Light Bulky/Heavy Bulky labels do not establish the merchant mapping for Capella's Small/Medium/Large.

Check the local environment without HTTP or database queries:

```bash
pnpm --filter @capella/api shipping:check
```

Check the environment actually injected into a built API container without starting the API/workers:

```bash
docker compose --env-file .env.production run --rm --no-deps api node dist/scripts/check-shipping.mjs
```

Both print only capability booleans and static error codes. Exit 1 means invalid configuration. Exit 0 means internally consistent configuration, including intentionally disabled/recovery modes; confirm the reported capabilities before activation. Sending requires synchronization, account IDs must match, and delivery pickup must match the quote origin. Never paste the output of `docker compose config` into chat/logs: it expands secrets. Use its quiet validation mode:

```bash
docker compose --env-file .env.production config --quiet
```

## Database and workers

Back up the existing database before the deployment. Keep the production `COMPOSE_PROJECT_NAME` and volumes unchanged. Do not use `down -v`, `drizzle-kit push`, delete migration history or remove shipping records as a recovery procedure.

Apply the complete ordered migration journal. Shipping migrations are 0050 through 0058: foundation/rates, checkout/frozen requests, synchronization, manual/custody guards, cancellation/refunds, informational deadline flags, and durable `edit_delivery`. Migration 0058 is required before an edit can be queued. These migrations retain existing orders/history; existing history containing manual Returned remains readable.

The Compose `migrate` service uses the API builder image, waits for healthy MySQL, runs `db:migrate`, and must exit successfully before the API starts. An explicit migration step, when deploying the built revision, is:

```bash
docker compose --env-file .env.production run --rm migrate
```

Then start the approved revision using the existing-data deployment procedure in `docker.md`. Check migration completion:

```bash
docker compose --env-file .env.production logs migrate --tail 80
```

The API starts checkout expiry, dispatch, synchronization and cancellation workers automatically; no second scheduler/service is needed. Shipping sweeps run every 30 seconds, claim at most ten jobs per sweep and use two-minute leases. Synchronization success schedules the next read in five minutes; failure backoff reaches fifteen minutes. Intent and claim records survive API restarts. Existing order locks protect concurrent workers; do not manually clear claims or delete jobs.

Linked edits recover through verified synchronization reads; they have no separate PUT-retry worker. Failed/uncertain creation and cancellation recover from persisted intent. An uncertain write must not be blindly resent.

## Webhook

In Bosta **Settings → API Integration → Add Webhook**, use:

| Form field | Value |
| --- | --- |
| Webhook URL | `https://api.capellacares.com/api/v1/shipping/bosta/webhook` |
| Authentication key name | `X-Bosta-Webhook-Secret` |
| Authentication key | Exact server `BOSTA_WEBHOOK_SECRET` value |

Use the same value in the VPS environment; changing only Bosta or only the API breaks authentication. The API container must be deployed with verified `BOSTA_SYNC_SETTINGS_JSON` and synchronization enabled before it processes callbacks.

Expected responses: 503 when disabled/unavailable; 401 for wrong/missing authentication; 400/413/415/422 for invalid JSON/oversized/encoded/invalid payloads; 200 for a processed event and 202 for persisted pending/ignored evidence. HTTP acknowledgment does not prove delivery, payment, safe cancellation or restocking. Authentication precedes bounded parsing, and a callback is persisted before acknowledgment. Creation has no state-change webhook, so its initial tracking/state response is saved by the dispatch worker.

Official references: [API key usage](https://docs.bosta.co/docs/how-to/get-your-api-key/), [webhook setup and states](https://docs.bosta.co/docs/how-to/get-delivery-status-via-webhook/), [API/OpenAPI](https://docs.bosta.co/api/api.yaml).

## Activation and release verification

Before any live activation, close O06/O07/O20/O26/O27 with account evidence: negotiated VAT/fees and all size/COD mappings, correct account/environment and Fayoum defaults, create/unique search/read correlation and no-insurance behavior, collection/delivery/printing/custody evidence, edit payload/availability, and original-parcel linkage for dashboard-managed returns/exchanges. Empty lookup results do not prove uniqueness or return/exchange linkage. Verify the agreed offer against the actual account calculator, including extra COD and packaging fees. Keep the gates off if those disagree.

Deploy initially with all five gates false. Confirm migrations, API health, storefront/ERP availability and unchanged inactive checkout. Configure Bosta's webhook and the matching server secret. Run the container configuration check with the verified contracts. Activate only the approved, verified capabilities; synchronization must accompany sending. A configuration checker never enables a gate itself.

After explicit authorization for provider writes, exercise a controlled new COD order and a verified-paid Paymob order. Confirm exactly one outgoing tracking number across retries/restart, locked COD = products + shipping, prepaid zero COD, no package opening or insurance, account/default pickup, and saved initial response. Verify callback/replay and five-minute reads. Verify safe cancellation once, printed/picked-up barriers, manual full Paymob refund status, immutable money and packing correction. Finally verify original-linked return/exchange movement with independent refund and inspected-stock handling. Do not create historical imports, pickup bookings or customer return/exchange requests.

The regression covers inactive checkout; quote failure/saved rates; signed-in/guest COD; Paymob success/refund ordering; dispatch retries/restart/uncertainty; authenticated duplicate/stale/conflicting events; actual collection mismatch; manual/expiry/address barriers; cancellation races and stock restored once; edit uncertainty; staff permissions/bulk outcomes; customer ownership/hydration/pending display; and read-only returns/exchanges. Run focused API files sequentially in small batches with the test-database runner:

```bash
cd apps/api
```

```bash
node scripts/run-tests.mjs tests/routes/customer-shipping.routes.test.ts tests/routes/shipping-state.routes.test.ts tests/routes/shipping-action.routes.test.ts
```

```bash
node scripts/run-tests.mjs tests/services/shipping-worker.test.ts tests/services/shipping-sync-worker.test.ts tests/services/shipping-cancellation-worker.test.ts
```

```bash
node scripts/run-tests.mjs tests/services/paymob-shipping.test.ts tests/services/shipping-state.test.ts tests/services/shipping-edit.test.ts
```

Use the remaining shipping/provider/checkout route tests and all workspace tests for final release regression. Run package typechecks/lint, API/database/ERP/storefront builds, the bundled configuration check and mobile iOS/Android exports sequentially. The local API/database runners must use the dedicated `.env.test` database; never run database-resetting tests against production. Remote smoke checks require configured targets; this repository currently has no staging Playwright smoke cases, so that command is not evidence of a passing release.

## Disable and recovery

To stop **new creation** while preserving uncertain-create search/read recovery, set sending false, retain the verified account/settings and `BOSTA_ENABLED=true`, and recreate the API container. Keep synchronization enabled. New valid shipping orders retain their durable pending intent; show staff the pending state.

To stop **all provider HTTP calls**, set `BOSTA_ENABLED=false` and recreate the API. Quotes revert to the inactive checkout contract; a previously supplied shipping quote/address is rejected rather than silently repriced. Saved successful create responses can still link locally. Verified synchronization may remain true for authenticated callbacks/local replay, while HTTP reads, PUT/DELETE/create/search stop. Linked cancellation remains pending and stock held until safe evidence exists; safe local unsent cancellation may still complete.

To stop callback processing/replay too, set synchronization false. Do not restock or mark a refund from an unverified carrier state during the outage. Set edits/cancellation false to disable those provider operations independently. Preserve credentials, contracts, jobs, events, flags and audit history for recovery; never clear mutation markers or reset attempt counts to force another write.

Environment changes require container recreation; `docker compose restart` retains the old injected environment. Recreate after updating the approved settings:

```bash
docker compose --env-file .env.production up -d --no-deps api
```

Check the redacted configuration report, health, worker error logs and ERP Needs attention/bulk outcomes. Use authorized ERP retry only for a definitely failed eligible create; use reconcile/read-only recovery for uncertain create/edit work. Cancellation recovery rechecks current and historical printing/pickup/collection/custody before any stock effect. Returns remain uninspected until staff manually restore sellable stock using existing inventory controls. Paymob refund callbacks remain independent.

Roll back only to a revision that understands the persisted shipping schema and pending operation types. Keep additive migrations and durable history. Do not downgrade to code that ignores `edit_delivery` or restore a stale database over completed payment/stock effects.
