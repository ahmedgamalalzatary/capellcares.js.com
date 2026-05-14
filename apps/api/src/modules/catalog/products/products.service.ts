import { findVisibleProductBySlug, findVisibleProducts } from "../../../repositories/product.repository.js";
import type { Language } from "../../../types/domain.js";

export async function listStorefrontProducts(args: { lang: Language; q?: string; category?: string }) {
  return findVisibleProducts(args);
}

export async function getStorefrontProductBySlug(slug: string) {
  return findVisibleProductBySlug(slug);
}
