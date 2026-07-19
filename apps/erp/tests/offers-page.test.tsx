import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toggleOfferStatus = vi.fn().mockRejectedValue(new Error("toggle failed"));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["offers.read", "offers.create", "offers.update", "offers.soft_delete", "offers.toggle_status"] },
    hydrated: true,
    logout: vi.fn()
  })
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    offers: [{
      id: 1,
      slug: "offer-1",
      name: { ar: "عرض", en: "Offer" },
      description: { ar: "وصف", en: "Description" },
      imagePath: "",
      price: 100,
      originalTotal: 150,
      items: [{ variantId: 1, qty: 1 }],
      stock: 3,
      status: "active",
      createdAt: "",
      updatedAt: ""
    }]
  }),
  getStore: () => ({
    softDeleteOffer: vi.fn(),
    toggleOfferStatus
  })
}));

import OffersListPage from "@/app/offers/page";

describe("OffersListPage", () => {
  it("keeps the toggle modal open and shows an error when status toggle fails", async () => {
    render(createElement(OffersListPage));

    fireEvent.click(screen.getByLabelText("إجراءات"));
    fireEvent.click(screen.getByTitle("إيقاف"));
    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));

    expect(toggleOfferStatus).toHaveBeenCalledWith(1);
    expect(await screen.findByText("تعذر تحديث حالة العرض. حاول مرة أخرى.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
