import type { Language, WishlistItemDto } from "@capella/shared";
import { addWishlistItem, listWishlistEntriesByCustomer, removeWishlistItem } from "../../repositories/wishlist.repository.js";

export function getWishlist(customerId: number, lang: Language = "ar") {
  return listWishlistEntriesByCustomer(customerId, lang);
}

export async function addToWishlist(customerId: number, entityType: WishlistItemDto["entityType"], entityId: number) {
  await addWishlistItem(customerId, entityType, entityId);
}

export async function deleteFromWishlist(customerId: number, entityType: WishlistItemDto["entityType"], entityId: number) {
  await removeWishlistItem(customerId, entityType, entityId);
}
