import { resolveLocalizedEntityMediaUrl, type Category, type EntityOrderingRef, type Product } from "@capella/shared";
import type { CategoryApiShape, ProductApiShape } from "./types";

const orderingScopeTypes = ["root", "category", "offer", "collection"] as const;

function normalizeOrderings(input: ProductApiShape["orderings"]): EntityOrderingRef[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((entry): entry is { scopeType: EntityOrderingRef["scopeType"]; scopeId?: number | null; rank?: number } =>
      orderingScopeTypes.includes(entry?.scopeType as EntityOrderingRef["scopeType"])
    )
    .map((entry) => ({
      scopeType: entry.scopeType,
      scopeId: entry.scopeId == null ? null : toNumber(entry.scopeId),
      rank: toNumber(entry.rank)
    }));
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBilingual(
  value: { ar?: string; en?: string } | undefined,
  arFallback?: string,
  enFallback?: string
) {
  return {
    ar: value?.ar ?? arFallback ?? "",
    en: value?.en ?? enFallback ?? ""
  };
}

export function normalizeProduct(input: ProductApiShape): Product {
  const normalizedMedia = input.media?.length
    ? input.media
    : input.imagePath
      ? [{ type: "image" as const, arUrl: null, enUrl: input.imagePath }]
      : [];
  const primaryImage = normalizedMedia.find((item) => item.type === "image");
  return {
    id: toNumber(input.id),
    sku: input.sku ?? "",
    slug: input.slug ?? "",
    name: toBilingual(input.name, input.arName, input.enName),
    description: toBilingual(input.description, input.arDescription ?? undefined, input.enDescription ?? undefined),
    ingredients: toBilingual(input.ingredients, input.arIngredients ?? undefined, input.enIngredients ?? undefined),
    howToUse: toBilingual(input.howToUse, input.arHowToUse ?? undefined, input.enHowToUse ?? undefined),
    warnings: toBilingual(input.warnings, input.arWarnings ?? undefined, input.enWarnings ?? undefined),
    keywords: Array.isArray(input.keywords)
      ? input.keywords
      : typeof input.keywords === "string"
        ? input.keywords.split(",").map((x) => x.trim()).filter(Boolean)
        : [],
    buyingPrice: toNumber(input.buyingPrice),
    imagePath: input.imagePath ?? (primaryImage ? resolveLocalizedEntityMediaUrl(primaryImage, "en") : ""),
    hoverImagePath: input.hoverImagePath ?? "",
    arHoverImagePath: input.arHoverImagePath ?? "",
    enHoverImagePath: input.enHoverImagePath ?? input.hoverImagePath ?? "",
    media: normalizedMedia,
    youtubeUrl: input.youtubeUrl ?? undefined,
    status: input.status ?? "inactive",
    isNew: input.isNew ?? false,
    isBestseller: input.isBestseller ?? false,
    categoryId: toNumber(input.categoryId),
    variants: (input.variants ?? []).map((v, index) => ({
      id: toNumber(v.id),
      productId: toNumber(v.productId, toNumber(input.id)),
      size: v.size ?? v.sizeLabel ?? "",
      price: toNumber(v.price ?? v.sellingPrice),
      stock: toNumber(v.stock ?? v.stockQty),
      sortOrder: toNumber(v.sortOrder, index + 1),
      discount: v.discount
        ? {
          id: v.discount.id == null ? undefined : toNumber(v.discount.id),
          variantId: v.discount.variantId == null ? undefined : toNumber(v.discount.variantId),
          type: v.discount.type ?? "percentage",
          value: toNumber(v.discount.value),
          startsAt: v.discount.startsAt ?? "",
          endsAt: v.discount.endsAt ?? "",
          status: v.discount.status ?? "inactive"
        }
        : null
    })),
    offerIds: Array.isArray((input as { offerIds?: unknown[] }).offerIds)
      ? (input as { offerIds?: unknown[] }).offerIds!.map((value) => toNumber(value)).filter((value) => value > 0)
      : [],
    sortOrder: input.sortOrder == null ? undefined : toNumber(input.sortOrder),
    orderings: normalizeOrderings(input.orderings),
    createdAt: input.createdAt ?? "",
    updatedAt: input.updatedAt ?? "",
    deletedAt: input.deletedAt ?? null
  };
}

export function normalizeCategory(input: CategoryApiShape): Category {
  return {
    id: Number(input.id),
    parentId: input.parentId == null ? null : Number(input.parentId),
    slug: input.slug,
    imagePath: input.imagePath ?? null,
    sortOrder: input.sortOrder == null ? undefined : toNumber(input.sortOrder),
    name: {
      ar: input.name?.ar ?? input.arName ?? "",
      en: input.name?.en ?? input.enName ?? ""
    },
    isLeaf: Boolean(input.isLeaf ?? true),
    createdAt: input.createdAt ?? "",
    deletedAt: input.deletedAt ?? null
  };
}
