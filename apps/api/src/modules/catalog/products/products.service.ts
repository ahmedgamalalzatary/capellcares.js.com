import { findVisibleProductBySlug, findVisibleProducts } from "../../../repositories/product.repository.js";
import type { Language } from "../../../types/domain.js";
import { toStorefrontProduct } from "./products.mapper.js";

export async function listStorefrontProducts(args: { lang: Language; q?: string; category?: string }) {
  const products = await findVisibleProducts(args);
  return products.map(toStorefrontProduct);
}

export async function getStorefrontProductBySlug(slug: string) {
  const product = await findVisibleProductBySlug(slug);
  return product ? toStorefrontProduct(product) : null;
}
