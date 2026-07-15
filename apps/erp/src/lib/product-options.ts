import type { Product, ProductVariant } from "@minikoshk/shared";

export function getVariantLabel(product: Pick<Product, "sizes" | "colors">, variant: ProductVariant) {
  const size = product.sizes?.find((option) => option.id === variant.sizeId)?.label ?? "—";
  const color = product.colors?.find((option) => option.id === variant.colorId)?.hex;
  return color ? `${size} / ${color}` : size;
}
