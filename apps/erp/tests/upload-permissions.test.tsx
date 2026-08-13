import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { uploadImage, uploadMedia } = vi.hoisted(() => ({
  uploadImage: vi.fn(async (_file: File, _context?: string) => ({
    url: "http://localhost:4000/uploads/image.jpg",
    path: "/uploads/image.jpg",
    fileName: "image.jpg"
  })),
  uploadMedia: vi.fn(async (file: File, context?: string) => ({
    url: `http://localhost:4000/uploads/${file.name}`,
    path: `/uploads/${file.name}`,
    fileName: file.name,
    context
  }))
}));

const upsertProduct = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/api/client", () => ({
  API_BASE: "http://localhost:4000",
  api: {
    uploadImage,
    uploadMedia
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    upsertProduct
  })
}));

import { ImageUpload } from "@/components/forms/image-upload";
import { ProductForm } from "@/components/forms/product-form";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  uploadImage.mockClear();
  uploadMedia.mockClear();
  upsertProduct.mockClear();
});

describe("ERP upload permissions", () => {
  it("blocks image uploads when no edit-capable upload context is provided", async () => {
    const onChange = vi.fn();
    const { container } = render(createElement(ImageUpload, { value: null, onChange }));

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: {
        files: [new File(["one"], "blocked.jpg", { type: "image/jpeg" })]
      }
    });

    expect(uploadImage).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByText("رفع الصور متاح فقط داخل مسارات التعديل المصرح بها.")).toBeInTheDocument();
  });

  it("renders saved relative upload paths against the API uploads host", () => {
    const { container } = render(createElement(ImageUpload, { value: "/uploads/saved.jpg", onChange: vi.fn(), uploadContext: "shop_media.update" }));

    expect(container.querySelector("img")).toHaveAttribute("src", "http://localhost:4000/uploads/saved.jpg");
  });

  it("sends products.update upload context from the product edit form", async () => {
    const view = render(createElement(ProductForm, {
      mode: "edit",
      initial: {
        id: 1,
        sku: "ERP-UPLOAD-1",
        slug: "erp-upload-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "" },
        ingredients: { ar: "", en: "" },
        howToUse: { ar: "", en: "" },
        warnings: { ar: "", en: "" },
        keywords: ["test"],
        buyingPrice: 10,
        imagePath: "",
        media: [],
        hoverImagePath: "",
        status: "inactive",
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      } as any,
      categories: [{ id: 5, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }]
    }));
    const form = within(view.container);

    fireEvent.change(form.getByTestId("product-media-add-en-input"), {
      target: {
        files: [new File(["one"], "primary.jpg", { type: "image/jpeg" })]
      }
    });

    fireEvent.change(form.getByTestId("product-hover-image-en-input"), {
      target: {
        files: [new File(["two"], "hover.jpg", { type: "image/jpeg" })]
      }
    });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledWith(expect.any(File), "products.update");
      expect(uploadImage).toHaveBeenCalledWith(expect.any(File), "products.update");
    });
  });
});
