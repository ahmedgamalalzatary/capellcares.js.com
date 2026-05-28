import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { uploadMedia } = vi.hoisted(() => ({
  uploadMedia: vi.fn(async (file: File) => ({ url: `http://localhost:4000/uploads/${file.name}`, path: `/uploads/${file.name}`, fileName: file.name }))
}));

const toggleProductStatus = vi.fn().mockRejectedValue(new Error("toggle failed"));
const upsertProduct = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/lib/api/client", () => ({
  api: {
    uploadMedia,
    uploadImage: uploadMedia
  }
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
      media: [],
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
    toggleProductStatus,
    upsertProduct
  })
}));

import ProductsListPage from "@/app/products/page";
import { ProductForm } from "@/components/forms/product-form";

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

  it("submits ordered product media after remove and reorder actions", async () => {
    const view = render(createElement(ProductForm, {
      mode: "new",
      categories: [{ id: 5, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }]
    }));
    const form = within(view.container);

    const textboxes = form.getAllByRole("textbox");
    fireEvent.change(textboxes[0]!, { target: { value: "منتج" } });
    fireEvent.change(textboxes[1]!, { target: { value: "Product" } });
    fireEvent.change(textboxes[2]!, { target: { value: "ERP-MEDIA-001" } });
    fireEvent.change(textboxes[3]!, { target: { value: "test, product" } });
    fireEvent.click(form.getByLabelText("نشط (يظهر في المتجر)"));
    fireEvent.change(form.getAllByRole("combobox")[0]!, { target: { value: "5" } });

    const initialSpinbuttons = form.getAllByRole("spinbutton");
    fireEvent.change(initialSpinbuttons[0]!, { target: { value: "10" } });

    const mediaInput = form.getByTestId("product-media-input");
    const files = [
      new File(["one"], "primary.jpg", { type: "image/jpeg" }),
      new File(["two"], "hover.jpg", { type: "image/jpeg" }),
      new File(["three"], "demo.mp4", { type: "video/mp4" })
    ];

    fireEvent.change(mediaInput, { target: { files } });

    const mediaItems = await form.findAllByTestId("product-media-item");
    fireEvent.click(within(mediaItems[2]!).getByRole("button", { name: "تحريك لأعلى" }));
    fireEvent.click(within(mediaItems[0]!).getByRole("button", { name: "إزالة" }));

    fireEvent.change(form.getByPlaceholderText("100ml"), { target: { value: "100ml" } });
    const numericInputs = form.getAllByRole("spinbutton");
    fireEvent.change(numericInputs[1]!, { target: { value: "25" } });
    fireEvent.change(numericInputs[2]!, { target: { value: "4" } });
    fireEvent.click(form.getByRole("button", { name: "حفظ المنتج" }));

    await waitFor(() => {
      expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({
        media: [
          { type: "video", url: expect.stringContaining("http://localhost:4000/uploads/demo.mp4") },
          { type: "image", url: expect.stringContaining("http://localhost:4000/uploads/hover.jpg") }
        ],
        imagePath: expect.stringContaining("http://localhost:4000/uploads/hover.jpg")
      }));
    });
  });
});
