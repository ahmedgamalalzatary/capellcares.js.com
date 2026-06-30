import { getEffectiveVariantPrice, pickLang, type Category, type Language, type Product } from "@capella/shared";

export function safeName(product: Product, lang: Language): string {
  const fallback = { ar: "", en: "" };
  return pickLang(product.name ?? fallback, lang);
}

export function minVariantPrice(product: Product): number {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(
    ...variants.map((variant) => (variant ? getEffectiveVariantPrice(variant) : Number.POSITIVE_INFINITY))
  );
}

export function isDescendantOf(categoryId: number, selectedId: number, byId: Map<number, Category>) {
  let current = byId.get(categoryId);
  while (current?.parentId != null) {
    if (current.parentId === selectedId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}
