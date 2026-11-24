import type { Product } from "@capella/shared";
import { minVariantPrice } from "@/utils/product-grid.utils";

const CATEGORY_SECTION_PRODUCT_LIMIT = 12;

export function pickCategoryRowProducts(products: Product[]): Product[] {
  // Keep the category API's Featured order and apply the grid's default price filter before taking the preview.
  return products.filter((product) => {
    const price = minVariantPrice(product);
    return Number.isFinite(price) && price >= 0;
  }).slice(0, CATEGORY_SECTION_PRODUCT_LIMIT);
}
