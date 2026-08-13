import type { Category, Product } from "@capella/shared";
import { API_BASE } from "./http";
import type { CategoryApiShape, ProductApiShape } from "./types";

function resolvePublicMediaBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.trim() || API_BASE;
}

export function resolveMediaUrl(url: string | null | undefined): string {
  const value = url?.trim() ?? "";
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${resolvePublicMediaBase()}${value}`;
  }

  return value;
}

export function normalizeCategory(input: CategoryApiShape): Category {
  return {
    id: Number(input.id),
    parentId: input.parentId == null ? null : Number(input.parentId),
    slug: input.slug,
    imagePath: resolveMediaUrl(input.imagePath ?? "") || null,
    sortOrder: typeof input.sortOrder === "number" ? input.sortOrder : (input.sortOrder != null && input.sortOrder !== "" && Number.isFinite(Number(input.sortOrder))) ? Number(input.sortOrder) : undefined,
    name: {
      ar: input.name?.ar ?? input.arName ?? "",
      en: input.name?.en ?? input.enName ?? ""
    },
    isLeaf: Boolean(input.isLeaf ?? true),
    createdAt: input.createdAt ?? "",
    deletedAt: input.deletedAt ?? null
  };
}

export function normalizeProduct<T extends ProductApiShape>(product: T): T & Product {
  const normalizedImagePath = resolveMediaUrl(product.imagePath ?? "");
  const media = product.media?.length
    ? product.media.map((item) => item.type === "video"
      ? { ...item, url: resolveMediaUrl(item.url) }
      : {
        ...item,
        arUrl: resolveMediaUrl(item.arUrl) || null,
        enUrl: resolveMediaUrl(item.enUrl) || null
      })
    : normalizedImagePath
      ? [{ type: "image" as const, arUrl: null, enUrl: normalizedImagePath }]
      : [];

  const ensureNumericId = (value: unknown, field: "product id" | "product categoryId") => {
    if (value == null) {
      throw new Error(`Missing required ${field}`);
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`Invalid ${field}`);
    }
    return numeric;
  };

  return {
    ...product,
    id: ensureNumericId(product.id, "product id"),
    categoryId: ensureNumericId(product.categoryId, "product categoryId"),
    imagePath: normalizedImagePath || (() => {
      const image = media.find((item) => item.type === "image");
      return image?.enUrl ?? image?.arUrl ?? "";
    })(),
    hoverImagePath: resolveMediaUrl(product.hoverImagePath ?? ""),
    media,
    variants: product.variants.map((variant) => ({
      ...variant,
      id: variant.id != null ? Number(variant.id) : variant.id as never,
      productId: variant.productId != null ? Number(variant.productId) : variant.productId as never,
      discount: variant.discount
        ? {
          ...variant.discount,
          id: variant.discount.id != null ? Number(variant.discount.id) : variant.discount.id,
          variantId: variant.discount.variantId != null ? Number(variant.discount.variantId) : variant.discount.variantId,
          value: Number(variant.discount.value)
        }
        : null
    }))
  } as T & Product;
}
