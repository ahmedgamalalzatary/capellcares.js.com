import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@capella/shared";
import { ProductsTable } from "@/features/products/components/products-table";

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

function renderTable(products: Product[], overrides: Record<string, unknown> = {}) {
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
    onDelete: vi.fn(),
    ...overrides
  }));
}

function openRowMenu(name: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: `إجراءات ${name}` }));
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

describe("ProductsTable row actions", () => {
  it("offers no row menu at all when the user may do nothing to the row", () => {
    renderTable([productWithStock(1, 3)]);

    expect(screen.queryByRole("button", { name: "إجراءات منتج 1" })).toBeNull();
  });

  it("sends an editor to the product edit page", async () => {
    renderTable([productWithStock(1, 3)], { canEdit: true });

    openRowMenu("منتج 1");

    expect(await screen.findByRole("menuitem", { name: "تعديل منتج 1" })).toHaveAttribute("href", "/products/1/edit");
  });

  it("reports the product it toggles so the page can flip its status", async () => {
    const onToggle = vi.fn();
    const product = productWithStock(1, 3);
    renderTable([product], { canToggle: true, onToggle });

    openRowMenu("منتج 1");
    fireEvent.click(await screen.findByRole("menuitem", { name: "إيقاف" }));

    expect(onToggle).toHaveBeenCalledWith(product);
  });

  it("offers activation rather than suspension for an inactive product", async () => {
    const onToggle = vi.fn();
    const inactive = { ...productWithStock(1, 3), status: "inactive" } as unknown as Product;
    renderTable([inactive], { canToggle: true, onToggle });

    openRowMenu("منتج 1");
    fireEvent.click(await screen.findByRole("menuitem", { name: "تفعيل" }));

    expect(onToggle).toHaveBeenCalledWith(inactive);
  });

  it("passes the product id to delete, not the whole row", async () => {
    const onDelete = vi.fn();
    renderTable([productWithStock(4, 3)], { canDelete: true, onDelete });

    openRowMenu("منتج 4");
    fireEvent.click(await screen.findByRole("menuitem", { name: "حذف منتج 4" }));

    expect(onDelete).toHaveBeenCalledWith(4);
  });

  it("shows only the actions the user is actually allowed", async () => {
    renderTable([productWithStock(5, 3)], { canDelete: true });

    openRowMenu("منتج 5");

    await waitFor(() => expect(screen.getByRole("menuitem", { name: "حذف منتج 5" })).toBeInTheDocument());
    expect(screen.queryByRole("menuitem", { name: "تعديل منتج 5" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "إيقاف" })).toBeNull();
  });
});
