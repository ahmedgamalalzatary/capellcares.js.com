import { createElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast, Toaster } from "sonner";
import { OrderReviewFlagAlerts } from "@/components/orders/order-review-flag-alerts";

const { fetchOpenOrderReviewFlags, resolveOrderReviewFlag } = vi.hoisted(() => ({
  fetchOpenOrderReviewFlags: vi.fn(),
  resolveOrderReviewFlag: vi.fn()
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({ fetchOpenOrderReviewFlags, resolveOrderReviewFlag })
}));
vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({ user: { role: "staff", permissionKeys: ["orders.read"] } })
}));

const openFlag = { id: 71, orderId: 5, orderCode: "YMFI-005", flagType: "untouched_paid",
  reason: "Passed the deadline", status: "open", customerName: "Checkout Customer", totalAmount: 200,
  orderCreatedAt: "2026-09-21T09:00:00.000Z", flaggedAt: "2026-09-25T09:00:00.000Z" };
const title = "طلب مدفوع تجاوز 96 ساعة دون تجهيز";

describe("OrderReviewFlagAlerts feed reconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    fetchOpenOrderReviewFlags.mockReset();
    fetchOpenOrderReviewFlags.mockResolvedValue([openFlag]);
    resolveOrderReviewFlag.mockReset();
    resolveOrderReviewFlag.mockResolvedValue(undefined);
  });

  afterEach(() => {
    toast.dismiss();
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("removes a warning when another staff member resolves its flag", async () => {
    render(createElement("div", null, createElement(Toaster), createElement(OrderReviewFlagAlerts)));
    await waitFor(() => expect(screen.getByText(title)).toBeInTheDocument());

    fetchOpenOrderReviewFlags.mockResolvedValue([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_500); });

    // Sonner removes the toast after its exit animation has completed.
    await waitFor(() => expect(screen.queryByText(title)).not.toBeInTheDocument());
    expect(resolveOrderReviewFlag).not.toHaveBeenCalled();
  });

  it("keeps the visible warning when the next feed request fails", async () => {
    render(createElement("div", null, createElement(Toaster), createElement(OrderReviewFlagAlerts)));
    await waitFor(() => expect(screen.getByText(title)).toBeInTheDocument());

    fetchOpenOrderReviewFlags.mockRejectedValue(new Error("API unavailable"));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_500); });

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(resolveOrderReviewFlag).not.toHaveBeenCalled();
  });
});
