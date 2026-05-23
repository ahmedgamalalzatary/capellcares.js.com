import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hardDeleteProduct = vi.fn();
const restoreProduct = vi.fn();
const restoreCategory = vi.fn();
const restoreOffer = vi.fn();

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    products: [{
      id: 7,
      sku: "SKU-7",
      slug: "p7",
      name: { ar: "منتج محذوف", en: "Deleted Product" },
      description: { ar: "", en: "" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: [],
      buyingPrice: 0,
      imagePath: "",
      status: "inactive",
      isNew: false,
      isBestseller: false,
      categoryId: 1,
      variants: [],
      createdAt: "",
      updatedAt: "",
      deletedAt: "2026-05-20T00:00:00Z"
    }],
    categories: [{
      id: 3,
      parentId: null,
      slug: "cat",
      name: { ar: "قسم محذوف", en: "Deleted Category" },
      isLeaf: true,
      deletedAt: "2026-05-20T00:00:00Z"
    }],
    offers: [{
      id: 5,
      name: { ar: "عرض محذوف", en: "Deleted Offer" },
      deletedAt: "2026-05-20T00:00:00Z"
    }]
  }),
  getStore: () => ({
    hardDeleteProduct,
    restoreProduct,
    restoreCategory,
    restoreOffer
  })
}));

import TrashPage from "@/app/trash/page";

describe("TrashPage hard delete", () => {
  beforeEach(() => {
    hardDeleteProduct.mockReset();
    restoreProduct.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the hard-delete button on the products tab", () => {
    render(createElement(TrashPage));
    expect(screen.getByRole("button", { name: /حذف نهائي/ })).toBeInTheDocument();
  });

  it("opens a confirmation modal and does nothing when cancelled", () => {
    render(createElement(TrashPage));

    fireEvent.click(screen.getByRole("button", { name: /حذف نهائي/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/تأكيد الحذف النهائي/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
    expect(hardDeleteProduct).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls hardDeleteProduct when the modal confirm button is clicked", async () => {
    hardDeleteProduct.mockResolvedValue(undefined);
    render(createElement(TrashPage));

    fireEvent.click(screen.getByRole("button", { name: /حذف نهائي/ }));
    // confirm button inside the modal — second matching button
    const confirmButtons = screen.getAllByRole("button", { name: /حذف نهائي/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
    expect(hardDeleteProduct).toHaveBeenCalledWith(7);
  });

  it("does not show the hard-delete button on the categories tab", () => {
    render(createElement(TrashPage));
    fireEvent.click(screen.getByRole("button", { name: /الأقسام/ }));
    expect(screen.queryByRole("button", { name: /حذف نهائي/ })).not.toBeInTheDocument();
  });

  it("does not show the hard-delete button on the offers tab", () => {
    render(createElement(TrashPage));
    fireEvent.click(screen.getByRole("button", { name: /العروض/ }));
    expect(screen.queryByRole("button", { name: /حذف نهائي/ })).not.toBeInTheDocument();
  });
});
