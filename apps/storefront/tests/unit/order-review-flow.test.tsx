import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchOrder = vi.fn();
const fetchEligibility = vi.fn();
const submitReview = vi.fn();

vi.mock("next/link", () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ accessToken: "customer-token" })
}));
vi.mock("@/lib/api/client", () => ({
  fetchCustomerOrderById: (...args: any[]) => fetchOrder(...args),
  fetchOrderReviewEligibility: (...args: any[]) => fetchEligibility(...args),
  submitCustomerReview: (...args: any[]) => submitReview(...args)
}));

import { OrderDetailView } from "@/components/orders/order-detail-view";

const dict = {
  common: { loading: "Loading", empty: "Empty", total: "Total", cancel: "Cancel" },
  orders: { orderCode: "Order", paymentStatus: "Status", backToOrders: "Back" },
  cart: { item: "Item", qty: "Qty", price: "Price" },
  reviews: {
    writeReview: "Write review",
    ratingLabel: "Rating",
    commentLabel: "Comment",
    commentOptional: "Optional",
    submit: "Submit review",
    submissionError: "Could not submit your review. Please try again.",
    submitted: "Review submitted",
    pendingApproval: "Pending approval",
    statuses: { pending: "Pending approval", approved: "Approved", rejected: "Rejected", hidden: "Hidden", deleted: "Removed" }
  }
};

describe("order review flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOrder.mockResolvedValue({
      id: 10,
      orderCode: "ORDER-10",
      paymentStatus: "accepted",
      totalAmount: 35,
      items: [{ id: 20, qty: 1, unitPrice: 35, lineTotal: 35, snapshotNameEn: "Rose Oil", snapshotNameAr: "زيت الورد" }]
    });
    fetchEligibility.mockResolvedValue({
      orderId: 10,
      paymentStatus: "accepted",
      items: [{ orderItemId: 20, entityType: "product", entityId: 5, eligible: true, submitted: false }]
    });
    submitReview.mockResolvedValue({ id: 1, status: "pending" });
  });

  it("submits a required star rating with an optional comment from an accepted order item", async () => {
    render(<OrderDetailView lang="en" dict={dict} orderId={10} />);
    await screen.findByText("Rose Oil");
    fireEvent.click(screen.getByRole("button", { name: "Write review" }));
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Loved it" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() => expect(submitReview).toHaveBeenCalledWith("customer-token", {
      entityType: "product",
      entityId: 5,
      rating: 5,
      comment: "Loved it"
    }));
    expect(await screen.findByText("Pending approval")).toBeInTheDocument();
  });

  it("keeps the review draft and shows localized feedback when submission fails", async () => {
    submitReview.mockRejectedValue(new Error("network"));
    render(<OrderDetailView lang="en" dict={dict} orderId={10} />);
    await screen.findByText("Rose Oil");
    fireEvent.click(screen.getByRole("button", { name: "Write review" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Could not submit your review. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
    expect(screen.getByLabelText("Comment")).toHaveValue("Keep this draft");
    expect(screen.getByRole("button", { name: "Submit review" })).toBeEnabled();
  });

  it("clears the rating and comment when cancelling a review draft", async () => {
    render(<OrderDetailView lang="en" dict={dict} orderId={10} />);
    await screen.findByText("Rose Oil");
    fireEvent.click(screen.getByRole("button", { name: "Write review" }));
    fireEvent.click(screen.getByRole("radio", { name: "3 stars" }));
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Discard this" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Write review" }));

    expect(screen.getByRole("radio", { name: "3 stars" })).not.toBeChecked();
    expect(screen.getByLabelText("Comment")).toHaveValue("");
  });
});
