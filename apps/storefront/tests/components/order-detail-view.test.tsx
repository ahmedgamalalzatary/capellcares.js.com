import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

const logout = vi.fn();

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ accessToken, logout })
}));

let accessToken: string | null = "customer-token";

const { fetchCustomerOrderById, submitReview } = vi.hoisted(() => ({
  fetchCustomerOrderById: vi.fn(),
  submitReview: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  fetchCustomerOrderById,
  submitReview,
  fetchProducts: () => Promise.resolve([{
    id: 7,
    slug: "body-lotion",
    name: { ar: "لوشن الجسم", en: "Body Lotion" },
    imagePath: "",
    categoryId: 4,
    variants: [{ id: 3 }]
  }]),
  fetchOffers: () => Promise.resolve([]),
  fetchCollections: () => Promise.resolve([]),
  fetchCategories: () => Promise.resolve([{
    id: 4,
    name: { ar: "لوشن الجسم", en: "Body Lotion" }
  }])
}));

import { OrderDetailView } from "@/components/orders/order-detail-view";

const dict = {
  common: { loading: "Loading", empty: "Empty", total: "Total", subtotal: "Subtotal", currency: "EGP" },
  cart: { item: "Item", qty: "Qty", price: "Price" },
  checkout: {
    fullName: "Full name",
    phone: "Phone",
    governorate: "Governorate",
    city: "City",
    addressLine: "Address",
    building: "Building",
    notes: "Notes",
    cod: "Cash on Delivery"
  },
  orders: {
    orderCode: "Order",
    paymentStatus: "Payment",
    backToOrders: "Back",
    statusPending: "Pending",
    statusAccepted: "Accepted",
    statusDenied: "Denied",
    placedOn: "Placed on",
    itemsCountOne: "1 item",
    itemsCount: "{n} items",
    deliveryDetails: "Delivery details",
    paymentMethod: "Payment method",
    orderSummary: "Order summary",
    itemsInOrder: "Items in this order",
    unavailableItem: "No longer available",
    loadError: "Could not load your orders. Please try again."
  },
  reviews: {
    writeReview: "Write a review",
    submitted: "Review submitted",
    unavailable: "Available after payment is accepted",
    promptTitle: "How was your purchase?",
    rating: "Rating",
    comment: "Your review",
    commentPlaceholder: "Share your experience",
    submit: "Submit review",
    submitting: "Submitting…",
    dismiss: "Cancel",
    close: "Close",
    validation: "Choose 1–5 stars and write at least 3 characters.",
    submitError: "Could not submit your review. Please try again."
  }
};

beforeEach(() => {
  accessToken = "customer-token";
  vi.clearAllMocks();
  logout.mockReset();
  fetchCustomerOrderById.mockResolvedValue({
    id: 12,
    orderCode: "ORDER-12",
    paymentStatus: "accepted",
    totalAmount: 50,
    createdAt: "2026-05-20T10:00:00.000Z",
    fullName: "Capella User",
    phone: "01012345678",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: null,
    items: [{
      id: 20,
      itemType: "product_variant",
      variantId: 3,
      offerId: null,
      collectionId: null,
      qty: 1,
      unitPrice: 50,
      lineTotal: 50,
      snapshotNameAr: "منتج",
      snapshotNameEn: "Product",
      snapshotSizeLabel: "100ml",
      review: { entityType: "product", entityId: 7, state: "eligible" }
    }]
  });
  submitReview.mockResolvedValue({ id: 99 });
});

describe("OrderDetailView reviews", () => {
  it("shows the order total in the header metadata and each item's classification", async () => {
    fetchCustomerOrderById.mockResolvedValue({
      ...(await fetchCustomerOrderById()),
      totalAmount: 75
    });

    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));

    expect(await screen.findByText(/EGP\s*75/)).toBeInTheDocument();
    expect(await screen.findByText("Body Lotion")).toBeInTheDocument();
  });

  it("shows an error instead of an empty receipt when loading fails", async () => {
    fetchCustomerOrderById.mockRejectedValue(new TypeError("network down"));

    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your orders. Please try again.");
    expect(screen.queryByText("Empty")).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it("logs out when the order request is rejected with the API 401 contract", async () => {
    fetchCustomerOrderById.mockRejectedValue(new Error("API 401 /api/v1/orders/12"));
    logout.mockRejectedValue(new TypeError("logout network down"));

    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));

    await waitFor(() => expect(logout.mock.calls.length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("ORDER-12")).not.toBeInTheDocument();
  });

  it("ignores customer A's delayed receipt after switching to customer B", async () => {
    let releaseCustomerA!: (order: unknown) => void;
    fetchCustomerOrderById
      .mockImplementationOnce(() => new Promise((resolve) => { releaseCustomerA = resolve; }))
      .mockResolvedValueOnce({
        id: 22,
        orderCode: "ORDER-B",
        paymentStatus: "accepted",
        totalAmount: 50,
        createdAt: "2026-05-20T10:00:00.000Z",
        items: []
      });

    const view = render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));
    accessToken = "customer-b-token";
    view.rerender(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));

    expect(await screen.findByText("ORDER-B")).toBeInTheDocument();
    releaseCustomerA({
      id: 11,
      orderCode: "ORDER-A",
      paymentStatus: "accepted",
      totalAmount: 50,
      createdAt: "2026-05-19T10:00:00.000Z",
      items: []
    });

    await waitFor(() => expect(screen.queryByText("ORDER-A")).not.toBeInTheDocument());
    expect(screen.getByText("ORDER-B")).toBeInTheDocument();
  });

  it("hides the loaded receipt when the access token is cleared", async () => {
    const view = render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));
    expect(await screen.findByText("ORDER-12")).toBeInTheDocument();

    accessToken = null;
    view.rerender(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));

    await waitFor(() => expect(screen.queryByText("ORDER-12")).not.toBeInTheDocument());
  });

  it("lets an eligible signed-in customer submit one review from the order item", async () => {
    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));

    expect((await screen.findByText("Accepted")).className).toContain("chip--sage");
    fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    fireEvent.click(screen.getByRole("button", { name: "5 stars" }));
    fireEvent.change(screen.getByLabelText("Your review"), { target: { value: "Wonderful product" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(submitReview).toHaveBeenCalledWith("customer-token", {
      entityType: "product",
      entityId: 7,
      rating: 5,
      comment: "Wonderful product"
    });
    expect(await screen.findByText("Review submitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Write a review" })).not.toBeInTheDocument();
  });

  it("renders a denied backend payment status with the danger treatment", async () => {
    fetchCustomerOrderById.mockResolvedValue({
      id: 13,
      orderCode: "ORDER-13",
      paymentStatus: "denied",
      totalAmount: 50,
      createdAt: "2026-05-20T10:00:00.000Z",
      fullName: "Capella User",
      phone: "01012345678",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      buildingApartment: "Building 4",
      notes: null,
      items: []
    });

    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 13 }));

    expect((await screen.findByText("Denied")).className).toContain("chip--accent");
  });

  it("contains keyboard focus in the review form and restores it to the opener", async () => {
    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));
    const opener = await screen.findByRole("button", { name: "Write a review" });
    opener.focus();
    fireEvent.click(opener);

    const close = screen.getByRole("button", { name: "Close" });
    const dismiss = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(close).toHaveFocus());

    dismiss.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.click(close);
    expect(opener).toHaveFocus();
  });

  it("marks every duplicate line for the reviewed target as submitted", async () => {
    const order = await fetchCustomerOrderById();
    fetchCustomerOrderById.mockResolvedValue({
      ...order,
      items: [order.items[0], { ...order.items[0], id: 21 }]
    });
    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));

    const writeButtons = await screen.findAllByRole("button", { name: "Write a review" });
    fireEvent.click(writeButtons[0]!);
    fireEvent.click(screen.getByRole("button", { name: "5 stars" }));
    fireEvent.change(screen.getByLabelText("Your review"), { target: { value: "Wonderful product" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findAllByText("Review submitted")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Write a review" })).not.toBeInTheDocument();
  });
});
