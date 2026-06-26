import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
  hydrated: true,
  logout: vi.fn()
}));

const mockedUseStore = vi.fn((selector: any) => selector({
  orders: [{
    id: 5,
    orderCode: "YMFI-005",
    customerType: "registered",
    customerId: 1,
    fullName: "minikoshk User",
    phone: "01012345678",
    email: "user@minikoshk.test",
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
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

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
  useStore: (selector: any) => mockedUseStore(selector)
}));

import OrdersPage from "@/app/orders/page";
describe("OrdersPage", () => {
  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
      hydrated: true,
      logout: vi.fn()
    });
    mockedUseStore.mockClear();
  });

  it("shows a 403 state without subscribing to order data for unauthorized staff", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@minikoshk.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(OrdersPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الطلبات.")).toBeInTheDocument();
    expect(mockedUseStore).not.toHaveBeenCalled();
  });

  it("renders an explicit details action linking to the ERP order detail page", () => {
    render(createElement(OrdersPage));

    const detailsLink = screen.getByRole("link", { name: "التفاصيل" });
    expect(detailsLink).toBeInTheDocument();
    expect(detailsLink).toHaveAttribute("href", "/orders/5");
  });
});
