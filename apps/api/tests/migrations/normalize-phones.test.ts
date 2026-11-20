import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test, { beforeEach } from "node:test";
import { inArray, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders } from "@capella/database/drizzle/schema";
import { normalizeEgyptianPhone } from "@capella/shared";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

const migrationPath = resolve(import.meta.dirname, "../../../../packages/database/drizzle/migrations/0069_normalize_phones.sql");

beforeEach(async () => {
  await resetApiTestDatabase();
});

// Older COD orders kept the phone as typed; the migration must rewrite them exactly as normalizeEgyptianPhone would today.
test("0068 rewrites stored phones in every accepted format to +20…, matching the shared normalizer", async () => {
  const ids = await getBaselineIds();
  const typed = ["01012345678", "00201112345678", "+201212345678", "1512345678", " 010 1234-5678 ", "+447700900123", "12345"];
  const codes = typed.map((_, index) => `PHONE-${index}`);
  await db.insert(orders).values(typed.map((phone, index) => ({
    orderCode: codes[index]!, customerType: "registered" as const, customerId: ids.customerId, fullName: "Phone Owner", phone,
    email: "phone@capella.test", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", paymentMethod: "cod" as const, paymentStatus: "pending" as const, totalAmount: "100.00"
  })));

  for (const statement of readFileSync(migrationPath, "utf8").split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
    await db.execute(sql.raw(statement));
  }

  const rows = await db.select({ orderCode: orders.orderCode, phone: orders.phone }).from(orders).where(inArray(orders.orderCode, codes));
  const stored = new Map(rows.map((row) => [row.orderCode, row.phone]));
  assert.deepEqual(codes.map((code) => stored.get(code)), typed.map((phone) => normalizeEgyptianPhone(phone)));
});
