import { addVariantRepo, createAdminProductRepo, listAdminProductsRepo } from "../../../repositories/product.repository.js";
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
  return listAdminProductsRepo();
}

export async function createAdminProduct(input: Omit<Product, "id" | "slug" | "deletedAt">) {
  const slug = toSlug(input.enName);
  const product: Product = { ...input, id: 0, slug, deletedAt: null };
  if (product.status === "active" && !canActivateProduct(product)) {
    throw new Error("Cannot activate incomplete product");
  }
  const created = await createAdminProductRepo({
    sku: input.sku,
    slug,
    arName: input.arName,
    enName: input.enName,
    buyingPrice: Number((input as any).buyingPrice ?? 0),
    keywords: input.keywords.join(","),
    imagePath: input.imagePath ?? null,
    categoryId: Number((input as any).categoryId ?? 1),
    status: input.status
  });
  for (const v of input.variants) {
    await addVariantRepo({
      productId: created.id,
      sizeLabel: v.sizeLabel,
      sellingPrice: Number(v.sellingPrice),
      stockQty: v.stockQty
    });
  }
  return created;
}
