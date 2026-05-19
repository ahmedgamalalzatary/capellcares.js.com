import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    orders: [{
      id: 5,
      orderCode: "YMFI-005",
      customerType: "registered",
      customerId: 1,
      fullName: "Capella User",
      phone: "01012345678",
      email: "user@capella.test",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      buildingApartment: "Building 4",
      notes: null,
      paymentMethod: "cod",
      paymentStatus: "pending",
      totalAmount: 213,
      createdAt: "2026-05-19T00:00:00.000Z"
    }]
  })
}));

import OrdersPage from "@/app/orders/page";

describe("OrdersPage", () => {
  it("renders an explicit details action linking to the ERP order detail page", () => {
    render(createElement(OrdersPage));

    const detailsLink = screen.getByRole("link", { name: "التفاصيل" });
    expect(detailsLink).toBeInTheDocument();
    expect(detailsLink).toHaveAttribute("href", "/orders/5");
  });
});
