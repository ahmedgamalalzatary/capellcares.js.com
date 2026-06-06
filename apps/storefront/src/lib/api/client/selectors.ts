import type { Category, Offer, Product } from "@capella/shared";

export function getCategoryById(categories: Category[], id: number): Category | undefined {
  return categories.find((category) => category.id === id && !category.deletedAt);
}

export function getCategoryBySlug(categories: Category[], slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug && !category.deletedAt);
}

export function getCategoryPath(categories: Category[], id: number): Category[] {
  const path: Category[] = [];
  const visited = new Set<number>();
  let current = getCategoryById(categories, id);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId != null ? getCategoryById(categories, current.parentId) : undefined;
  }
  return path;
}

function getDescendantCategoryIds(categories: Category[], rootId: number): number[] {
  const ids = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parentId != null && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return Array.from(ids);
}

export function getProductsByCategory(products: Product[], categories: Category[], categoryId: number): Product[] {
  const ids = new Set(getDescendantCategoryIds(categories, categoryId));
  return products.filter((product) => ids.has(product.categoryId));
}

export function getOffersForProduct(offers: Offer[], products: Product[], productId: number): Offer[] {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product) {
    return [];
  }
  const variantIds = new Set(product.variants.map((variant) => variant.id));
  return offers.filter((offer) => offer.items.some((item) => variantIds.has(item.variantId)));
}
