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

  test("reads announcements and cancels an eligible order", async () => {
    global.fetch.mockResolvedValueOnce(response({ items: ["Hello"] })).mockResolvedValueOnce(response(order, 200));
    await expect(client.fetchAnnouncements({ lang: "en", throwOnError: true })).resolves.toEqual(["Hello"]);
    await expect(client.cancelCustomerOrder(1, "token", { lang: "ar" })).resolves.toEqual(order);
  });

  test.each([
    ["cart", c => c.fetchCustomerCart("token"), { lines: [{ ...lines[0], qty: -1 }] }],
    ["cancel", c => c.cancelCustomerOrder(1, "token"), { id: 1 }],
    ["announcements", c => c.fetchAnnouncements({ throwOnError: true }), { items: [42] }]
  ])("rejects malformed successful %s responses", async (_name, read, body) => {
    global.fetch.mockResolvedValue(response(body));
    await expect(Promise.resolve().then(() => read(client))).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });

});
