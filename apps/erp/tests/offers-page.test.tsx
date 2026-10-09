import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toggleOfferStatus = vi.fn().mockRejectedValue(new Error("toggle failed"));

function makeOffer(id: number, nameAr: string, status: "active" | "inactive") {
  return {
    id,
    slug: `offer-${id}`,
    name: { ar: nameAr, en: `Offer ${id}` },
    description: { ar: "وصف", en: "Description" },
    imagePath: "",
    price: 100,
    originalTotal: 150,
    items: [{ variantId: 1, qty: 1 }],
    stock: 3,
    status,
    createdAt: "",
    updatedAt: ""
  };
}

const makeMockState = () => ({ loaded: true, categories: [], offers: [makeOffer(1, "عرض", "active")] });
let mockState: any = makeMockState();

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["offers.read", "offers.create", "offers.update", "offers.soft_delete", "offers.toggle_status"] },
    hydrated: true,
    logout: vi.fn()
  })
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(mockState),
  getStore: () => ({
    softDeleteOffer: vi.fn(),
    toggleOfferStatus,
    reorderOffers: vi.fn()
  })
}));

import OffersListPage from "@/app/offers/page";

// The filter panel (plain labelled selects) is the phone layout; force it so the tests can drive the filters.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const openPanel = () => {
  fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
};

describe("OffersListPage", () => {
  beforeEach(() => {
    mockState = makeMockState();
  });

  it("keeps the toggle modal open and shows an error when status toggle fails", async () => {
    render(createElement(OffersListPage));

    fireEvent.pointerDown(screen.getByRole("button", { name: "إجراءات عرض" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "إيقاف" }));
    fireEvent.click(await screen.findByRole("button", { name: "تأكيد" }));

    expect(toggleOfferStatus).toHaveBeenCalledWith(1);
    expect(await screen.findByText("تعذر تحديث حالة العرض. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("filters the list by offer status", () => {
    mockState = {
      loaded: true,
      categories: [],
      offers: [makeOffer(1, "عرض نشط", "active"), makeOffer(2, "عرض متوقف", "inactive")]
    };
    render(createElement(OffersListPage));

    expect(screen.getByText("2 عرض")).toBeInTheDocument();

    openPanel();
    fireEvent.change(screen.getByLabelText("الحالة"), { target: { value: "inactive" } });

    expect(screen.queryByText("عرض نشط")).not.toBeInTheDocument();
    expect(screen.getByText("عرض متوقف")).toBeInTheDocument();
    expect(screen.getByText("1 عرض")).toBeInTheDocument();
  });

  it("finds an offer by its slug", () => {
    mockState = {
      loaded: true,
      categories: [],
      offers: [makeOffer(1, "عرض أول", "active"), makeOffer(2, "عرض ثاني", "active")]
    };
    render(createElement(OffersListPage));

    fireEvent.change(screen.getByPlaceholderText("ابحثي باسم العرض…"), { target: { value: "offer-2" } });

    expect(screen.queryByText("عرض أول")).not.toBeInTheDocument();
    expect(screen.getByText("عرض ثاني")).toBeInTheDocument();
  });
});

describe("OffersListPage category filter", () => {
  beforeEach(() => {
    mockState = makeMockState();
  });

  it("filters offers by descendant category", () => {
    mockState = {
      loaded: true,
      categories: [
        { id: 7, parentId: null, slug: "body-care", name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: false },
        { id: 8, parentId: 7, slug: "body-lotion", name: { ar: "لوشن الجسم", en: "Body Lotion" }, isLeaf: true },
        { id: 9, parentId: null, slug: "hair-care", name: { ar: "العناية بالشعر", en: "Hair Care" }, isLeaf: true }
      ],
      offers: [
        { ...makeOffer(1, "عرض الجسم", "active"), categoryId: 8 },
        { ...makeOffer(2, "عرض الشعر", "active"), categoryId: 9 }
      ]
    };

    render(createElement(OffersListPage));

    openPanel();
    fireEvent.change(screen.getByTestId("offers-category-filter"), { target: { value: "7" } });

    expect(screen.getByText("عرض الجسم")).toBeInTheDocument();
    expect(screen.queryByText("عرض الشعر")).not.toBeInTheDocument();
  });

  it("shows the offer category name in the table", () => {
    mockState = {
      loaded: true,
      categories: [
        { id: 7, parentId: null, slug: "body-care", name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: true }
      ],
      offers: [{ ...makeOffer(1, "عرض الجسم", "active"), categoryId: 7 }]
    };

    render(createElement(OffersListPage));

    const row = screen.getByTestId("offer-row-1");
    expect(within(row).getByText("العناية بالجسم")).toBeInTheDocument();
  });
});

describe("OffersListPage uncategorised offers", () => {
  beforeEach(() => {
    mockState = makeMockState();
  });

  it("does not offer activation for an offer that has no category", () => {
    mockState = {
      loaded: true,
      categories: [],
      offers: [{ ...makeOffer(1, "عرض قديم", "inactive"), categoryId: null }]
    };

    render(createElement(OffersListPage));

    fireEvent.pointerDown(screen.getByRole("button", { name: "إجراءات عرض قديم" }));

    expect(screen.queryByRole("menuitem", { name: "تفعيل" })).not.toBeInTheDocument();
    expect(screen.getByText("اختاري قسمًا للعرض قبل تفعيله")).toBeInTheDocument();
  });
});
