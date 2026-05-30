import type { Offer, Product } from "@capella/shared";
import type { RelatedOption } from "./related-items-field";

/**
 * Builds the selectable related-item options from the ERP store: active,
 * non-deleted products and offers. The forms themselves drop the current
 * entity so it can't relate to itself.
 */
export function buildRelatedOptions(products: Product[], offers: Offer[]): RelatedOption[] {
  return [
    ...products
      .filter((product) => !product.deletedAt && product.status === "active")
      .map((product) => ({ type: "product" as const, id: product.id, name: product.name, slug: product.slug })),
    ...offers
      .filter((offer) => !offer.deletedAt && offer.status === "active")
      .map((offer) => ({ type: "offer" as const, id: offer.id, name: offer.name, slug: offer.slug }))
  ];
}
