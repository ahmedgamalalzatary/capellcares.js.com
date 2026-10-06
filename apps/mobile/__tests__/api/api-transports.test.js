jest.mock("../../src/lib/api/base", () => ({ API_BASE: "https://api.example.com" }));

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => body, text: async () => JSON.stringify(body)
});
const lines = [{ type: "product", productId: 2, variantId: 3, qty: 1 }];
const address = { cityId: "c", zoneId: "z", districtId: "d",
  cityName: { ar: "مدينة", en: "City" }, zoneName: { ar: "منطقة", en: "Zone" },
  districtName: { ar: "حي", en: "District" } };
const quote = { quoteId: "q1", shippingAmountCents: 1000, size: "small", rateIdentity: "rate1",
  quotedAt: "2026-10-05T10:00:00.000Z", productsTotalCents: 2000, amountCents: 3000,
  codAmountCents: 3000, paymentMethod: "cod", address };
const status = { checkoutId: "checkout_abc", status: "payment_pending",
  expiresAt: "2026-10-05T11:00:00.000Z", attemptsUsed: 1, latestAttemptStatus: "failed",
  canRetry: true, order: null };
const order = { id: 1, orderCode: "ORD1", customerType: "registered", customerId: 7,
  fullName: "Customer", phone: "01012345678", email: "customer@example.com", governorate: "Cairo",
  cityArea: "City", addressLine: "Street", buildingApartment: "1", notes: null,
  paymentMethod: "cod", paymentStatus: "pending", providerPaymentStatus: null,
  refundedAmountCents: 0, totalAmount: 30, createdAt: "2026-10-05T10:00:00.000Z", items: [] };

describe("mobile remaining transport boundaries", () => {
  let client;
  beforeEach(() => { jest.resetModules(); global.fetch = jest.fn(); client = require("../../src/lib/api/client"); });
  afterEach(() => { delete global.fetch; });

  test("reads and replaces the server cart using authenticated PUT and the selected language", async () => {
    global.fetch.mockResolvedValue(response({ lines }));
    expect(typeof client.fetchCustomerCart).toBe("function");
    await expect(client.fetchCustomerCart("token", { lang: "ar" })).resolves.toEqual(lines);
    await expect(client.replaceCustomerCart("token", lines, { lang: "en" })).resolves.toEqual(lines);
    expect(global.fetch.mock.calls[1]).toEqual(["https://api.example.com/api/v1/cart", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ lines }),
      headers: expect.objectContaining({ authorization: "Bearer token", "x-lang": "en" })
    })]);
  });

  test("reads announcements, shipping destinations and authoritative quotes", async () => {
    global.fetch.mockResolvedValueOnce(response({ items: ["Hello"] }))
      .mockResolvedValueOnce(response({ enabled: true, addresses: [address] }))
      .mockResolvedValueOnce(response(quote, 201));
    expect(typeof client.fetchAnnouncements).toBe("function");
    await expect(client.fetchAnnouncements({ lang: "en", throwOnError: true })).resolves.toEqual(["Hello"]);
    await expect(client.fetchCheckoutShipping({ lang: "ar" })).resolves.toEqual({ enabled: true, addresses: [address] });
    const input = { items: [{ type: "product", variantId: 3, qty: 1 }], paymentMethod: "cod",
      shippingAddress: { cityId: "c", zoneId: "z", districtId: "d" } };
    await expect(client.fetchCheckoutShippingQuote(input, "token", { lang: "ar" })).resolves.toEqual(quote);
    expect(global.fetch.mock.calls[2]).toEqual(["https://api.example.com/api/v1/checkout/shipping/quote",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) })]);
  });

  test("reads payment methods and status, retries payment, and cancels an eligible order", async () => {
    const redirect = { kind: "paymob_redirect", checkoutId: "checkout_abc", checkoutUrl: "https://accept.paymob.com/pay",
      expiresAt: status.expiresAt };
    global.fetch.mockResolvedValueOnce(response({ available: true, methods: ["card", "wallet"] }))
      .mockResolvedValueOnce(response(status)).mockResolvedValueOnce(response(redirect, 201))
      .mockResolvedValueOnce(response(order, 202));
    expect(typeof client.fetchPaymobMethods).toBe("function");
    await expect(client.fetchPaymobMethods()).resolves.toEqual({ available: true, methods: ["card", "wallet"] });
    await expect(client.fetchCheckoutStatus("checkout/abc")).resolves.toEqual(status);
    await expect(client.retryPaymobCheckout("checkout/abc", { lang: "ar" })).resolves.toEqual(redirect);
    await expect(client.cancelCustomerOrder(1, "token", { lang: "ar" })).resolves.toEqual(order);
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.com/api/v1/payments/paymob/methods",
      "https://api.example.com/api/v1/checkout/checkout%2Fabc/status",
      "https://api.example.com/api/v1/checkout/checkout%2Fabc/retry",
      "https://api.example.com/api/v1/orders/1/cancel"
    ]);
  });

  test("accepts the API's succeeded and voided provider-payment states", async () => {
    global.fetch.mockResolvedValueOnce(response({ ...order, providerPaymentStatus: "succeeded" }))
      .mockResolvedValueOnce(response({ ...order, providerPaymentStatus: "voided" }));
    await expect(client.cancelCustomerOrder(1, "token")).resolves.toMatchObject({ providerPaymentStatus: "succeeded" });
    await expect(client.cancelCustomerOrder(1, "token")).resolves.toMatchObject({ providerPaymentStatus: "voided" });
  });

  test.each([
    ["cart", c => c.fetchCustomerCart("token"), { lines: [{ ...lines[0], qty: -1 }] }],
    ["shipping", c => c.fetchCheckoutShipping(), { enabled: true, addresses: [{}] }],
    ["quote", c => c.fetchCheckoutShippingQuote({}, null), { ...quote, amountCents: -1 }],
    ["methods", c => c.fetchPaymobMethods(), { available: true, methods: ["cash"] }],
    ["status", c => c.fetchCheckoutStatus("abc"), { ...status, canRetry: "yes" }],
    ["retry", c => c.retryPaymobCheckout("abc"), { kind: "cod_order", id: 1, orderCode: "ORD", paymentStatus: "pending" }],
    ["cancel", c => c.cancelCustomerOrder(1, "token"), { id: 1 }],
    ["announcements", c => c.fetchAnnouncements({ throwOnError: true }), { items: [42] }]
  ])("rejects malformed successful %s responses", async (_name, read, body) => {
    global.fetch.mockResolvedValue(response(body));
    await expect(Promise.resolve().then(() => read(client))).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });

  test("preserves shipping and payment errors and never repeats an uncertain payment mutation", async () => {
    expect(typeof client.fetchCheckoutShippingQuote).toBe("function");
    global.fetch.mockResolvedValueOnce(response({ code: "SHIPPING_QUOTE_CHANGED", message: "Review total" }, 409));
    await expect(client.fetchCheckoutShippingQuote({}, null)).rejects.toMatchObject({ status: 409, code: "SHIPPING_QUOTE_CHANGED" });
    global.fetch.mockRejectedValueOnce(new TypeError("connection lost"));
    await expect(client.retryPaymobCheckout("abc")).rejects.toThrow("connection lost");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
