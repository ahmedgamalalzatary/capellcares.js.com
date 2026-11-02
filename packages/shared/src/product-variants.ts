import type { Language } from "./constants/languages.js";
import type { ProductColor, ProductVariant } from "./types/index.js";

/** A colour's name in the page language, falling back to the other one; empty when the colour is only a swatch. */
export function productColorName(color: Pick<ProductColor, "name">, lang: Language): string {
  const own = color.name[lang].trim();
  return own || color.name[lang === "ar" ? "en" : "ar"].trim();
}

/** "S / Black", "S", "Black" or "" — what a cart line, order line or picker shows for one variant. */
export function variantOptionLabel(
  variant: Pick<ProductVariant, "size" | "colorId">,
  colors: Array<Pick<ProductColor, "id" | "name">> | undefined,
  lang: Language
): string {
  const color = variant.colorId == null ? undefined : colors?.find((item) => item.id === variant.colorId);
  return [variant.size.trim(), color ? productColorName(color, lang) : ""].filter(Boolean).join(" / ");
}
