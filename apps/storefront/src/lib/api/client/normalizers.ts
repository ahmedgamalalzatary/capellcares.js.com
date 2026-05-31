import type { Category, Product } from "@capella/shared";
import { API_BASE } from "./http";
import type { CategoryApiShape, ProductApiShape } from "./types";

export function resolveMediaUrl(url: string | null | undefined): string {
  const value = url?.trim() ?? "";
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${API_BASE}${value}`;
  }

  return value;
}

export function normalizeCategory(input: CategoryApiShape): Category {
  return {
    id: Number(input.id),
    parentId: input.parentId == null ? null : Number(input.parentId),
    slug: input.slug,
    name: {
      ar: input.name?.ar ?? input.arName ?? "",
      en: input.name?.en ?? input.enName ?? ""
    },
    isLeaf: Boolean(input.isLeaf ?? true),
    deletedAt: input.deletedAt ?? null
  };
}

export function normalizeProduct<T extends ProductApiShape>(product: T): T {
  const normalizedImagePath = resolveMediaUrl(product.imagePath ?? "");
  const media = product.media?.length
    ? product.media.map((item) => ({ ...item, url: resolveMediaUrl(item.url) }))
    : normalizedImagePath
      ? [{ type: "image" as const, url: normalizedImagePath }]
      : [];

  return {
    ...product,
    imagePath: normalizedImagePath || (media.find((item) => item.type === "image")?.url ?? ""),
    hoverImagePath: resolveMediaUrl(product.hoverImagePath ?? ""),
    media
  } as T;
}
