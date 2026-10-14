import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: { name: "Admin", email: "admin@capella.test", role: "admin", permissionKeys: ["products.read"] },
    hydrated: true,
    logout: vi.fn()
  })
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

const products = Array.from({ length: 45 }, (_, index) => ({
  id: index + 1,
  sku: `SKU-${index + 1}`,
  slug: `product-${index + 1}`,
  name: { ar: `منتج ${index + 1}`, en: `Product ${index + 1}` },
  status: index % 2 === 0 ? "active" : "inactive",
  categoryId: 5,
  imagePath: "",
  media: [],
  variants: [{ id: 100 + index, productId: index + 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
  createdAt: new Date(2026, 0, index + 1).toISOString(),
  updatedAt: ""
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    loaded: true,
    products,
    categories: [{ id: 5, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }]
  }),
  getStore: () => ({})
}));

import ProductsListPage from "@/app/products/page";

const shownIds = () => [...new Set(screen.getAllByRole("link")
  .map((link) => link.getAttribute("href") ?? "")
  .filter((href) => /^\/products\/\d+\/edit$/.test(href)))];

describe("products list pagination", () => {
  it("shows 20 products per page and moves between pages", () => {
    render(<ProductsListPage />);
    expect(screen.getByRole("status")).toHaveTextContent("صفحة 1 من 3");
    const firstPage = shownIds();
    expect(firstPage).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "الصفحة 3" }));
    expect(shownIds()).toHaveLength(5);
    expect(window.location.search).toBe("?page=3");

    fireEvent.click(screen.getByRole("button", { name: "السابق" }));
    const secondPage = shownIds();
    expect(secondPage).toHaveLength(20);
    expect(secondPage.some((href) => firstPage.includes(href))).toBe(false);
  });

  it("adds the next page under the current one", () => {
    render(<ProductsListPage />);
    fireEvent.click(screen.getByRole("button", { name: "تحميل المزيد" }));
    expect(shownIds()).toHaveLength(40);
    expect(screen.getByRole("status")).toHaveTextContent("الصفحات 1–2 من 3");
  });

  it("counts all matching products, not just the visible page", () => {
    render(<ProductsListPage />);
    expect(screen.getByText("45 منتج")).toBeInTheDocument();
  });

  it("goes back to page 1 when the search changes", () => {
    render(<ProductsListPage />);
    fireEvent.click(screen.getByRole("button", { name: "الصفحة 2" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "منتج" } });
    expect(screen.getByRole("status")).toHaveTextContent("صفحة 1 من 3");
  });

  it("comes back to the remembered page, filter and search", () => {
    window.history.replaceState(null, "", "/products?page=2&status=active");
    const { unmount } = render(<ProductsListPage />);
    expect(screen.getByRole("status")).toHaveTextContent("صفحة 2 من 2");
    expect(shownIds()).toHaveLength(3);
    unmount();

    window.history.replaceState(null, "", "/products");
    render(<ProductsListPage />);
    expect(window.location.search).toBe("?page=2&status=active");
    expect(shownIds()).toHaveLength(3);
  });
});
