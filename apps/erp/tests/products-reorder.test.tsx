import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reorderProducts = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: {
      name: "Admin User",
      email: "admin@capella.test",
      role: "admin",
      permissionKeys: ["products.read", "products.update"]
    },
    hydrated: true,
    logout: vi.fn()
  })
}));

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}));

function makeProduct(id: number, categoryId: number, orderings: Array<{ scopeType: string; scopeId: number | null; rank: number }>, createdAt: string) {
  return {
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
    status: "active" as const,
    isNew: false,
    isBestseller: false,
    categoryId,
    variants: [],
    orderings,
    createdAt,
    updatedAt: "",
    deletedAt: null
  };
}

const storeState = vi.hoisted(() => ({
  products: [] as any[],
  categories: [] as any[]
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(storeState),
  getStore: () => ({
    softDeleteProduct: vi.fn(),
    toggleProductStatus: vi.fn(),
    reorderProducts
  })
}));

import ProductsListPage from "@/app/products/page";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  reorderProducts.mockClear();
  storeState.categories = [
    { id: 5, parentId: null, slug: "root-cat", name: { ar: "قسم رئيسي", en: "Root" }, isLeaf: false, deletedAt: null },
    { id: 6, parentId: 5, slug: "child-cat", name: { ar: "قسم فرعي", en: "Child" }, isLeaf: false, deletedAt: null },
    { id: 7, parentId: 6, slug: "grandchild-cat", name: { ar: "قسم ثالث", en: "Grandchild" }, isLeaf: true, deletedAt: null }
  ];
  storeState.products = [
    makeProduct(1, 7, [{ scopeType: "root", scopeId: null, rank: 1 }], "2026-06-01T00:00:00.000Z"),
    makeProduct(2, 7, [{ scopeType: "root", scopeId: null, rank: 2 }], "2026-06-02T00:00:00.000Z")
  ];
});

describe("ProductsListPage ordering", () => {
  it("offers categories of every depth in the category filter", () => {
    render(createElement(ProductsListPage));

    const filter = screen.getByTestId("products-category-filter") as HTMLSelectElement;
    const values = Array.from(filter.querySelectorAll("option")).map((option) => option.value);

    expect(values).toContain("5");
    expect(values).toContain("6");
    expect(values).toContain("7");
  });

  it("reorders root products and saves the full scope id order", async () => {
    render(createElement(ProductsListPage));

    const secondRow = screen.getByTestId("product-row-2");
    fireEvent.click(within(secondRow).getByRole("button", { name: "تحريك لأعلى" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ ترتيب المنتجات" }));

    await waitFor(() => {
      expect(reorderProducts).toHaveBeenCalledWith({ categoryId: null, ids: [2, 1] });
    });
  });

  it("saves a category-scoped order when a category filter is active", async () => {
    storeState.products = [
      makeProduct(1, 7, [{ scopeType: "category", scopeId: 6, rank: 1 }], "2026-06-01T00:00:00.000Z"),
      makeProduct(2, 7, [{ scopeType: "category", scopeId: 6, rank: 2 }], "2026-06-02T00:00:00.000Z")
    ];

    render(createElement(ProductsListPage));

    fireEvent.change(screen.getByTestId("products-category-filter"), { target: { value: "6" } });

    const secondRow = screen.getByTestId("product-row-2");
    fireEvent.click(within(secondRow).getByRole("button", { name: "تحريك لأعلى" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ ترتيب المنتجات" }));

    await waitFor(() => {
      expect(reorderProducts).toHaveBeenCalledWith({ categoryId: 6, ids: [2, 1] });
    });
  });

  it("includes ancestor products in a child category ordering scope", async () => {
    storeState.products = [
      makeProduct(1, 6, [{ scopeType: "category", scopeId: 7, rank: 1 }], "2026-06-01T00:00:00.000Z"),
      makeProduct(2, 7, [{ scopeType: "category", scopeId: 7, rank: 2 }], "2026-06-02T00:00:00.000Z")
    ];

    render(createElement(ProductsListPage));

    fireEvent.change(screen.getByTestId("products-category-filter"), { target: { value: "7" } });

    expect(screen.getByTestId("product-row-1")).toBeInTheDocument();
    const secondRow = screen.getByTestId("product-row-2");
    fireEvent.click(within(secondRow).getByRole("button", { name: /لأعلى/ }));
    fireEvent.click(screen.getByRole("button", { name: /ترتيب/ }));

    await waitFor(() => {
      expect(reorderProducts).toHaveBeenCalledWith({ categoryId: 7, ids: [2, 1] });
    });
  });

  it("orders rows by the selected scope's ranks with unranked products last", () => {
    storeState.products = [
      makeProduct(1, 7, [], "2026-06-01T00:00:00.000Z"),
      makeProduct(2, 7, [{ scopeType: "root", scopeId: null, rank: 1 }], "2026-06-02T00:00:00.000Z")
    ];

    render(createElement(ProductsListPage));

    const rows = screen.getAllByTestId(/product-row-/);
    const ids = rows.map((row) => Number(row.getAttribute("data-testid")?.replace("product-row-", "")));
    expect(ids).toEqual([2, 1]);
  });

  it("hides reorder controls while searching", () => {
    render(createElement(ProductsListPage));

    fireEvent.change(screen.getByPlaceholderText("ابحثي بالاسم أو SKU…"), { target: { value: "منتج" } });

    expect(screen.queryByRole("button", { name: "تحريك لأعلى" })).not.toBeInTheDocument();
  });
});
