import { z } from "zod";

/**
 * Trusted Paymob transaction inquiry.
 *
 * Webhook callbacks are HMAC-signed, but only over a fixed field list that does NOT
 * include `refunded_amount_cents`. A refund amount taken from the callback body is
 * therefore attacker-controllable, so refund totals must come from this authenticated
 * read instead.
 *
 * CREDENTIALS (Paymob official docs, "Setup & Authentication", and the official
 * PaymobAccept/API-Postman-Collections README):
 *   POST {base}/api/auth/tokens   body {"api_key": "<API KEY>"}  -> {"token": "..."}
 *   GET  {base}/api/acceptance/transactions/{id}   Authorization: Bearer {token}
 *
 * The credential that mints this token is the merchant **API Key**, NOT the **Secret Key**.
 * Paymob defines these as two separate credentials: the Secret Key authenticates Intentions
 * and post-pay APIs as `Authorization: Token <secret_key>`, while the API Key mints the
 * 60-minute bearer token used by Subscriptions, Transaction Inquiry and QuickLink.
 *
 * This file previously sent the Secret Key as `api_key` while its own comment claimed the
 * contract was verified against those docs. That combination is the worst of both: the
 * inquiry could never authenticate in production, and the failure did not surface as an
 * error - it surfaced as "refunds never verify", so every refund degraded to "no evidence"
 * and the guards built on that evidence waved payments through.
 */

export const PAYMOB_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Refresh early so an in-flight request never uses a token that expires mid-flight. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

const tokenSchema = z.object({ token: z.string().trim().min(1) });

// Only the fields we actually act on are modelled; everything else is ignored on purpose.
const transactionSchema = z.object({
  id: z.union([z.string().trim().min(1), z.number().int().positive()]).transform(String),
  amount_cents: z.number().int().nonnegative(),
  currency: z.string().trim().min(1),
  success: z.boolean(),
  pending: z.boolean(),
  is_refunded: z.boolean().optional(),
  refunded_amount_cents: z.number().int().nonnegative().nullable().optional(),
  is_voided: z.boolean().optional(),
  parent_transaction: z.unknown().optional()
});

export type PaymobInquiry = {
  transactionId: string;
  amountCents: number;
  currency: string;
  success: boolean;
  pending: boolean;
  refunded: boolean;
  refundedAmountCents: number;
};

export class PaymobInquiryError extends Error {
  readonly code: "PAYMENT_INQUIRY_UNAVAILABLE" | "PAYMENT_INQUIRY_INVALID";
  constructor(code: PaymobInquiryError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export type PaymobInquiryClientOptions = {
  fetchImpl?: typeof fetch;
  baseUrl: string;
  /**
   * The merchant API Key that mints the inquiry bearer token. Distinct from the Secret
   * Key used for intentions, and required - there is deliberately no fallback to it,
   * because a silent fallback would restore the exact defect this replaces.
   */
  apiKey: string;
  timeoutMs?: number;
  /** Injectable clock so token caching is testable without real waiting. */
  now?: () => Date;
};

export type PaymobInquiryClient = { query(transactionId: string): Promise<PaymobInquiry> };

export function createPaymobInquiryClient(options: PaymobInquiryClientOptions): PaymobInquiryClient {
  const apiKey = typeof options.apiKey === "string" ? options.apiKey.trim() : "";
  if (apiKey.length === 0) {
    // Fail closed at the boundary. Attempting the request anyway produced a call the
    // provider cannot authenticate, which surfaced far downstream as "refunds never
    // verify" rather than as the configuration fault it actually is.
    throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE",
      "Paymob API key is not configured; transaction inquiry cannot authenticate");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const base = options.baseUrl.replace(/\/+$/, "");
  let cachedToken: { token: string; expiresAtMs: number } | null = null;

  async function authToken(): Promise<string> {
    if (cachedToken && now().getTime() < cachedToken.expiresAtMs) return cachedToken.token;
    let response: Response;
    try {
      response = await fetchImpl(`${base}/api/auth/tokens`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000)
      });
    } catch {
      // Never echo the cause: it can carry the request headers, which hold the API key.
      throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE", "Paymob inquiry authentication failed");
    }
    if (!response.ok) throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE", "Paymob inquiry authentication failed");
    const parsed = tokenSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE", "Paymob inquiry authentication failed");
    cachedToken = { token: parsed.data.token, expiresAtMs: now().getTime() + PAYMOB_TOKEN_TTL_MS - TOKEN_EXPIRY_MARGIN_MS };
    return parsed.data.token;
  }

  return {
    async query(transactionId: string): Promise<PaymobInquiry> {
      const id = String(transactionId ?? "").trim();
      if (!id) throw new PaymobInquiryError("PAYMENT_INQUIRY_INVALID", "Paymob inquiry requires a transaction ID");
      const token = await authToken();
      let response: Response;
      try {
        response = await fetchImpl(`${base}/api/acceptance/transactions/${encodeURIComponent(id)}`, {
          method: "GET",
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(options.timeoutMs ?? 10_000)
        });
      } catch {
        throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE", "Paymob transaction inquiry failed");
      }
      if (!response.ok) throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE", "Paymob transaction inquiry failed");
      const parsed = transactionSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new PaymobInquiryError("PAYMENT_INQUIRY_INVALID", "Paymob transaction inquiry response is invalid");
      const raw = parsed.data;
      // The queried transaction must be the one the provider returned, otherwise the
      // caller could be told about a different payment than it asked for.
      if (raw.id !== id) throw new PaymobInquiryError("PAYMENT_INQUIRY_INVALID", "Paymob transaction inquiry returned a different transaction");
      const refunded = raw.is_refunded === true;
      // `refunded_amount_cents` is nullable. Treating null as zero when the provider says
      // refunded would silently discard a real refund, so that is an unresolved read.
      if (refunded && (raw.refunded_amount_cents === null || raw.refunded_amount_cents === undefined)) {
        throw new PaymobInquiryError("PAYMENT_INQUIRY_INVALID", "Paymob reported a refund without an authenticated amount");
      }
      const refundedAmountCents = refunded ? raw.refunded_amount_cents! : 0;
      if (refundedAmountCents > raw.amount_cents) {
        throw new PaymobInquiryError("PAYMENT_INQUIRY_INVALID", "Paymob refund exceeds the transaction amount");
      }
      return { transactionId: raw.id, amountCents: raw.amount_cents, currency: raw.currency, success: raw.success,
        pending: raw.pending, refunded, refundedAmountCents };
    }
  };
}

/** One-shot convenience wrapper; prefer `createPaymobInquiryClient` to reuse the cached token. */
export async function queryPaymobTransaction(input: PaymobInquiryClientOptions & { transactionId: string }): Promise<PaymobInquiry> {
  return createPaymobInquiryClient(input).query(input.transactionId);
}