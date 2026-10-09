import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@capella/shared";
import { ProductsTable } from "@/components/products-table";

const productWithStock = (id: number, stock: number) => ({
  id,
  sku: `SKU-${id}`,
  slug: `product-${id}`,
  name: { ar: `منتج ${id}`, en: `Product ${id}` },
  description: { ar: "", en: "" },
  ingredients: { ar: "", en: "" },
  howToUse: { ar: "", en: "" },
  warnings: { ar: "", en: "" },
  keywords: [],
  buyingPrice: 10,
  imagePath: "",
  media: [],
  status: "active",
  isNew: false,
  isBestseller: false,
  categoryId: 5,
  variants: [{ id: id * 10, productId: id, size: "100ml", price: 50, stock, sortOrder: 1 }],
  offerIds: [],
  createdAt: "",
  updatedAt: ""
}) as unknown as Product;

function renderTable(products: Product[]) {
  return render(createElement(ProductsTable, {
    products,
    sort: null,
    onSort: vi.fn(),
    categories: [],
    user: null,
    canToggle: false,
    canEdit: false,
    canDelete: false,
    onToggle: vi.fn(),
    onDelete: vi.fn()
  }));
}

afterEach(cleanup);

describe("ProductsTable stock threshold", () => {
  it("labels a total stock of 5 as low", () => {
    renderTable([productWithStock(1, 5)]);

    expect(screen.getByTestId("product-row-1")).toHaveTextContent("منخفض");
  });

  it("shows a plain number for a total stock above 5", () => {
    renderTable([productWithStock(2, 6)]);

    expect(screen.getByTestId("product-row-2")).not.toHaveTextContent("منخفض");
    expect(screen.getByTestId("product-row-2")).toHaveTextContent("6");
  });

  it("still labels a total stock of 0 as out of stock", () => {
    renderTable([productWithStock(3, 0)]);

    expect(screen.getByTestId("product-row-3")).toHaveTextContent("نفد المخزون");
  });
});
