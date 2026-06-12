import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reorderOffers = vi.fn().mockResolvedValue(undefined);
const reorderCollections = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: {
      name: "Admin User",
      email: "admin@capella.test",
      role: "admin",
      permissionKeys: [
        "offers.read", "offers.update",
        "collections.read", "collections.update"
      ]
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

function makeBundle(id: number) {
  return {
    id,
    slug: `bundle-${id}`,
    name: { ar: `باقة ${id}`, en: `Bundle ${id}` },
    description: { ar: "", en: "" },
    imagePath: "",
    price: 100,
    originalTotal: 150,
    categoryId: 5,
    items: [],
    stock: 3,
    status: "active" as const,
    visibility: "visible" as const,
    createdAt: "",
    updatedAt: "",
    deletedAt: null
  };
}

const storeState = vi.hoisted(() => ({
  offers: [] as any[],
  collections: [] as any[],
  categories: [] as any[]
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(storeState),
  getStore: () => ({
    softDeleteOffer: vi.fn(),
    softDeleteCollection: vi.fn(),
    toggleOfferStatus: vi.fn(),
    toggleCollectionStatus: vi.fn(),
    reorderOffers,
    reorderCollections
  })
}));

import OffersListPage from "@/app/offers/page";
import CollectionsListPage from "@/app/collections/page";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  reorderOffers.mockClear();
  reorderCollections.mockClear();
  storeState.offers = [makeBundle(1), makeBundle(2)];
  storeState.collections = [makeBundle(1), makeBundle(2)];
});

describe("OffersListPage ordering", () => {
  it("reorders offers and saves the full id order", async () => {
    render(createElement(OffersListPage));

    const secondRow = screen.getByTestId("offer-row-2");
    fireEvent.click(within(secondRow).getByRole("button", { name: "تحريك لأعلى" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ ترتيب العروض" }));

    await waitFor(() => {
      expect(reorderOffers).toHaveBeenCalledWith({ ids: [2, 1] });
    });
  });

  it("hides reorder controls while searching", () => {
    render(createElement(OffersListPage));

    fireEvent.change(screen.getByPlaceholderText("ابحثي عن عرض…"), { target: { value: "باقة" } });

    expect(screen.queryByRole("button", { name: "تحريك لأعلى" })).not.toBeInTheDocument();
  });
});

describe("CollectionsListPage ordering", () => {
  it("reorders collections and saves the full id order", async () => {
    render(createElement(CollectionsListPage));

    const secondRow = screen.getByTestId("collection-row-2");
    fireEvent.click(within(secondRow).getByRole("button", { name: "تحريك لأعلى" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ ترتيب المجموعات" }));

    await waitFor(() => {
      expect(reorderCollections).toHaveBeenCalledWith({ ids: [2, 1] });
    });
  });
});
