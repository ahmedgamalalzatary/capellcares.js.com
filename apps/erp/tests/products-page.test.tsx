import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["products.read", "products.create", "products.update", "products.soft_delete", "products.toggle_status"] },
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
      sizes: [{ id: 101, productId: 1, label: "100ml", sortOrder: 1 }],
      colors: [],
      variants: [{ id: 11, productId: 1, sizeId: 101, colorId: null, price: 50, stock: 2, sortOrder: 1 }],
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

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockedUseAdminAuth.mockReset();
  mockedUseAdminAuth.mockReturnValue({
    user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["products.read", "products.create", "products.update", "products.soft_delete", "products.toggle_status"] },
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
    sizes: [{ id: 101, productId: id, label: "100ml", sortOrder: 1 }],
    colors: [],
    variants: [{ id: 11, productId: id, sizeId: 101, colorId: null, price: 50, stock: 2, sortOrder: 1 }],
    createdAt: "",
    updatedAt: ""
  };
}

describe("ProductForm related items", () => {
  it("renders the related-items selector", () => {
    const view = render(createElement(ProductForm, { mode: "new", categories: [], relatedOptions }));
    const form = within(view.container);
    expect(form.getByTestId("related-items-field")).toBeInTheDocument();
    expect(form.getByTestId("related-items-add")).toBeInTheDocument();
  });

  it("excludes the current product from its own related options", () => {
    const view = render(
      createElement(ProductForm, { mode: "edit", initial: minimalProduct(1), categories: [], relatedOptions })
    );
    const select = within(view.container).getByTestId("related-items-add") as HTMLSelectElement;
    const values = Array.from(select.querySelectorAll("option")).map((option) => option.value);
    expect(values).not.toContain("product:1");
    expect(values).toContain("product:2");
    expect(values).toContain("offer:3");
  });

  it("saves the selected related items in the chosen order", async () => {
    const view = render(createElement(ProductForm, { mode: "new", categories: [], relatedOptions }));
    const form = within(view.container);
    fireEvent.change(form.getAllByRole("textbox")[0]!, { target: { value: "منتج" } });

    fireEvent.change(form.getByTestId("related-items-add"), { target: { value: "product:2" } });
    fireEvent.change(form.getByTestId("related-items-add"), { target: { value: "offer:3" } });

    fireEvent.click(form.getByRole("button", { name: "حفظ المنتج" }));

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
    const view = render(createElement(ProductForm, { mode: "new", categories: [], relatedOptions }));
    const form = within(view.container);
    fireEvent.change(form.getAllByRole("textbox")[0]!, { target: { value: "منتج" } });

    fireEvent.change(form.getByTestId("related-items-add"), { target: { value: "product:2" } });
    fireEvent.change(form.getByTestId("related-items-add"), { target: { value: "offer:3" } });

    const rows = form.getAllByTestId("related-item-row");
    fireEvent.click(within(rows[1]!).getByRole("button", { name: "تحريك لأعلى" }));

    fireEvent.click(form.getByRole("button", { name: "حفظ المنتج" }));

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
      user: { name: "Staff User", email: "staff@minikoshk.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(ProductsListPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملك صلاحية الوصول إلى المنتجات.")).toBeInTheDocument();
  });

  it("hides create and mutation actions for staff without the matching product action permissions", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@minikoshk.test", role: "staff", permissionKeys: ["products.read"] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(ProductsListPage));

    expect(screen.queryByRole("link", { name: /منتج جديد/ })).not.toBeInTheDocument();
    expect(screen.queryByTitle("إيقاف")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/تعديل/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/حذف/)).not.toBeInTheDocument();
  });

  it("keeps the toggle modal open, shows an error, and resets loading when status toggle fails", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["products.read", "products.create", "products.update", "products.soft_delete", "products.toggle_status"] },
      hydrated: true,
      logout: vi.fn()
    });
    render(createElement(ProductsListPage));

    fireEvent.click(screen.getByLabelText("إجراءات"));
    fireEvent.click(screen.getByTitle("إيقاف"));
    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));

    expect(toggleProductStatus).toHaveBeenCalledWith(1);
    expect(await screen.findByText("تعذر تحديث حالة المنتج. حاول مرة أخرى.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تأكيد" })).not.toBeDisabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("submits gallery media separately from the dedicated hover image", async () => {
    const view = render(createElement(ProductForm, {
      mode: "edit",
      initial: minimalProduct(1),
      categories: [{ id: 5, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }]
    }));
    const form = within(view.container);

    const textboxes = form.getAllByRole("textbox");
    fireEvent.change(textboxes[0]!, { target: { value: "منتج" } });
    fireEvent.change(textboxes[1]!, { target: { value: "Product" } });
    fireEvent.change(textboxes[2]!, { target: { value: "ERP-MEDIA-001" } });
    fireEvent.change(textboxes[3]!, { target: { value: "test, product" } });
    fireEvent.click(form.getByRole("radio", { name: /نشط/ }));
    fireEvent.change(form.getAllByRole("combobox")[0]!, { target: { value: "5" } });

    const initialSpinbuttons = form.getAllByRole("spinbutton");
    fireEvent.change(initialSpinbuttons[0]!, { target: { value: "10" } });

    const mediaInput = form.getByTestId("product-media-input");
    fireEvent.change(mediaInput, {
      target: {
        files: [
          new File(["one"], "primary.jpg", { type: "image/jpeg" }),
          new File(["three"], "demo.mp4", { type: "video/mp4" })
        ]
      }
    });

    const hoverInput = form.getByTestId("product-hover-image-input");
    fireEvent.change(hoverInput, {
      target: {
        files: [new File(["two"], "hover.jpg", { type: "image/jpeg" })]
      }
    });

    await form.findAllByTestId("product-media-item");
    await screen.findByText("صورة hover");

    fireEvent.change(form.getByPlaceholderText("100ml"), { target: { value: "100ml" } });
    const numericInputs = form.getAllByRole("spinbutton");
    fireEvent.change(numericInputs[1]!, { target: { value: "25" } });
    fireEvent.change(numericInputs[2]!, { target: { value: "4" } });
    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({
        media: [
          { type: "image", url: expect.stringContaining("http://localhost:4000/uploads/primary.jpg") },
          { type: "video", url: expect.stringContaining("http://localhost:4000/uploads/demo.mp4") }
        ],
        imagePath: expect.stringContaining("http://localhost:4000/uploads/primary.jpg"),
        hoverImagePath: expect.stringContaining("http://localhost:4000/uploads/hover.jpg")
      }));
    });
  });
});
