import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { paymentWebhookEvents } from "@capella/database/drizzle/schema";
import { recordPaymobTransaction } from "../../src/modules/payments/paymob/paymob-webhook.service.js";
import { resetApiTestDatabase } from "../helpers/database.js";

beforeEach(resetApiTestDatabase);

test("recordPaymobTransaction keeps test and live callbacks with the same id distinct", async () => {
  const base = {
    id: 42,
    success: true,
    pending: false,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_voided: false,
    refunded_amount_cents: 0,
    captured_amount: 10000,
    order: { id: 9001 },
    integration_id: 123
  };

  await recordPaymobTransaction({ ...base, is_live: false }, "rejected");
  await recordPaymobTransaction({ ...base, is_live: false }, "rejected");
  await recordPaymobTransaction({ ...base, is_live: true }, "rejected");

  const events = await db.select().from(paymentWebhookEvents);
  assert.equal(events.length, 2, "a duplicate test callback is deduplicated, the live one is not");
});
