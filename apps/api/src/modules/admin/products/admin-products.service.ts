import { addVariantRepo, createAdminProductRepo, listAdminProductsRepo } from "../../../repositories/product.repository.js";
import type { Product } from "../../../types/domain.js";

function toSlug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type ErpProductInput = {
  sku?: string;
  name?: { ar?: string; en?: string };
  description?: { ar?: string; en?: string };
  ingredients?: { ar?: string; en?: string };
  howToUse?: { ar?: string; en?: string };
  warnings?: { ar?: string; en?: string };
  keywords?: string[];
  buyingPrice?: number;
  imagePath?: string;
  youtubeUrl?: string;
  status: "active" | "inactive";
  categoryId?: number;
  variants?: Array<{
    size?: string;
    price?: number;
    stock?: number;
  }>;
};

type NormalizedProductInput = {
  sku?: string;
  arName: string;
  enName: string;
  arDescription?: string;
  enDescription?: string;
  arIngredients?: string;
  enIngredients?: string;
  arHowToUse?: string;
  enHowToUse?: string;
  arWarnings?: string;
  enWarnings?: string;
  keywords: string[];
  buyingPrice: number;
  imagePath?: string;
  youtubeUrl?: string;
  status: "active" | "inactive";
  categoryId: number;
  variants: Array<{
    sizeLabel: string;
    sellingPrice: number;
    stockQty: number;
  }>;
};

function normalizeProductInput(input: Omit<Product, "id" | "slug" | "deletedAt"> | ErpProductInput) {
  const maybeErpInput = input as ErpProductInput;
  const maybeApiInput = input as Omit<Product, "id" | "slug" | "deletedAt">;

  const arName = maybeApiInput.arName ?? maybeErpInput.name?.ar ?? "";
  const enName = maybeApiInput.enName ?? maybeErpInput.name?.en ?? "";
  const categoryId = Number((maybeErpInput.categoryId ?? (input as any).categoryId) ?? 0);
  const variants = (input.variants ?? []).map((variant: any) => ({
    sizeLabel: variant.sizeLabel ?? variant.size ?? "",
    sellingPrice: Number(variant.sellingPrice ?? variant.price ?? 0),
    stockQty: Number(variant.stockQty ?? variant.stock ?? 0)
  }));

  return {
    sku: input.sku,
    arName,
    enName,
    arDescription: (input as any).arDescription ?? maybeErpInput.description?.ar,
    enDescription: (input as any).enDescription ?? maybeErpInput.description?.en,
    arIngredients: (input as any).arIngredients ?? maybeErpInput.ingredients?.ar,
    enIngredients: (input as any).enIngredients ?? maybeErpInput.ingredients?.en,
    arHowToUse: (input as any).arHowToUse ?? maybeErpInput.howToUse?.ar,
    enHowToUse: (input as any).enHowToUse ?? maybeErpInput.howToUse?.en,
    arWarnings: (input as any).arWarnings ?? maybeErpInput.warnings?.ar,
    enWarnings: (input as any).enWarnings ?? maybeErpInput.warnings?.en,
    keywords: input.keywords ?? [],
    buyingPrice: Number((input as any).buyingPrice ?? 0),
    imagePath: input.imagePath ?? undefined,
    youtubeUrl: (input as any).youtubeUrl ?? undefined,
    status: input.status,
    categoryId,
    variants
  };
}

function canActivateProduct(input: NormalizedProductInput) {
  return Boolean(
    input.arName &&
      input.enName &&
      input.keywords.length > 0 &&
      input.imagePath &&
      input.categoryId &&
      input.variants.length > 0
  );
}

export function listAdminProducts() {
  return listAdminProductsRepo();
}

export async function createAdminProduct(input: Omit<Product, "id" | "slug" | "deletedAt"> | ErpProductInput) {
  const normalized: NormalizedProductInput = normalizeProductInput(input);
  const slugBase = normalized.enName || normalized.arName || normalized.sku || "product";
  const slug = toSlug(slugBase);
  if (normalized.status === "active" && !canActivateProduct(normalized)) {
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
