import type { Product } from "../../../../types/domain.js";

export type ErpProductInput = {
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

export type NormalizedProductInput = {
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

export function normalizeAdminProductInput(input: Omit<Product, "id" | "slug" | "deletedAt"> | ErpProductInput) {
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

export function canActivateAdminProduct(input: NormalizedProductInput) {
  return Boolean(
    input.arName &&
      input.enName &&
      input.keywords.length > 0 &&
      input.imagePath &&
      input.categoryId &&
      input.variants.length > 0
  );
}
