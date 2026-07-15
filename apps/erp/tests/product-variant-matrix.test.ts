import { describe, expect, it } from "vitest";

import * as matrixModule from "../src/hooks/forms/product-variant-matrix";

describe("product variant matrix", () => {
  it("multiplies three sizes by three colors into nine sellable combinations", () => {
    expect(typeof matrixModule.buildVariantMatrix).toBe("function");
    const result = matrixModule.buildVariantMatrix(
      [{ id: -1, label: "100ml" }, { id: -2, label: "200ml" }, { id: -3, label: "300ml" }],
      [{ id: -4, hex: "#FFFFFF" }, { id: -5, hex: "#000000" }, { id: -6, hex: "#FF0000" }],
      [],
      (() => { let id = -100; return () => --id; })()
    );

    expect(result).toHaveLength(9);
    expect(new Set(result.map((variant) => `${variant.sizeId}:${variant.colorId}`)).size).toBe(9);
  });

  it("assigns the first color to existing size-only variants without changing their ids", () => {
    const existing = [
      { id: 41, productId: 10, sizeId: 1, colorId: null, price: 20, stock: 5, sortOrder: 1 },
      { id: 42, productId: 10, sizeId: 2, colorId: null, price: 25, stock: 6, sortOrder: 2 }
    ];
    const result = matrixModule.buildVariantMatrix(
      [{ id: 1, label: "S" }, { id: 2, label: "M" }],
      [{ id: -1, hex: "#FFFFFF" }, { id: -2, hex: "#000000" }],
      existing,
      (() => { let id = -100; return () => --id; })()
    );

    expect(result).toHaveLength(4);
    expect(result.filter((variant) => variant.colorId === -1).map((variant) => variant.id)).toEqual([41, 42]);
    expect(result.find((variant) => variant.id === 41)).toMatchObject({ price: 20, stock: 5 });
  });

  it("keeps one existing variant per size when all colors are removed", () => {
    const existing = [
      { id: 51, productId: 10, sizeId: 1, colorId: 10, price: 20, stock: 5, sortOrder: 1 },
      { id: 52, productId: 10, sizeId: 1, colorId: 11, price: 20, stock: 2, sortOrder: 2 }
    ];
    const result = matrixModule.buildVariantMatrix(
      [{ id: 1, label: "S" }],
      [],
      existing,
      () => -100
    );

    expect(result).toEqual([{ ...existing[0], colorId: null, sortOrder: 1 }]);
  });
});
