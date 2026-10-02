import assert from "node:assert/strict";
import test from "node:test";

test("Paymob client does not expose the unsupported intention lookup", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-client.js");
  assert.equal("lookupPaymobIntentionBySpecialReference" in module, false);
});

test("Paymob inquiry authenticates with the API KEY, never the secret key", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-inquiry.client.js").catch(() => null);
  assert.ok(module?.queryPaymobTransaction, "a trusted inquiry client is required");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/auth/tokens")) {
      return new Response(JSON.stringify({ token: "tok_123" }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 574588, amount_cents: 13229, currency: "EGP", success: true,
      pending: false, is_refunded: false, refunded_amount_cents: null }), { status: 200 });
  };
  const result = await module.queryPaymobTransaction({ fetchImpl, baseUrl: "https://accept.paymob.com",
    apiKey: "pk_api", transactionId: "574588" });
  // Official contract: the API KEY mints the bearer token used by Transaction Inquiry.
  // The SECRET KEY is a different credential, sent as `Authorization: Token ...` for
  // Intentions - so sending it here means the inquiry can never authenticate.
  assert.equal(calls[0]!.url, "https://accept.paymob.com/api/auth/tokens");
  assert.equal(calls[0]!.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), { api_key: "pk_api" });
  assert.equal(calls[1]!.url, "https://accept.paymob.com/api/acceptance/transactions/574588");
  assert.equal(calls[1]!.init?.method, "GET");
  assert.equal(String(calls[1]!.init?.headers && new Headers(calls[1]!.init!.headers as HeadersInit).get("authorization")), "Bearer tok_123");
  assert.equal(result.refundedAmountCents, 0);
  assert.equal(result.amountCents, 13229);
});

test("a secret key in place of an API key fails closed instead of authenticating", async () => {
  // The defect this replaces was silent: the wrong credential produced a request the
  // provider cannot authenticate, which surfaced far downstream as "refunds never verify"
  // rather than as a configuration error. Failing closed makes it obvious at the boundary.
  const module = await import("../../src/modules/payments/paymob/paymob-inquiry.client.js");
  let attempted = false;
  const fetchImpl: typeof fetch = async () => {
    attempted = true;
    return new Response(JSON.stringify({ token: "tok" }), { status: 200 });
  };
  await assert.rejects(
    () => module.queryPaymobTransaction({ fetchImpl, baseUrl: "https://accept.paymob.com",
      secretKey: "sk_secret", transactionId: "574588" } as never),
    /API key/i,
    "the inquiry must refuse to run without an explicit API key");
  assert.equal(attempted, false, "no request may be attempted with the wrong credential");
});

test("the auth token is cached across inquiries instead of minted per callback", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-inquiry.client.js");
  let authCalls = 0;
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).endsWith("/api/auth/tokens")) { authCalls++; return new Response(JSON.stringify({ token: "tok_cached" }), { status: 200 }); }
    return new Response(JSON.stringify({ id: Number(url.split("/").pop()), amount_cents: 100, currency: "EGP",
      success: true, pending: false, is_refunded: false, refunded_amount_cents: null }), { status: 200 });
  };
  const client = module.createPaymobInquiryClient({ fetchImpl, baseUrl: "https://accept.paymob.com",
    apiKey: "pk_api", now: () => new Date("2026-10-01T00:00:00Z") });
  await client.query("1");
  await client.query("2");
  assert.equal(authCalls, 1, "one token serves both lookups");
});

test("an inquiry response missing identity, currency or amount is rejected rather than guessed", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-inquiry.client.js");
  for (const bad of [{ amount_cents: 100, currency: "EGP" }, { id: 5, currency: "EGP" },
    { id: 5, amount_cents: 100 }, { id: 5, amount_cents: 100, currency: "EGP", success: "yes" }]) {
    const fetchImpl: typeof fetch = async (url) => String(url).endsWith("/api/auth/tokens")
      ? new Response(JSON.stringify({ token: "t" }), { status: 200 })
      : new Response(JSON.stringify(bad), { status: 200 });
    const client = module.createPaymobInquiryClient({ fetchImpl, baseUrl: "https://accept.paymob.com", apiKey: "pk_api" });
    await assert.rejects(client.query("5"), /invalid|unavailable|mismatch/i, JSON.stringify(bad));
  }
});

test("a nullable refund amount is only treated as zero when the provider also says not refunded", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-inquiry.client.js");
  const build = (body: unknown) => module.createPaymobInquiryClient({ fetchImpl: async (url: any) =>
    String(url).endsWith("/api/auth/tokens") ? new Response(JSON.stringify({ token: "t" }), { status: 200 })
      : new Response(JSON.stringify(body), { status: 200 }), baseUrl: "https://accept.paymob.com", apiKey: "pk_api" });
  const plain = await build({ id: 5, amount_cents: 100, currency: "EGP", success: true, pending: false,
    is_refunded: false, refunded_amount_cents: null }).query("5");
  assert.equal(plain.refundedAmountCents, 0, "not refunded means zero refunded");
  // The provider says refunded but omits the amount: that is uncertain, not "no refund".
  await assert.rejects(build({ id: 5, amount_cents: 100, currency: "EGP", success: true, pending: false,
    is_refunded: true, refunded_amount_cents: null }).query("5"), /refund|uncertain|mismatch/i);
  const partial = await build({ id: 5, amount_cents: 100, currency: "EGP", success: true, pending: false,
    is_refunded: true, refunded_amount_cents: 40 }).query("5");
  assert.equal(partial.refundedAmountCents, 40);
});

test("a provider outage or malformed response yields an unresolved inquiry, never a fabricated zero", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-inquiry.client.js");
  const build = (respond: () => Response) => module.createPaymobInquiryClient({
    fetchImpl: async (url: any) => String(url).endsWith("/api/auth/tokens")
      ? new Response(JSON.stringify({ token: "t" }), { status: 200 }) : respond(), baseUrl: "https://accept.paymob.com", apiKey: "pk_api" });
  for (const [label, respond] of [
    ["503", () => new Response("unavailable", { status: 503 })],
    ["500", () => new Response("{}", { status: 500 })],
    ["non-json 200", () => new Response("not json", { status: 200 })],
    ["missing fields", () => new Response(JSON.stringify({ id: 5 }), { status: 200 })]
  ] as const) {
    await assert.rejects(build(respond).query("5"), /inquiry|unavailable|invalid|mismatch/i, label);
  }
});

test("inquiry output never carries the api key or auth token", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-inquiry.client.js");
  const fetchImpl: typeof fetch = async (url) => String(url).endsWith("/api/auth/tokens")
    ? new Response(JSON.stringify({ token: "super_secret_token" }), { status: 200 })
    : new Response(JSON.stringify({ id: 5, amount_cents: 100, currency: "EGP", success: true, pending: false,
      is_refunded: false, refunded_amount_cents: null }), { status: 200 });
  const client = module.createPaymobInquiryClient({ fetchImpl, baseUrl: "https://accept.paymob.com", apiKey: "super_secret_key" });
  const result = await client.query("5");
  const text = JSON.stringify(result);
  assert.equal(text.includes("super_secret_key"), false);
  assert.equal(text.includes("super_secret_token"), false);
});

test("createPaymobIntention sends the authoritative amount and maps public checkout data", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-client.js").catch(() => null);
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({
      id: "pi_test_abc",
      intention_order_id: 9001,
      client_secret: "egy_csk_test_abc",
      payment_methods: [{ integration_id: 5885253, name: "Card", method_type: "online", currency: "EGP", live: false }],
      special_reference: "checkout_attempt_1",
      confirmed: false,
      status: "intended",
      created: "2026-09-11T12:00:00Z",
      payment_keys: [],
      intention_detail: { amount: 12550, currency: "EGP", items: [], billing_data: {} },
      extras: {},
      card_detail: null,
      card_tokens: [],
      object: "paymentintention"
    }), { status: 201, headers: { "content-type": "application/json" } });
  };

  const result = await module?.createPaymobIntention({
    fetchImpl,
    baseUrl: "https://accept.paymob.com",
    secretKey: "sk_test_secret",
    publicKey: "pk_test_public",
    amountCents: 12550,
    integrationIds: [5885253],
    specialReference: "checkout_attempt_1",
    expirationSeconds: 1800,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    billingData: {
      first_name: "Test",
      last_name: "Customer",
      email: "test@example.com",
      phone_number: "+201012345678"
    },
    items: [{ name: "Product", amount: 12550, quantity: 1 }]
  });

  assert.equal(capturedUrl, "https://accept.paymob.com/v1/intention/");
  assert.equal(new Headers(capturedInit?.headers).get("authorization"), "Token sk_test_secret");
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    amount: 12550,
    currency: "EGP",
    payment_methods: [5885253],
    items: [{ name: "Product", amount: 12550, quantity: 1 }],
    billing_data: {
      first_name: "Test",
      last_name: "Customer",
      email: "test@example.com",
      phone_number: "+201012345678"
    },
    special_reference: "checkout_attempt_1",
    expiration: 1800,
    notification_url: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirection_url: "https://capellacares.com/checkout/payment-result"
  });
  assert.deepEqual(result, {
    intentionId: "pi_test_abc",
    orderId: 9001,
    clientSecret: "egy_csk_test_abc",
    checkoutUrl: "https://eg.checkout.paymob.com/?publicKey=pk_test_public&clientSecret=egy_csk_test_abc"
  });
});

test("createPaymobIntention aborts a stalled provider request", async () => {
  const { createPaymobIntention } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const request = createPaymobIntention({
    fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      if (!init?.signal) {
        reject(new Error("Paymob request has no abort signal"));
        return;
      }
      init.signal.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }),
    baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
    amountCents: 100, integrationIds: [123], specialReference: "ref_1", expirationSeconds: 1800,
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    billingData: { first_name: "Test", last_name: "User", email: "test@example.com", phone_number: "+201012345678" },
    items: [], timeoutMs: 20
  });
  await assert.rejects(request, /timed out/i);
});

test("createPaymobIntention classifies malformed successful provider JSON as a provider failure", async () => {
  const { createPaymobIntention, PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  await assert.rejects(createPaymobIntention({
    fetchImpl: async () => new Response("not-json", { status: 201 }),
    baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
    amountCents: 100, integrationIds: [123], specialReference: "ref_bad_json", expirationSeconds: 1800,
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    billingData: { first_name: "Test", last_name: "User", email: "test@example.com", phone_number: "+201012345678" },
    items: []
  }), PaymobProviderError);
});
