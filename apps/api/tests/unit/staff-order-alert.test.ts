import assert from "node:assert/strict";
import test from "node:test";

import { buildNewOrderAlertText, sendNewOrderAlert, type NewOrderAlert } from "../../src/services/staff-order-alert.service.js";

const order: NewOrderAlert = {
  id: 42,
  orderCode: "ORD-1042",
  fullName: "Sara Ali",
  phone: "96551234567",
  items: [
    { nameAr: "سكوتر", sizeLabel: "كبير", qty: 2, lineTotal: 30 },
    { nameAr: "ليجو", sizeLabel: null, qty: 1, lineTotal: 12.5 }
  ],
  deliveryFee: 1.5,
  totalAmount: 44
};

const env = {
  OPENWA_URL: "http://openwa:2785/",
  OPENWA_API_KEY: "owa_k1_secret",
  OPENWA_SESSION_ID: "session-1",
  STAFF_WHATSAPP_NUMBER: "+965 5000 1111",
  ERP_PUBLIC_URL: "https://erp.example.com/"
};

test("the alert text names the order, customer, every item, the total and the ERP link, in Arabic", () => {
  const text = buildNewOrderAlertText(order, "https://erp.example.com");
  assert.match(text, /طلب جديد/);
  assert.match(text, /ORD-1042/);
  assert.match(text, /Sara Ali/);
  assert.match(text, /96551234567/);
  assert.match(text, /سكوتر \(كبير\) × 2/);
  assert.match(text, /ليجو × 1/);
  assert.match(text, /https:\/\/erp\.example\.com\/orders\/42/);
});

test("sends the alert to the staff number through OpenWA's send-text endpoint", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return new Response(JSON.stringify({ messageId: "x" }), { status: 201 });
  };

  const sent = await sendNewOrderAlert(order, { env, fetchFn });

  assert.equal(sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "http://openwa:2785/api/sessions/session-1/messages/send-text");
  assert.equal(calls[0]!.init.method, "POST");
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers["X-API-Key"], "owa_k1_secret");
  assert.equal(headers["Idempotency-Key"], "new-order-42");
  const body = JSON.parse(String(calls[0]!.init.body));
  assert.equal(body.chatId, "96550001111@c.us");
  assert.match(body.text, /https:\/\/erp\.example\.com\/orders\/42/);
});

test("does nothing when OpenWA is not configured", async () => {
  let called = false;
  const sent = await sendNewOrderAlert(order, { env: {}, fetchFn: async () => { called = true; return new Response(); } });
  assert.equal(sent, false);
  assert.equal(called, false);
});

test("never throws when OpenWA fails or is unreachable, so the order is unaffected", async () => {
  const errors: unknown[] = [];
  const logger = { error: (...args: unknown[]) => errors.push(args) };
  assert.equal(await sendNewOrderAlert(order, { env, logger, fetchFn: async () => new Response("down", { status: 503 }) }), false);
  assert.equal(await sendNewOrderAlert(order, { env, logger, fetchFn: async () => { throw new Error("ECONNREFUSED"); } }), false);
  assert.equal(errors.length, 2);
});

test("tells staff whether to collect cash or the order is already paid online", () => {
  assert.match(buildNewOrderAlertText({ ...order, paymentMethod: "cod" }), /الدفع: عند الاستلام/);
  assert.match(buildNewOrderAlertText({ ...order, paymentMethod: "paymob" }), /الدفع: مدفوع أونلاين/);
});
