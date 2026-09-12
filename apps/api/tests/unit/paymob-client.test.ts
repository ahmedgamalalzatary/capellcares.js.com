import assert from "node:assert/strict";
import test from "node:test";

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
