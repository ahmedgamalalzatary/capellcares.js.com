import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reorderCategories = vi.fn().mockResolvedValue(undefined);

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

// The state object must be a stable reference: the page derives memoized arrays
// from `categories`, and a fresh array per render causes an infinite re-render loop.
const storeState = vi.hoisted(() => ({
    categories: [
      { id: 1, parentId: null, slug: "body-care", sortOrder: 2, name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: false, deletedAt: null },
      { id: 2, parentId: null, slug: "skin-care", sortOrder: 1, name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false, deletedAt: null },
      { id: 3, parentId: 2, slug: "serums", sortOrder: 1, name: { ar: "سيروم", en: "Serums" }, isLeaf: true, deletedAt: null },
      { id: 4, parentId: 2, slug: "cleansers", sortOrder: 2, name: { ar: "منظفات", en: "Cleansers" }, isLeaf: true, deletedAt: null }
    ],
  products: []
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(storeState),
  getStore: () => ({
    softDeleteCategory: vi.fn(),
    reorderCategories
  })
}));

import CategoriesPage from "@/app/categories/page";

describe("CategoriesPage", () => {
  beforeEach(() => {
    reorderCategories.mockClear();
  });

  it("reorders root categories and saves the full sibling id order", async () => {
    render(createElement(CategoriesPage));

    const bodyRow = screen.getByTestId("category-row-1");
    fireEvent.click(within(bodyRow).getByRole("button", { name: "تحريك لأعلى" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ ترتيب الأقسام" }));

    await waitFor(() => {
      expect(reorderCategories).toHaveBeenCalledWith({ parentId: null, ids: [1, 2] });
    });
  });

  it("collapses and expands a parent's children when its fold arrow is clicked", () => {
    const { container } = render(createElement(CategoriesPage));
    const view = within(container);

    // Skin Care (id 2) has children Serums (3) and Cleansers (4); the subtree
    // stays mounted (animated via CSS) and its collapsed state is tracked on the
    // wrapper's data-collapsed attribute.
    const subtree = view.getByTestId("category-subtree-2");
    const toggle = view.getByTestId("category-toggle-2");
    expect(subtree.getAttribute("data-collapsed")).toBe("false");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(subtree.getAttribute("data-collapsed")).toBe("true");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(subtree.getAttribute("data-collapsed")).toBe("false");
  });

  it("reorders child categories within the same parent and saves that sibling id order", async () => {
    render(createElement(CategoriesPage));

    const serumsRow = screen.getAllByTestId("category-row-3")[0]!;
    fireEvent.click(within(serumsRow).getByRole("button", { name: "تحريك لأسفل" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ ترتيب الأقسام" }));

    await waitFor(() => {
      expect(reorderCategories).toHaveBeenCalledWith({ parentId: 2, ids: [4, 3] });
    });
  });
});
