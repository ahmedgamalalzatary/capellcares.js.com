import { describe, expect, it } from "vitest";
import { validateProductOptionValues } from "../src/hooks/forms/product-option-validation";

describe("product option validation", () => {
  it("rejects blank or normalized duplicate size labels", () => {
    expect(validateProductOptionValues([{ id: 1, label: "100 ml" }, { id: 2, label: " 100   ML " }], [])).toBe("duplicate-size");
    expect(validateProductOptionValues([{ id: 1, label: "   " }], [])).toBe("blank-size");
  });

  it("rejects duplicate canonical colors", () => {
    expect(validateProductOptionValues([{ id: 1, label: "S" }], [
      { id: 2, hex: "#ffffff" },
      { id: 3, hex: "#FFFFFF" }
    ])).toBe("duplicate-color");
  });

  it("accepts distinct sizes and colors", () => {
    expect(validateProductOptionValues(
      [{ id: 1, label: "100ml" }, { id: 2, label: "200ml" }],
      [{ id: 3, hex: "#FFFFFF" }, { id: 4, hex: "#000000" }]
    )).toBeNull();
  });
});
