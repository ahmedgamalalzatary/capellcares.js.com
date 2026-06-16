export const listingTargetTypes = ["shop", "new", "bestsellers", "products", "offers", "collections"] as const;
export const detailTargetTypes = ["product", "offer", "collection", "category"] as const;
export const shopMediaTargetTypes = [...listingTargetTypes, ...detailTargetTypes] as const;

export function isListingTargetType(value: string): value is (typeof listingTargetTypes)[number] {
  return (listingTargetTypes as readonly string[]).includes(value);
}

export function isDetailTargetType(value: string): value is (typeof detailTargetTypes)[number] {
  return (detailTargetTypes as readonly string[]).includes(value);
}
