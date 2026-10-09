import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({ user: { role: "admin", permissionKeys: ["orders.read"] } })
}));
vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => createElement("div", null, children)
}));
const requeuePaymobCallback = vi.fn(async () => {});
vi.mock("@/lib/store", () => ({
  getStore: () => ({
    fetchPaymobReconciliation: async () => ({
      items: [{
        checkoutId: "checkout_abc", customerName: "Late Customer", customerEmail: "late@example.com",
        amountCents: 3500, currency: "EGP", environment: "test", paymobOrderId: "9025",
        paymobTransactionId: "7025", reason: "PAID_AFTER_RESERVATION_RELEASE"
      }],
      callbackProblems: [{
        callbackId: 77, checkoutId: "checkout_parked", customerName: "Parked Customer",
        customerEmail: "parked@example.com", amountCents: 3500, currency: "EGP", environment: "test",
        paymobOrderId: "9030", paymobTransactionId: "7030",
        reason: "REFUND_VERIFICATION_UNRESOLVED", ageMs: 3600_000
      }]
    }),
    requeuePaymobCallback
  })
}));

import ReconciliationPage from "@/app/orders/reconciliation/page";

beforeEach(() => { requeuePaymobCallback.mockClear(); });

describe("Paymob reconciliation queue", () => {
  it("shows paid-but-unfulfillable checkout references for ERP staff", async () => {
    render(createElement(ReconciliationPage));
    expect(await screen.findByText("checkout_abc")).toBeInTheDocument();
    expect(screen.getByText("7025")).toBeInTheDocument();
  });

  it("surfaces a parked callback that produced no flagged attempt", async () => {
    render(createElement(ReconciliationPage));
    expect(await screen.findByText("checkout_parked")).toBeInTheDocument();
    expect(screen.getByText("REFUND_VERIFICATION_UNRESOLVED")).toBeInTheDocument();
  });

  it("requeues a parked callback for a safe retry", async () => {
    render(createElement(ReconciliationPage));
    const button = await screen.findByRole("button", { name: "إعادة المحاولة" });
    fireEvent.click(button);
    await waitFor(() => expect(requeuePaymobCallback).toHaveBeenCalledWith(77));
  });
});
