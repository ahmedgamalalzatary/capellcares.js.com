import { products } from "../../../data/store.js";
import type { Product } from "../../../types/domain.js";

function toSlug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function canActivateProduct(input: Product) {
  return Boolean(
    input.arName &&
      input.enName &&
      input.keywords.length > 0 &&
      input.imagePath &&
      input.categorySlug &&
      input.variants.length > 0
  );
}

export function listAdminProducts() {
  return products.filter((p) => p.deletedAt === null);
}

export function createAdminProduct(input: Omit<Product, "id" | "slug" | "deletedAt">) {
  const id = products.length + 1;
  const slug = toSlug(input.enName);
  const product: Product = { ...input, id, slug, deletedAt: null };
  if (product.status === "active" && !canActivateProduct(product)) {
    throw new Error("Cannot activate incomplete product");
  }
  products.push(product);
  return product;
}
