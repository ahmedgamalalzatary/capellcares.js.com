import type { ProductVariant } from "@minikoshk/shared";

export type ProductSizeOption = { id: number; label: string };
export type ProductColorOption = { id: number; hex: string };

export function buildVariantMatrix(
  sizes: ProductSizeOption[],
  colors: ProductColorOption[],
  existing: ProductVariant[],
  createId: () => number
): ProductVariant[] {
  const combinations: Array<{ sizeId: number; colorId: number | null }> = [];
  for (const size of sizes) {
    if (colors.length === 0) combinations.push({ sizeId: size.id, colorId: null });
    else for (const color of colors) combinations.push({ sizeId: size.id, colorId: color.id });
  }

  return combinations.map((combination, index) => {
    const exact = existing.find((variant) =>
      variant.sizeId === combination.sizeId && variant.colorId === combination.colorId
    );
    const sizeOnly = combination.colorId === colors[0]?.id
      ? existing.find((variant) => variant.sizeId === combination.sizeId && variant.colorId == null)
      : undefined;
    const firstColored = combination.colorId == null
      ? existing.find((variant) => variant.sizeId === combination.sizeId)
      : undefined;
    const current = exact ?? sizeOnly ?? firstColored;
    return current
      ? { ...current, ...combination, sortOrder: index + 1 }
      : {
          id: createId(),
          productId: 0,
          ...combination,
          price: 0,
          stock: 0,
          sortOrder: index + 1
        };
  });
}
