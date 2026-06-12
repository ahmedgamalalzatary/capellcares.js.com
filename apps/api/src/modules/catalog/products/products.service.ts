import { findVisibleProductBySlug, findVisibleProducts } from "../../../repositories/product.repository.js";
import { getStorefrontRelatedCardsRepo } from "../../../repositories/related-item.repository.js";
import type { Language } from "../../../types/domain.js";
import { toStorefrontProduct } from "./products.mapper.js";

export async function listStorefrontProducts(args: { lang: Language; q?: string; category?: string; categoryId?: string }) {
  const products = await findVisibleProducts(args);
  return products.map(toStorefrontProduct);
}

export async function getStorefrontProductBySlug(slug: string) {
  const product = await findVisibleProductBySlug(slug);
  if (!product) {
    return null;
  }
  const relatedItems = await getStorefrontRelatedCardsRepo({ type: "product", id: product.id });
  return { ...toStorefrontProduct(product), relatedItems };
}
