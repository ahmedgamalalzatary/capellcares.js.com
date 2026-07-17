"use client";

import type { CheckoutItemDto, CheckoutRequestDto, Order } from "@minikoshk/shared";
import { apiSendAuthed } from "./auth";
import type { CartLine } from "./cart";

/** Cart lines already mirror the checkout DTO — this is just the type bridge. */
export function toCheckoutItems(lines: CartLine[]): CheckoutItemDto[] {
  return lines.map((line): CheckoutItemDto => {
    switch (line.type) {
      case "product":
        return { type: "product", variantId: line.variantId, qty: line.qty };
      case "offer":
        return { type: "offer", offerId: line.offerId, qty: line.qty };
      case "collection":
        return { type: "collection", collectionId: line.collectionId, qty: line.qty };
    }
  });
}

/**
 * `POST /api/v1/checkout`. The API attaches the customer id itself from the
 * Bearer token (guests order fine without one), and returns the created order.
 * An expired token is refreshed transparently so registered customers' orders
 * stay linked to their account.
 */
export async function submitCheckout(request: Omit<CheckoutRequestDto, "customerId">): Promise<Order> {
  return apiSendAuthed<Order>("/checkout", { body: request });
}
