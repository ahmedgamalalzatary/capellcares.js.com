import { createElement, Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

const push = vi.fn();
const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["products.read", "products.discount"] },
  hydrated: true,
  logout: vi.fn()
}));
const mockedUseStore = vi.fn((selector: any) => selector(storeState));

const storeState = {
  products: [
    {
      id: 1,
      sku: "P1",
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
      variants: [
        { id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1, discount: null },
        { id: 12, productId: 1, size: "200ml", price: 80, stock: 4, sortOrder: 2, discount: null }
      ],
      createdAt: "",
      updatedAt: ""
    }
  ],
  loaded: true,
  error: null
};

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  useRouter: () => ({ push })
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => mockedUseStore(selector),
}));

const apiPost = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/api/client", () => ({
  api: {
    post: (path: string, body?: unknown) => apiPost(path, body)
  }
}));

import ProductDiscountPage from "@/app/products/[id]/discount/page";

describe("ProductDiscountPage", () => {
  beforeEach(() => {
    push.mockClear();
    mockedUseAdminAuth.mockReset();
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["products.read", "products.discount"] },
      hydrated: true,
      logout: vi.fn()
    });
    apiPost.mockClear();
  });

  it("shows a forbidden state for staff without products.discount", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["products.read", "products.update"] },
      hydrated: true,
      logout: vi.fn()
    });

    await act(async () => {
      render(createElement(Suspense, { fallback: null }, createElement(ProductDiscountPage, { params: Promise.resolve({ id: "1" }) })));
    });

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية تعديل خصومات المنتجات.")).toBeInTheDocument();
  });

  it("renders only the product variants for discount management and saves discount changes", async () => {
    await act(async () => {
      render(createElement(Suspense, { fallback: null }, createElement(ProductDiscountPage, { params: Promise.resolve({ id: "1" }) })));
    });

    expect(screen.getByTestId("discount-variant-11")).toBeInTheDocument();
    expect(screen.getByTestId("discount-variant-12")).toBeInTheDocument();
    expect(screen.queryByText("المعلومات الأساسية")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText("تفعيل الخصم")[0]!);
    fireEvent.change(screen.getAllByLabelText("نوع الخصم")[0]!, { target: { value: "percentage" } });
    fireEvent.change(screen.getAllByLabelText("قيمة الخصم")[0]!, { target: { value: "20" } });
    fireEvent.change(screen.getAllByLabelText("بداية الخصم")[0]!, { target: { value: "2026-06-01T10:00" } });
    fireEvent.change(screen.getAllByLabelText("نهاية الخصم")[0]!, { target: { value: "2026-06-30T22:00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الخصومات" }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/api/erp/products/1/discount", {
        variants: [
          expect.objectContaining({
            id: 11,
            discount: expect.objectContaining({
              type: "percentage",
              value: 20,
              status: "active"
            })
          }),
          expect.objectContaining({ id: 12, discount: null })
        ]
      });
    });
    expect(push).toHaveBeenCalledWith("/products");
  });

  it("renders variants after a delayed store load on refresh", async () => {
    const delayedState: any = {
      loaded: false,
      error: null,
      products: []
    };
    mockedUseStore.mockImplementation((selector: any) => selector(delayedState));

    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(createElement(Suspense, { fallback: null }, createElement(ProductDiscountPage, { params: Promise.resolve({ id: "1" }) })));
    });

    expect(screen.getByText("جاري تحميل بيانات المنتج...")).toBeInTheDocument();

    delayedState.loaded = true;
    delayedState.products = storeState.products;

    await act(async () => {
      view!.rerender(createElement(Suspense, { fallback: null }, createElement(ProductDiscountPage, { params: Promise.resolve({ id: "1" }) })));
    });

    await waitFor(() => {
      expect(screen.getByTestId("discount-variant-11")).toBeInTheDocument();
      expect(screen.getByTestId("discount-variant-12")).toBeInTheDocument();
    });
  });
});
