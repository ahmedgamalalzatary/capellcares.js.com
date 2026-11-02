import { describe, expect, it } from "vitest";
import type { ProductColor, ProductVariant } from "@capella/shared";
import {
  cellKey,
  matrixFromVariants,
  groupVariantsBySize,
  matrixProblem,
  variantsFromMatrix
} from "@/features/products/lib/variant-matrix";

const discount = { type: "percentage" as const, value: 10, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-02-01T00:00:00.000Z", status: "active" as const };
const black: ProductColor = { id: 7, name: { ar: "أسود", en: "Black" }, hex: "#000000", media: [] };
const blue: ProductColor = { id: 8, name: { ar: "", en: "" }, hex: "#0000ff", media: [] };

function variant(id: number, size: string, colorId: number | null, price: number, stock: number, extra: Partial<ProductVariant> = {}): ProductVariant {
  return { id, productId: 1, size, colorId, price, stock, sortOrder: id, discount: null, ...extra };
}

describe("matrixFromVariants", () => {
  it("groups variants into sizes (price and discount per size) and a stock grid per size × colour", () => {
    const matrix = matrixFromVariants([
      variant(1, "S", 7, 100, 3, { discount }),
      variant(2, "S", 8, 100, 0, { discount }),
      variant(3, "M", 7, 150, 5),
      variant(4, "M", 8, 150, 2)
    ]);
    expect(matrix.sizes.map((size) => [size.label, size.price, size.discount])).toEqual([["S", 100, discount], ["M", 150, null]]);
    const [s, m] = matrix.sizes;
    expect(matrix.stock[cellKey(s!.key, 7)]).toBe(3);
    expect(matrix.stock[cellKey(m!.key, 8)]).toBe(2);
    expect(matrix.variantIds[cellKey(m!.key, 7)]).toBe(3);
  });

  it("gives a product without variants one empty size", () => {
    const matrix = matrixFromVariants([]);
    expect(matrix.sizes).toHaveLength(1);
    expect(matrix.sizes[0]).toMatchObject({ label: "", price: 0, discount: null });
  });
});

describe("variantsFromMatrix", () => {
  it("builds one variant per size × colour, each priced by its size and keeping stored ids", () => {
    const matrix = matrixFromVariants([variant(1, "S", 7, 100, 3, { discount }), variant(3, "M", 7, 150, 5)]);
    const variants = variantsFromMatrix(matrix, [black, blue], 1);
    expect(variants.map((v) => [v.size, v.colorId, v.price, v.stock])).toEqual([
      ["S", 7, 100, 3], ["S", 8, 100, 0], ["M", 7, 150, 5], ["M", 8, 150, 0]
    ]);
    expect(variants[0]!.id).toBe(1);
    expect(variants[1]!.id).toBeLessThan(0);
    expect(variants[1]!.discount).toEqual(discount);
    expect(variants[2]!.id).toBe(3);
  });

  it("builds one colourless variant per size when the product has no colours", () => {
    const matrix = matrixFromVariants([variant(1, "", null, 80, 4)]);
    expect(variantsFromMatrix(matrix, [], 1).map((v) => [v.id, v.size, v.colorId, v.price, v.stock])).toEqual([[1, "", null, 80, 4]]);
  });
});

describe("matrixProblem", () => {
  const sizes = (labels: Array<[string, number]>) => labels.map(([label, price], key) => ({ key: key + 1, label, price, discount: null }));

  it("accepts one unnamed size, or several named ones", () => {
    expect(matrixProblem(sizes([["", 50]]), [])).toBeNull();
    expect(matrixProblem(sizes([["S", 50], ["M", 60]]), [black, blue])).toBeNull();
  });

  it("needs a price above zero for every size", () => {
    expect(matrixProblem(sizes([["S", 0]]), [])).toBe("price");
  });

  it("needs a name for every size once there are several, and no repeats", () => {
    expect(matrixProblem(sizes([["S", 50], ["", 60]]), [])).toBe("size-name");
    expect(matrixProblem(sizes([["S", 50], [" s ", 60]]), [])).toBe("size-repeat");
  });

  it("needs each colour to be picked or named", () => {
    expect(matrixProblem(sizes([["", 50]]), [{ ...blue, hex: null }])).toBe("color");
  });
});

describe("groupVariantsBySize", () => {
  it("groups the colours of each size together, in variant order", () => {
    const groups = groupVariantsBySize([
      variant(3, "M", 7, 150, 5),
      variant(1, "S", 7, 100, 3),
      variant(2, "S", 8, 100, 0),
      variant(4, "M", 8, 150, 2)
    ]);
    expect(groups.map((group) => group.map((v) => v.id))).toEqual([[1, 2], [3, 4]]);
  });
});
