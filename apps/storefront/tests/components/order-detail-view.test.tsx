import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ accessToken: "customer-token" })
}));

const { fetchCustomerOrderById, submitReview } = vi.hoisted(() => ({
  fetchCustomerOrderById: vi.fn(),
  submitReview: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ fetchCustomerOrderById, submitReview }));

import { OrderDetailView } from "@/components/orders/order-detail-view";

const dict = {
  common: { loading: "Loading", empty: "Empty", total: "Total" },
  cart: { item: "Item", qty: "Qty", price: "Price" },
  orders: { orderCode: "Order", paymentStatus: "Payment", backToOrders: "Back" },
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
  vi.clearAllMocks();
  fetchCustomerOrderById.mockResolvedValue({
    id: 12,
    orderCode: "ORDER-12",
    paymentStatus: "accepted",
    totalAmount: 50,
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
  it("lets an eligible signed-in customer submit one review from the order item", async () => {
    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 12 }));

    expect((await screen.findByText("accepted")).className).toContain("chip--sage");
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
      items: []
    });

    render(createElement(OrderDetailView, { lang: "en", dict, orderId: 13 }));

    expect((await screen.findByText("denied")).className).toContain("chip--accent");
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
