import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrdersView } from "@/components/orders/orders-view";

const fetchCustomerOrders = vi.fn();

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Capella User", email: "user@capella.test" },
    accessToken: "token"
  })
}));

vi.mock("@/lib/api/client", () => ({
  fetchCustomerOrders: (...args: any[]) => fetchCustomerOrders(...args)
}));

const dict = {
  orders: {
    loginRequired: "Orders require an account",
    loginRequiredDesc: "Login first",
    empty: "No orders",
    orderCode: "Order code",
    paymentStatus: "Payment status",
    orderDate: "Order date",
    viewDetails: "View details"
  },
  wishlist: { goLogin: "Log in" },
  common: { loading: "Loading", total: "Total" },
  cart: { keepShopping: "Keep shopping" }
};

describe("OrdersView", () => {
  it("renders customer orders returned by the storefront API client", async () => {
    fetchCustomerOrders.mockResolvedValueOnce([
      {
        id: 5,
        orderCode: "ABCD-005",
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
        paymentStatus: "accepted",
        totalAmount: 320,
        createdAt: new Date().toISOString()
      }
    ]);

    render(createElement(OrdersView, { lang: "en", dict }));

    await waitFor(() => expect(screen.getByText("ABCD-005")).toBeInTheDocument());
    expect(screen.getByText("accepted")).toBeInTheDocument();
  });
});
