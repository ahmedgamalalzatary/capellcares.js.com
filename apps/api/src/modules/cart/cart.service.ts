import type { StoredCartLine } from "@capella/database/drizzle/schema";
import { getCartLinesByCustomer, saveCartLinesForCustomer } from "./cart.repository.js";

export function getCart(customerId: number) {
  return getCartLinesByCustomer(customerId);
}

export async function saveCart(customerId: number, lines: StoredCartLine[]) {
  return saveCartLinesForCustomer(customerId, lines);
}
