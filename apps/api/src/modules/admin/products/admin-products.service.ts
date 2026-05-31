import { addVariantRepo, createAdminProductRepo, listAdminProductsRepo } from "../../../repositories/product.repository.js";
import type { Product } from "../../../types/domain.js";
import {
  canActivateAdminProduct,
  normalizeAdminProductInput,
  type ErpProductInput,
  type NormalizedProductInput
} from "./lib/admin-product-input.js";

function toSlug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function listAdminProducts() {
  return listAdminProductsRepo();
}

export async function createAdminProduct(input: Omit<Product, "id" | "slug" | "deletedAt"> | ErpProductInput) {
  const normalized: NormalizedProductInput = normalizeAdminProductInput(input);
  const slugBase = normalized.enName || normalized.arName || normalized.sku || "product";
  const slug = toSlug(slugBase);
  if (normalized.status === "active" && !canActivateAdminProduct(normalized)) {
    throw new Error("Cannot activate incomplete product");
  }
  const created = await createAdminProductRepo({
    sku: normalized.sku ?? "",
    slug,
    arName: normalized.arName,
    enName: normalized.enName,
    buyingPrice: normalized.buyingPrice,
    keywords: normalized.keywords.join(","),
    arDescription: normalized.arDescription ?? null,
    enDescription: normalized.enDescription ?? null,
    arIngredients: normalized.arIngredients ?? null,
    enIngredients: normalized.enIngredients ?? null,
    arHowToUse: normalized.arHowToUse ?? null,
    enHowToUse: normalized.enHowToUse ?? null,
    arWarnings: normalized.arWarnings ?? null,
    enWarnings: normalized.enWarnings ?? null,
    youtubeUrl: normalized.youtubeUrl ?? null,
    imagePath: normalized.imagePath ?? null,
    categoryId: normalized.categoryId || 1,
    status: normalized.status
  });
  for (const v of normalized.variants) {
    await addVariantRepo({
      productId: created.id,
      sizeLabel: v.sizeLabel,
      sellingPrice: v.sellingPrice,
      stockQty: v.stockQty
    });
  }
  return created;
}
