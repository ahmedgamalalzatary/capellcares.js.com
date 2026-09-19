import type { CartLine, Collection, Offer, Product } from "@capella/shared";

function sizeForVariantId(variantId: number, products: Product[]): string | null {
  for (const product of products) {
    const variant = product.variants.find((item) => item.id === variantId);
    if (variant) return variant.size;
  }
  return null;
}

function uniqueSizes(sizes: Array<string | null>): string | null {
  const labels = [...new Set(sizes.filter((size): size is string => Boolean(size)))];
  return labels.length > 0 ? labels.join(", ") : null;
}

export function cartLineSizeLabel(
  line: CartLine,
  catalog: { products: Product[]; offers: Offer[]; collections: Collection[] }
): string | null {
  if (line.type === "product") {
    return sizeForVariantId(line.variantId, catalog.products);
  }

  const items = line.type === "offer"
    ? catalog.offers.find((offer) => offer.id === line.offerId)?.items
    : catalog.collections.find((collection) => collection.id === line.collectionId)?.items;

  if (!items?.length) return null;
  return uniqueSizes(items.map((item) => sizeForVariantId(item.variantId, catalog.products)));
}
