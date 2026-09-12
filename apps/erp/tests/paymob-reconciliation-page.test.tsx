import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({ user: { role: "admin", permissionKeys: ["orders.read"] } })
}));
vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => createElement("div", null, children)
}));
vi.mock("@/lib/store", () => ({ getStore: () => ({ fetchPaymobReconciliation: async () => [{
  checkoutId: "checkout_abc", customerName: "Late Customer", customerEmail: "late@example.com",
  amountCents: 3500, currency: "EGP", environment: "test", paymobOrderId: "9025",
  paymobTransactionId: "7025", reason: "PAID_AFTER_RESERVATION_RELEASE"
}] }) }));

describe("Paymob reconciliation queue", () => {
  it("shows paid-but-unfulfillable checkout references for ERP staff", async () => {
    const modulePath = "@/app/orders/reconciliation/page";
    const { default: Page } = await import(/* @vite-ignore */ modulePath).catch(() => ({ default: () => null }));
    render(createElement(Page));
    expect(await screen.findByText("checkout_abc")).toBeInTheDocument();
    expect(screen.getByText("7025")).toBeInTheDocument();
  });
});
