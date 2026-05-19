import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toggleProductStatus = vi.fn().mockRejectedValue(new Error("toggle failed"));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    products: [{
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "",
      status: "active",
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    }],
    categories: [{ id: 5, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }]
  }),
  getStore: () => ({
    softDeleteProduct: vi.fn(),
    toggleProductStatus
  })
}));

import ProductsListPage from "@/app/products/page";

describe("ProductsListPage", () => {
  it("keeps the toggle modal open, shows an error, and resets loading when status toggle fails", async () => {
    render(createElement(ProductsListPage));

    fireEvent.click(screen.getByTitle("إيقاف"));
    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));

    expect(toggleProductStatus).toHaveBeenCalledWith(1);
    expect(await screen.findByText("تعذر تحديث حالة المنتج. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تأكيد" })).not.toBeDisabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
