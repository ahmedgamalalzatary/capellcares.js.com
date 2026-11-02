import { productColorName, type CartLine, type Collection, type Language, type Offer, type Product, type ProductVariant } from "@capella/shared";

/** A product line's size and colour as shown to the customer; null for whichever the product does not have. A colour without a name shows its picked colour. */
export function productLineOptions(
  product: Pick<Product, "colors">,
  variant: Pick<ProductVariant, "size" | "colorId">,
  lang: Language
): { size: string | null; color: string | null } {
  const color = variant.colorId == null ? undefined : product.colors?.find((item) => item.id === variant.colorId);
  return {
    size: variant.size.trim() || null,
    color: color ? productColorName(color, lang) || color.hex : null
  };
}

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

/** The colour an order line was bought in, in the page language. */
export function orderLineColor(item: { snapshotColorAr?: string | null; snapshotColorEn?: string | null }, lang: Language): string | null {
  return (lang === "ar" ? item.snapshotColorAr || item.snapshotColorEn : item.snapshotColorEn || item.snapshotColorAr) || null;
}
