import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["collections.read", "collections.create", "collections.update", "collections.toggle_status"] },
  hydrated: true,
  logout: vi.fn()
}));

const toggleCollectionStatus = vi.fn().mockResolvedValue(undefined);

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    collections: [{
      id: 1,
      slug: "collection-1",
      name: { ar: "مجموعة", en: "Collection" },
      description: { ar: "", en: "" },
      imagePath: "",
      price: 100,
      originalTotal: 150,
      categoryId: 7,
      items: [{ variantId: 3, qty: 1 }],
      stock: 2,
      status: "active",
      createdAt: "",
      updatedAt: ""
    }],
    categories: [{ id: 7, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }]
  }),
  getStore: () => ({
    toggleCollectionStatus
  })
}));

import CollectionsListPage from "@/app/collections/page";
import NewCollectionPage from "@/app/collections/new/page";

describe("CollectionsListPage", () => {
  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["collections.read", "collections.create", "collections.update", "collections.toggle_status"] },
      hydrated: true,
      logout: vi.fn()
    });
    toggleCollectionStatus.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a 403 state for staff without collections.read", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(CollectionsListPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى المجموعات.")).toBeInTheDocument();
  });

  it("renders a clickable link to create a new collection", () => {
    render(createElement(CollectionsListPage));

    const link = screen.getByRole("link", { name: /مجموعة جديدة/ });
    expect(link).toHaveAttribute("href", "/collections/new");
  });

  it("hides create and edit actions for read-only staff", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["collections.read"] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(CollectionsListPage));

    expect(screen.queryByRole("link", { name: /مجموعة جديدة/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /مجموعة/ })).not.toBeInTheDocument();
    expect(screen.getByText("مجموعة")).toBeInTheDocument();
  });

  it("asks for confirmation before toggling collection status", async () => {
    render(createElement(CollectionsListPage));

    fireEvent.click(screen.getByTitle("إيقاف"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));
    expect(toggleCollectionStatus).toHaveBeenCalledWith(1);
  });

  it("sets an explicit aria-label on the toggle-status action", () => {
    render(createElement(CollectionsListPage));

    expect(screen.getByRole("button", { name: "إيقاف" })).toHaveAttribute("aria-label", "إيقاف");
  });
});

describe("NewCollectionPage", () => {
  it("shows a 403 state for staff without collections.create", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["collections.read"] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(NewCollectionPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية إنشاء المجموعات.")).toBeInTheDocument();
  });
});
