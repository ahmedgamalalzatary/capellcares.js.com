import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["products.read", "products.create", "products.update", "products.discount", "products.soft_delete", "products.toggle_status"] },
  hydrated: true,
  logout: vi.fn()
}));

const { uploadMedia } = vi.hoisted(() => ({
  uploadMedia: vi.fn(async (file: File) => ({ url: `http://localhost:4000/uploads/${file.name}`, path: `/uploads/${file.name}`, fileName: file.name }))
}));

const toggleProductStatus = vi.fn().mockRejectedValue(new Error("toggle failed"));
const upsertProduct = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
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
    loaded: true,
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
      offerIds: [4],
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

describe("ProductsListPage bulk discounts", () => {
  it("opens the bulk discount manager from the products page", () => {
    render(createElement(ProductsListPage));
    expect(screen.getByRole("link", { name: "إدارة الخصومات" })).toHaveAttribute("href", "/discounts");
  });
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockedUseAdminAuth.mockReset();
  mockedUseAdminAuth.mockReturnValue({
    user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["products.read", "products.create", "products.update", "products.discount", "products.soft_delete", "products.toggle_status"] },
    hydrated: true,
    logout: vi.fn()
  });
  toggleProductStatus.mockClear();
  upsertProduct.mockClear();
});

const relatedOptions = [
  { type: "product" as const, id: 1, name: { ar: "منتج حالي", en: "Current Product" }, slug: "product-1" },
  { type: "product" as const, id: 2, name: { ar: "منتج آخر", en: "Other Product" }, slug: "product-2" },
  { type: "offer" as const, id: 3, name: { ar: "عرض مرتبط", en: "Related Offer" }, slug: "offer-3" }
];

function minimalProduct(id: number) {
  return {
    id,
    sku: `SKU-${id}`,
    slug: `product-${id}`,
    name: { ar: "منتج", en: "Product" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 10,
    imagePath: "",
    media: [],
    status: "inactive" as const,
    isNew: false,
    isBestseller: false,
    categoryId: 5,
    variants: [{ id: 11, productId: id, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
    createdAt: "",
    updatedAt: ""
  };
}

describe("ProductForm related items", () => {
  const openRelatedStep = (view: ReturnType<typeof render>) => {
    const form = within(view.container);
    fireEvent.click(form.getByTestId("step-details"));
    return form;
  };

  it("renders the related-items selector", () => {
    const view = render(createElement(ProductForm, { mode: "edit", initial: minimalProduct(1), categories: [], relatedOptions }));
    const form = openRelatedStep(view);
    expect(form.getByTestId("related-items-field")).toBeInTheDocument();
    expect(form.getByTestId("related-items-add")).toBeInTheDocument();
    expect(form.queryByLabelText("نوع الخصم")).not.toBeInTheDocument();
    expect(form.queryByLabelText("قيمة الخصم")).not.toBeInTheDocument();
  });

  it("excludes the current product from its own related options", () => {
    const view = render(createElement(ProductForm, { mode: "edit", initial: minimalProduct(1), categories: [], relatedOptions }));
    const form = openRelatedStep(view);

    fireEvent.click(form.getByTestId("related-items-add"));

    const names = screen.getAllByTestId("related-items-option").map((option) => option.textContent);
    expect(names).not.toContain("منتج حالي");
    expect(names).toContain("منتج آخر");
    expect(names).toContain("عرض مرتبط");
  });

  it("saves the selected related items in the chosen order", async () => {
    const view = render(createElement(ProductForm, { mode: "edit", initial: minimalProduct(1), categories: [], relatedOptions }));
    const form = openRelatedStep(view);

    fireEvent.click(form.getByTestId("related-items-add"));
    fireEvent.click(screen.getByRole("option", { name: "منتج آخر" }));
    fireEvent.click(screen.getByRole("option", { name: "عرض مرتبط" }));

    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedItems: [
            { type: "product", id: 2 },
            { type: "offer", id: 3 }
          ]
        })
      );
    });
  });

  it("reorders a related item up and saves the new order", async () => {
    const view = render(createElement(ProductForm, { mode: "edit", initial: minimalProduct(1), categories: [], relatedOptions }));
    const form = openRelatedStep(view);

    fireEvent.click(form.getByTestId("related-items-add"));
    fireEvent.click(screen.getByRole("option", { name: "منتج آخر" }));
    fireEvent.click(screen.getByRole("option", { name: "عرض مرتبط" }));

    const rows = form.getAllByTestId("related-item-row");
    fireEvent.click(within(rows[1]!).getByRole("button", { name: "تحريك لأعلى" }));

    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedItems: [
            { type: "offer", id: 3 },
            { type: "product", id: 2 }
          ]
        })
      );
    });
  });
});

describe("ProductsListPage", () => {
  it("shows a 403 state for staff without products.read", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(ProductsListPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى المنتجات.")).toBeInTheDocument();
  });

  it("keeps the toggle modal open, shows an error, and resets loading when status toggle fails", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["products.read", "products.create", "products.update", "products.soft_delete", "products.toggle_status"] },
      hydrated: true,
      logout: vi.fn()
    });
    render(createElement(ProductsListPage));

    fireEvent.pointerDown(screen.getByRole("button", { name: "إجراءات منتج" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "إيقاف" }));
    fireEvent.click(await screen.findByRole("button", { name: "تأكيد" }));

    expect(toggleProductStatus).toHaveBeenCalledWith(1);
    expect(await screen.findByText("تعذر تحديث حالة المنتج. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تأكيد" })).not.toBeDisabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an automatic offer badge for products linked to offers", () => {
    render(createElement(ProductsListPage));

    expect(screen.getByText("ضمن عرض")).toBeInTheDocument();
  });

  it("submits gallery media separately from the dedicated hover image", async () => {
    const view = render(createElement(ProductForm, {
      mode: "edit",
      initial: minimalProduct(1),
      categories: [{ id: 5, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }]
    }));
    const form = within(view.container);

    fireEvent.click(form.getByTestId("step-media"));

    fireEvent.change(form.getByTestId("product-media-add-en-input"), {
      target: {
        files: [new File(["one"], "primary.jpg", { type: "image/jpeg" })]
      }
    });

    fireEvent.change(form.getByTestId("product-media-add-video-input"), {
      target: {
        files: [new File(["three"], "demo.mp4", { type: "video/mp4" })]
      }
    });

    fireEvent.change(form.getByTestId("product-hover-image-en-input"), {
      target: {
        files: [new File(["two"], "hover.jpg", { type: "image/jpeg" })]
      }
    });

    await waitFor(() => {
      expect(form.getAllByTestId("product-media-item")).toHaveLength(2);
    });

    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({
        media: [
          {
            type: "image",
            arUrl: null,
            enUrl: expect.stringContaining("http://localhost:4000/uploads/primary.jpg")
          },
          { type: "video", url: expect.stringContaining("http://localhost:4000/uploads/demo.mp4") }
        ],
        imagePath: expect.stringContaining("http://localhost:4000/uploads/primary.jpg"),
        hoverImagePath: expect.stringContaining("http://localhost:4000/uploads/hover.jpg"),
        arHoverImagePath: null,
        enHoverImagePath: expect.stringContaining("http://localhost:4000/uploads/hover.jpg")
      }));
    });
  });
});
