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

/**
 * Flat product payload shape (API/domain-style), with the localized and pricing
 * fields the admin flow actually consumes. Declared explicitly so the
 * normalizer can read every field type-safely instead of casting to `any`.
 */
type ApiProductInput = {
  sku?: string;
  arName?: string;
  enName?: string;
  arDescription?: string;
  enDescription?: string;
  arIngredients?: string;
  enIngredients?: string;
  arHowToUse?: string;
  enHowToUse?: string;
  arWarnings?: string;
  enWarnings?: string;
  keywords?: string[];
  buyingPrice?: number;
  imagePath?: string;
  youtubeUrl?: string;
  status: "active" | "inactive";
  categoryId?: number;
  variants?: Array<{
    sizeLabel?: string;
    sellingPrice?: number;
    stockQty?: number;
  }>;
};

export type AdminProductInput = ErpProductInput | ApiProductInput;

type RawVariant = {
  size?: string;
  price?: number;
  stock?: number;
  sizeLabel?: string;
  sellingPrice?: number;
  stockQty?: number;
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

export function normalizeAdminProductInput(input: AdminProductInput): NormalizedProductInput {
  const erp = input as ErpProductInput;
  const api = input as ApiProductInput;

  const variants = ((input.variants ?? []) as RawVariant[]).map((variant) => ({
    sizeLabel: variant.sizeLabel ?? variant.size ?? "",
    sellingPrice: Number(variant.sellingPrice ?? variant.price ?? 0),
    stockQty: Number(variant.stockQty ?? variant.stock ?? 0)
  }));

  return {
    sku: input.sku,
    arName: api.arName ?? erp.name?.ar ?? "",
    enName: api.enName ?? erp.name?.en ?? "",
    arDescription: api.arDescription ?? erp.description?.ar,
    enDescription: api.enDescription ?? erp.description?.en,
    arIngredients: api.arIngredients ?? erp.ingredients?.ar,
    enIngredients: api.enIngredients ?? erp.ingredients?.en,
    arHowToUse: api.arHowToUse ?? erp.howToUse?.ar,
    enHowToUse: api.enHowToUse ?? erp.howToUse?.en,
    arWarnings: api.arWarnings ?? erp.warnings?.ar,
    enWarnings: api.enWarnings ?? erp.warnings?.en,
    keywords: input.keywords ?? [],
    buyingPrice: Number(api.buyingPrice ?? erp.buyingPrice ?? 0),
    imagePath: input.imagePath ?? undefined,
    youtubeUrl: api.youtubeUrl ?? erp.youtubeUrl ?? undefined,
    status: input.status,
    categoryId: Number(api.categoryId ?? erp.categoryId ?? 0),
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
