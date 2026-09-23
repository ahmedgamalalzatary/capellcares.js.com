import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { carts, type StoredCartLine } from "@capella/database/drizzle/schema";

export async function getCartLinesByCustomer(customerId: number): Promise<StoredCartLine[]> {
  const rows = await db
    .select({ lines: carts.lines })
    .from(carts)
    .where(eq(carts.customerId, customerId))
    .limit(1);
  return rows[0]?.lines ?? [];
}

export async function saveCartLinesForCustomer(customerId: number, lines: StoredCartLine[]): Promise<StoredCartLine[]> {
  // Single atomic upsert keyed by the unique customer_id. A read-then-insert
  // implementation races when concurrent PUTs create the first cart row and
  // fails the loser with a duplicate-key error.
  await db
    .insert(carts)
    .values({ customerId, lines })
    .onDuplicateKeyUpdate({ set: { lines } });

  return lines;
}
