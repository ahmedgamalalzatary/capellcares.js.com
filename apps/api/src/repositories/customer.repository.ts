import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { customers } from "@capella/database/drizzle/schema";

export function findCustomerByEmail(email: string) {
  return db.select().from(customers).where(eq(customers.email, email)).limit(1).then((x) => x[0] ?? null);
}

export async function createCustomer(input: { name: string; email: string; passwordHash: string }) {
  const [row] = await db.insert(customers).values(input).$returningId();
  return row;
}
