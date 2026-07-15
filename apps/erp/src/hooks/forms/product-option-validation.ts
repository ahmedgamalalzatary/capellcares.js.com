import type { ProductColorOption, ProductSizeOption } from "./product-variant-matrix";

export type ProductOptionValidationError = "blank-size" | "duplicate-size" | "duplicate-color";

export function validateProductOptionValues(
  sizes: ProductSizeOption[],
  colors: ProductColorOption[]
): ProductOptionValidationError | null {
  const normalizedSizes = sizes.map((size) => size.label.trim().replace(/\s+/g, " ").toLocaleLowerCase());
  if (normalizedSizes.some((label) => label.length === 0)) return "blank-size";
  if (new Set(normalizedSizes).size !== normalizedSizes.length) return "duplicate-size";

  const normalizedColors = colors.map((color) => color.hex.toUpperCase());
  if (new Set(normalizedColors).size !== normalizedColors.length) return "duplicate-color";
  return null;
}
