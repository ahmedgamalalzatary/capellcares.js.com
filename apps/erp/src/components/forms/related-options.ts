import type { Collection, Offer, Product } from "@capella/shared";
import type { RelatedOption } from "./related-items-field";

/**
 * Builds the selectable related-item options from the ERP store: active,
 * non-deleted products and offers. The forms themselves drop the current
 * entity so it can't relate to itself.
 */
export function buildRelatedOptions(products: Product[], offers: Offer[], collections: Collection[] = []): RelatedOption[] {
  return [
    ...products
      .filter((product) => !product.deletedAt && product.status === "active")
      .map((product) => ({ type: "product" as const, id: product.id, name: product.name, slug: product.slug })),
    ...offers
      .filter((offer) => !offer.deletedAt && offer.status === "active")
      .map((offer) => ({ type: "offer" as const, id: offer.id, name: offer.name, slug: offer.slug })),
    ...collections
      .filter((collection) => !collection.deletedAt && collection.status === "active")
      .map((collection) => ({ type: "collection" as const, id: collection.id, name: collection.name, slug: collection.slug }))
  ];
}
