import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const makeMockState = () => ({ offers: [makeOffer(1, "عرض", "active")] });
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
