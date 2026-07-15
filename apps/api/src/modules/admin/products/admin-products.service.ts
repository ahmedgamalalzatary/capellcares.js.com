import { db } from "@minikoshk/database/src/db";
import { createAdminProductRepo, replaceProductOptionsAndVariantsRepo, replaceVariantsRepo } from "../../../repositories/product.repository.js";
import {
  canActivateAdminProduct,
  normalizeAdminProductInput,
  type AdminProductInput,
  type NormalizedProductInput
} from "./lib/admin-product-input.js";

function toSlug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createAdminProduct(input: AdminProductInput) {
  const normalized: NormalizedProductInput = normalizeAdminProductInput(input);
  const sizeMode = normalized.sizes.length > 0;
  const matchesRepresentation = normalized.variants.every((variant) =>
    sizeMode ? "sizeId" in variant : "sizeLabel" in variant
  );
  if (!matchesRepresentation) {
    throw new Error("Product variants do not match the selected representation");
  }
  const slugBase = normalized.enName || normalized.arName || normalized.sku || "product";
  const slug = toSlug(slugBase);
  if (normalized.status === "active" && !canActivateAdminProduct(normalized)) {
    throw new Error("Cannot activate incomplete product");
  }
  return db.transaction(async (tx) => {
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
    }, tx);
    if (sizeMode) {
      await replaceProductOptionsAndVariantsRepo(
        created.id,
        normalized.sizes,
        normalized.colors,
        normalized.variants as Array<Extract<NormalizedProductInput["variants"][number], { sizeId: number }>>,
        tx
      );
    } else {
      await replaceVariantsRepo(
        created.id,
        normalized.variants as Array<Extract<NormalizedProductInput["variants"][number], { sizeLabel: string }>>,
        tx
      );
    }
    return created;
  });
}
