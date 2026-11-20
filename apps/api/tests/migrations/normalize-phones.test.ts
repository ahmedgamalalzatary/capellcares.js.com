import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test, { beforeEach } from "node:test";
import { inArray, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders } from "@capella/database/drizzle/schema";
import { normalizeKuwaitiPhone } from "@capella/shared";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

const migrationPath = resolve(import.meta.dirname, "../../../../packages/database/drizzle/migrations/0079_normalize_phones.sql");

beforeEach(async () => {
  await resetApiTestDatabase();
});

// Older orders kept the phone as typed; the migration must rewrite them exactly as normalizeKuwaitiPhone would today.
test("0079 rewrites stored phones in every accepted format to +965…, matching the shared normalizer", async () => {
  const ids = await getBaselineIds();
  const typed = ["55123456", "+96566123456", "0096599123456", " 5512-3456 ", "+96555123456", "01012345678", "12345"];
  const codes = typed.map((_, index) => `PHONE-${index}`);
  await db.insert(orders).values(typed.map((phone, index) => ({
    orderCode: codes[index]!, customerType: "registered" as const, customerId: ids.customerId, fullName: "Phone Owner", phone,
    email: "phone@capella.test", governorate: "Capital", cityArea: "Sharq", addressLine: "Street 1", buildingApartment: "1",
    notes: "", paymentMethod: "cod" as const, paymentStatus: "pending" as const, totalAmount: "10.000"
  })));

  for (const statement of readFileSync(migrationPath, "utf8").split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
    await db.execute(sql.raw(statement));
  }

  const rows = await db.select({ orderCode: orders.orderCode, phone: orders.phone }).from(orders).where(inArray(orders.orderCode, codes));
  const stored = new Map(rows.map((row) => [row.orderCode, row.phone]));
  assert.deepEqual(codes.map((code) => stored.get(code)), typed.map((phone) => normalizeKuwaitiPhone(phone)));
});
