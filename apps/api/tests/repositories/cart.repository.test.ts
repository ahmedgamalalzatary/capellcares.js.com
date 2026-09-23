import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { customers, type StoredCartLine } from "@capella/database/drizzle/schema";
import { getCartLinesByCustomer, saveCartLinesForCustomer } from "../../src/repositories/cart.repository.js";
import { resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

async function createCartlessCustomer(email: string) {
  const [customer] = await db
    .insert(customers)
    .values({ name: "Cart Upsert Customer", email, passwordHash: "test-hash" })
    .$returningId();
  return customer.id;
}

test("concurrent first-time cart saves upsert atomically instead of racing on insert", async () => {
  const customerId = await createCartlessCustomer("cart-upsert-race@capella.test");
  const linesA: StoredCartLine[] = [{ type: "offer", offerId: 1, qty: 1 }];
  const linesB: StoredCartLine[] = [{ type: "product", productId: 2, variantId: 3, qty: 2 }];

  // Two PUTs racing for a customer with no cart row yet must both succeed;
  // a read-then-insert implementation would fail the loser with a duplicate key.
  await Promise.all([
    saveCartLinesForCustomer(customerId, linesA),
    saveCartLinesForCustomer(customerId, linesB)
  ]);

  // MySQL JSON columns return object keys in normalized order, so compare
  // canonically rather than with a raw JSON.stringify.
  const canonical = (lines: unknown[]) =>
    JSON.stringify(lines, (_key, value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce((acc, key) => ({ ...acc, [key]: (value as Record<string, unknown>)[key] }), {})
        : value
    );

  const stored = await getCartLinesByCustomer(customerId);
  assert.ok(
    canonical(stored) === canonical(linesA) || canonical(stored) === canonical(linesB),
    `expected either writer's lines, got ${JSON.stringify(stored)}`
  );
});

test("saving an existing cart updates its lines in place", async () => {
  const customerId = await createCartlessCustomer("cart-upsert-update@capella.test");
  const first: StoredCartLine[] = [{ type: "collection", collectionId: 4, qty: 1 }];
  const second: StoredCartLine[] = [{ type: "collection", collectionId: 5, qty: 2 }];

  await saveCartLinesForCustomer(customerId, first);
  await saveCartLinesForCustomer(customerId, second);

  assert.deepEqual(await getCartLinesByCustomer(customerId), second);
});
