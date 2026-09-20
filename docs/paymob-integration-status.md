# Paymob Integration Status

Last reviewed: 2026-09-20

## Paymob-confirmed account details

- Environment: test mode
- Card integration ID: `5885253`
- Card integration type: VPC, confirmed by Paymob for online card payments and 3D Secure through the Intention API and Unified Checkout
- Egyptian mobile-wallet integration ID: `5915379`
- Card and wallet integration IDs can be included together in the Intention API `payment_methods` array
- Test card:
  - Number: `4111111111111111`
  - Cardholder: `Test Account`
  - Expiry: `01/39`
  - CVV: `123`
- Test wallet:
  - Number: `01010101010`
  - MPIN: `123456`
  - OTP: `123456`
- Paymob will provide separate integration IDs and credentials for live mode

The five `Clipboard image 2026-09-20 *.png` files in the repository root are illustrative screenshots supplied by Paymob. They do not show the current configuration of Capella's Paymob account.

## Required URLs

- Processed webhook: `https://api.capellacares.com/api/v1/payments/paymob/webhook`
- Customer redirect: `https://capellacares.com/checkout/payment-result`

Every card-only, wallet-only, or mixed card/wallet Intention request includes the processed callback URL as `notification_url`. Separately, the Paymob dashboard must also configure that processed webhook URL for wallet payments and on both integrations; the per-intention payload does not replace the dashboard configuration requirement.

## Manual actions required from Ahmed

1. Open Paymob Dashboard -> Settings -> Payment Integrations.
2. Open card integration `5885253` and wallet integration `5915379`.
3. Configure the processed webhook and customer redirect URLs shown above on both integrations.
4. Enable Auto Callback where available.
5. Confirm that both integrations remain in test mode and use EGP.
6. Confirm when the dashboard configuration is complete.
7. Do not send Paymob secret keys, public keys, API keys, or HMAC secrets through chat.

## Repository configuration still required

Configure the API environment locally and in the VPS `.env.production`:

```env
PAYMOB_MODE=test
PAYMOB_CARD_INTEGRATION_ID=5885253
PAYMOB_CARD_INTEGRATION_CONFIRMED=true
PAYMOB_WALLET_INTEGRATION_ID=5915379
PAYMOB_WALLET_INTEGRATION_CONFIRMED=true
PAYMOB_NOTIFICATION_URL=https://api.capellacares.com/api/v1/payments/paymob/webhook
PAYMOB_REDIRECTION_URL=https://capellacares.com/checkout/payment-result
```

The secret key, public key, and HMAC secret must also be present in the API environment. Keep them server-only. The storefront and ERP must not receive them.

The checked local `.env` currently has the test credentials and card ID, but the wallet ID, confirmation flags, notification URL, and redirection URL are not configured. Docker defaults also keep both methods disabled. Paymob should remain disabled until the dashboard configuration and sandbox checks below are complete.

`PAYMOB_API_KEY` is currently passed through configuration but is not used by the Intention API implementation. It is not a missing dependency for the current hosted-checkout flow.

## Implemented

- Paymob Intention API client and Unified Checkout redirect
- Combined card and wallet integration IDs
- Server-authoritative pricing in EGP minor units
- Checkout idempotency
- Thirty-minute stock reservation
- Maximum of three payment attempts
- Reservation release after expiry or the third decline
- HMAC verification of transaction callbacks
- Amount, currency, environment, Paymob order, and integration-ID validation
- Order creation only after a verified successful callback
- Duplicate callback safety
- Partial and full refund callback accounting
- Late-payment reconciliation protection
- Customer payment-result page and local status checks
- Cart preservation during payment and clearing after confirmed success
- ERP Paymob payment status
- Read-only ERP reconciliation queue
- API-only Docker secret propagation

## Not implemented or incomplete

- Real Paymob sandbox end-to-end verification
- Special-reference recovery for early webhooks and definitive provider-failure handling are implemented. Automatic provider inquiry or replay remains incomplete for ambiguous Intention requests and ambiguous webhook delivery/processing failures.
- Operational actions, ownership, notes, alerts, and resolution history for reconciliation cases
- Refund initiation from Capella ERP; refunds are performed manually in Paymob Dashboard
- Authorization, capture, and void workflows
- Saved-card/token callback support
- Durable storage and replay of webhook payloads that fail during processing
- Production/live credentials and live integration IDs
- Production deployment and public callback reachability verification

## Required sandbox verification

Complete all of the following before enabling customer payments:

- Successful card payment with 3D Secure
- Declined card payment
- Successful wallet payment
- Declined or abandoned wallet payment
- Correct webhook delivery for both methods
- Correct browser redirect to the Capella result page
- Retry after a declined payment
- Reservation expiry and stock restoration
- Duplicate callback handling
- Partial refund callback
- Full refund callback
- Late success after reservation expiry and appearance in the ERP reconciliation queue
- `/api/v1/payments/paymob/methods` returns both `card` and `wallet` after activation

## Production checklist

- Obtain new live secret/public/HMAC credentials from Paymob
- Obtain new live card and wallet integration IDs
- Change `PAYMOB_MODE` to `live`
- Never mix test credentials or IDs with live credentials or IDs
- Configure the same production webhook and redirect URLs on both live integrations
- Verify HTTPS, proxy/WAF access, Docker configuration, database migrations, and callback delivery
- Perform a controlled low-value live transaction before general release

## Current conclusion

The main checkout flow is implemented. The immediate blockers are dashboard callback configuration, repository/VPS environment activation, and real card-and-wallet sandbox testing. Paymob should not be enabled for customers until those checks pass.
