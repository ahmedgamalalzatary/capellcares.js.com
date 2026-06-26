import { eq } from "drizzle-orm";
import { db } from "@minikoshk/database/src/db";
import { customers } from "@minikoshk/database/drizzle/schema";

export function findCustomerById(id: number) {
  return db.select().from(customers).where(eq(customers.id, id)).limit(1).then((x) => x[0] ?? null);
}

export function findCustomerByEmail(email: string) {
  return db.select().from(customers).where(eq(customers.email, email)).limit(1).then((x) => x[0] ?? null);
}

export async function createCustomer(input: { name: string; email: string; passwordHash: string }) {
  const [row] = await db.insert(customers).values(input).$returningId();
  return row;
}
