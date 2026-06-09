import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reorderRootCategories = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: {
      name: "Admin User",
      email: "admin@capella.test",
      role: "admin",
      permissionKeys: ["categories.read", "categories.create", "categories.update", "categories.soft_delete"]
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
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    categories: [
      { id: 1, parentId: null, slug: "body-care", sortOrder: 2, name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: false, deletedAt: null },
      { id: 2, parentId: null, slug: "skin-care", sortOrder: 1, name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false, deletedAt: null },
      { id: 3, parentId: 2, slug: "serums", sortOrder: 0, name: { ar: "سيروم", en: "Serums" }, isLeaf: true, deletedAt: null }
    ],
    products: []
  }),
  getStore: () => ({
    softDeleteCategory: vi.fn(),
    reorderRootCategories
  })
}));

import CategoriesPage from "@/app/categories/page";

describe("CategoriesPage", () => {
  beforeEach(() => {
    reorderRootCategories.mockClear();
  });

  it("reorders root categories and saves the full root id order", async () => {
    render(createElement(CategoriesPage));

    const bodyRow = screen.getByTestId("category-row-1");
    fireEvent.click(within(bodyRow).getByRole("button", { name: "تحريك لأعلى" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ ترتيب الأقسام" }));

    await waitFor(() => {
      expect(reorderRootCategories).toHaveBeenCalledWith([1, 2]);
    });
  });
});
