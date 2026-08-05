import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const makeMockState = () => ({ categories: [], offers: [makeOffer(1, "عرض", "active")] });
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
    toggleOfferStatus
  })
}));

import OffersListPage from "@/app/offers/page";

describe("OffersListPage", () => {
  beforeEach(() => {
    cleanup();
    mockState = makeMockState();
  });

  it("keeps the toggle modal open and shows an error when status toggle fails", async () => {
    render(createElement(OffersListPage));

    fireEvent.click(screen.getByLabelText("إجراءات"));
    fireEvent.click(screen.getByTitle("إيقاف"));
    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));

    expect(toggleOfferStatus).toHaveBeenCalledWith(1);
    expect(await screen.findByText("تعذر تحديث حالة العرض. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("filters the list by offer status", () => {
    mockState = {
      categories: [],
      offers: [makeOffer(1, "عرض نشط", "active"), makeOffer(2, "عرض متوقف", "inactive")]
    };
    render(createElement(OffersListPage));

    expect(screen.getByText("2 عرض")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("حالة العرض"), { target: { value: "inactive" } });

    expect(screen.queryByText("عرض نشط")).not.toBeInTheDocument();
    expect(screen.getByText("عرض متوقف")).toBeInTheDocument();
    expect(screen.getByText("1 عرض")).toBeInTheDocument();
  });
});

describe("OffersListPage category filter", () => {
  beforeEach(() => {
    cleanup();
    mockState = makeMockState();
  });

  it("filters offers by descendant category", () => {
    mockState = {
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

    fireEvent.change(screen.getByDisplayValue("كل الأقسام"), { target: { value: "7" } });

    expect(screen.getByText("عرض الجسم")).toBeInTheDocument();
    expect(screen.queryByText("عرض الشعر")).not.toBeInTheDocument();
  });

  it("shows the offer category name in the table", () => {
    mockState = {
      categories: [
        { id: 7, parentId: null, slug: "body-care", name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: true }
      ],
      offers: [{ ...makeOffer(1, "عرض الجسم", "active"), categoryId: 7 }]
    };

    render(createElement(OffersListPage));

    // The name also appears as a filter <option>, so assert on the row itself.
    const row = screen.getByTestId("offer-row-1");
    expect(within(row).getByText("العناية بالجسم")).toBeInTheDocument();
  });
});

describe("OffersListPage uncategorised offers", () => {
  beforeEach(() => {
    cleanup();
    mockState = makeMockState();
  });

  it("does not offer activation for an offer that has no category", () => {
    mockState = {
      categories: [],
      offers: [{ ...makeOffer(1, "عرض قديم", "inactive"), categoryId: null }]
    };

    render(createElement(OffersListPage));

    fireEvent.click(screen.getByLabelText("إجراءات"));

    expect(screen.queryByTitle("تفعيل")).not.toBeInTheDocument();
    expect(screen.getByText("اختاري قسمًا للعرض قبل تفعيله")).toBeInTheDocument();
  });
});

