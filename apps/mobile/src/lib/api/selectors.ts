import type { Category, Offer, Product } from "@capella/shared";

export function getCategoryById(
  categories: Category[],
  id: number
): Category | undefined {
  return categories.find((category) => category.id === id && !category.deletedAt);
}

export function getCategoryBySlug(
  categories: Category[],
  slug: string
): Category | undefined {
  const matches = categories.filter(
    (category) => category.slug === slug && !category.deletedAt
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function getCategoryPath(categories: Category[], id: number): Category[] {
  const path: Category[] = [];
  const visited = new Set<number>();
  let current = getCategoryById(categories, id);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current =
      current.parentId == null
        ? undefined
        : getCategoryById(categories, current.parentId);
  }
  return path;
}

export function getOffersForProduct(
  offers: Offer[],
  products: Product[],
  productId: number
): Offer[] {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product) {
    return [];
  }
  const variantIds = new Set(product.variants.map((variant) => variant.id));
  return offers.filter((offer) =>
    offer.items.some((item) => variantIds.has(item.variantId))
  );
}
