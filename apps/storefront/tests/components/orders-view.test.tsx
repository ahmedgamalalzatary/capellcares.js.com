import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrdersView } from "@/components/orders/orders-view";

const fetchCustomerOrders = vi.fn();
const logout = vi.fn();
let accessToken = "token";

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Capella User", email: "user@capella.test" },
    accessToken,
    logout
  })
}));

vi.mock("@/lib/api/client", () => ({
  fetchCustomerOrders: (...args: any[]) => fetchCustomerOrders(...args),
  // The order cards resolve line items back to the live catalog for thumbnails.
  fetchProducts: () => Promise.resolve([]),
  fetchOffers: () => Promise.resolve([]),
  fetchCollections: () => Promise.resolve([]),
  fetchCategories: () => Promise.resolve([])
}));

const dict = {
  orders: {
    loginRequired: "Orders require an account",
    loginRequiredDesc: "Login first",
    empty: "No orders",
    loadError: "Could not load your orders. Please try again.",
    orderCode: "Order code",
    paymentStatus: "Payment status",
    orderDate: "Order date",
    viewDetails: "View details",
    statusPending: "Pending",
    statusAccepted: "Accepted",
    statusDenied: "Denied",
    itemsCountOne: "1 item",
    itemsCount: "{n} items",
    andMore: "+{n} more"
  },
  wishlist: { goLogin: "Log in" },
  common: { loading: "Loading", total: "Total", currency: "EGP" },
  cart: { keepShopping: "Keep shopping" }
};

describe("OrdersView", () => {
  beforeEach(() => {
    accessToken = "token";
    fetchCustomerOrders.mockReset();
    fetchCustomerOrders.mockResolvedValue([]);
    logout.mockReset();
  });

  it("renders customer orders returned by the storefront API client", async () => {
    fetchCustomerOrders.mockResolvedValue([
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
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 11,
            orderId: 5,
            itemType: "product_variant",
            variantId: 3,
            offerId: null,
            collectionId: null,
            qty: 2,
            unitPrice: 160,
            lineTotal: 320,
            snapshotNameAr: "منتج",
            snapshotNameEn: "Rose Lotion",
            snapshotSizeLabel: "100ml"
          }
        ]
      }
    ]);

    render(createElement(OrdersView, { lang: "en", dict }));

    await waitFor(() => expect(screen.getByText("ABCD-005")).toBeInTheDocument());
    // The status chip is localized from the union, not echoed as the raw value.
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByText("accepted")).not.toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("shows the login-required state when the orders request is unauthorized", async () => {
    fetchCustomerOrders.mockRejectedValue(new Error("API 401 /api/v1/orders"));
    logout.mockRejectedValue(new TypeError("logout network down"));

    render(createElement(OrdersView, { lang: "en", dict }));

    await waitFor(() => expect(screen.getByText("Orders require an account")).toBeInTheDocument());
    expect(logout.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("No orders")).not.toBeInTheDocument();
  });

  it("preserves the session when token refresh is temporarily unavailable", async () => {
    fetchCustomerOrders.mockRejectedValue(new Error("Authentication refresh unavailable"));

    render(createElement(OrdersView, { lang: "en", dict }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your orders. Please try again.");
    expect(logout).not.toHaveBeenCalled();
  });

  it("shows an error instead of an empty order history when loading fails", async () => {
    fetchCustomerOrders.mockRejectedValue(new TypeError("network down"));

    render(createElement(OrdersView, { lang: "en", dict }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your orders. Please try again.");
    expect(screen.queryByText("No orders")).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it("ignores customer A's delayed result after switching to customer B", async () => {
    let releaseCustomerA!: (orders: unknown[]) => void;
    fetchCustomerOrders
      .mockImplementationOnce(() => new Promise((resolve) => { releaseCustomerA = resolve; }))
      .mockResolvedValueOnce([{
        id: 22,
        orderCode: "ORDER-B",
        paymentStatus: "accepted",
        totalAmount: 50,
        createdAt: "2026-05-20T10:00:00.000Z",
        items: []
      }]);

    const view = render(createElement(OrdersView, { lang: "en", dict }));
    accessToken = "token-b";
    view.rerender(createElement(OrdersView, { lang: "en", dict }));

    expect(await screen.findByText("ORDER-B")).toBeInTheDocument();
    releaseCustomerA([{
      id: 11,
      orderCode: "ORDER-A",
      paymentStatus: "accepted",
      totalAmount: 50,
      createdAt: "2026-05-19T10:00:00.000Z",
      items: []
    }]);

    await waitFor(() => expect(screen.queryByText("ORDER-A")).not.toBeInTheDocument());
    expect(screen.getByText("ORDER-B")).toBeInTheDocument();
  });
});
