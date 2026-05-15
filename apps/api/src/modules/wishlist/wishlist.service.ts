import { addWishlistItem, listWishlistByCustomer, removeWishlistItem } from "../../repositories/wishlist.repository.js";

export function getWishlist(customerId: number) {
  return listWishlistByCustomer(customerId);
}

export async function addToWishlist(customerId: number, productId: number) {
  await addWishlistItem(customerId, productId);
}

export async function deleteFromWishlist(customerId: number, productId: number) {
  await removeWishlistItem(customerId, productId);
}
