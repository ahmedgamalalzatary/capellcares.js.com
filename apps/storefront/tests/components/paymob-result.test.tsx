import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const clear = vi.fn();
const fetchCheckoutStatus = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/components/providers/cart-provider", () => ({ useCart: () => ({ clear }) }));
vi.mock("@/lib/api/client", () => ({
  fetchCheckoutStatus: (...args: unknown[]) => fetchCheckoutStatus(...args),
  retryPaymobCheckout: vi.fn()
}));

beforeEach(() => {
  clear.mockReset();
  fetchCheckoutStatus.mockReset();
  replace.mockReset();
  sessionStorage.clear();
});

describe("PaymobResult", () => {
  it("does not claim to confirm payment when this browser has no checkout reference", async () => {
    const { PaymobResult } = await import("@/components/checkout/paymob-result");
    render(<PaymobResult lang="en" dict={getDict("en")} />);
    expect(await screen.findByText("No payment to check")).toBeInTheDocument();
    expect(screen.queryByText("Confirming your payment")).toBeNull();
    expect(fetchCheckoutStatus).not.toHaveBeenCalled();
  });

  it("preserves the cart while payment confirmation is pending", async () => {
    const modulePath = "@/components/checkout/paymob-result";
    const { PaymobResult } = await import(/* @vite-ignore */ modulePath).catch(() => ({
      PaymobResult: () => null
    }));
    sessionStorage.setItem("capella:pending-paymob-checkout", "checkout_abc");
    fetchCheckoutStatus.mockResolvedValue({ checkoutId: "checkout_abc", status: "payment_pending",
      expiresAt: new Date(Date.now() + 300000).toISOString(), attemptsUsed: 1,
      latestAttemptStatus: "pending", canRetry: false, order: null });
    render(<PaymobResult lang="en" dict={getDict("en")} />);
    expect(await screen.findByText(/confirming your payment/i)).toBeInTheDocument();
    expect(clear).not.toHaveBeenCalled();
  });

  it("clears the cart only after the local API confirms an order", async () => {
    const modulePath = "@/components/checkout/paymob-result";
    const { PaymobResult } = await import(/* @vite-ignore */ modulePath).catch(() => ({
      PaymobResult: () => null
    }));
    sessionStorage.setItem("capella:pending-paymob-checkout", "checkout_abc");
    fetchCheckoutStatus.mockResolvedValue({ checkoutId: "checkout_abc", status: "completed",
      expiresAt: new Date(Date.now() + 300000).toISOString(), attemptsUsed: 1,
      latestAttemptStatus: "succeeded", canRetry: false,
      order: { id: 7, orderCode: "CAP-7" } });
    render(<PaymobResult lang="en" dict={getDict("en")} />);
    expect(await screen.findByText("CAP-7")).toBeInTheDocument();
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem("capella:pending-paymob-checkout")).toBeNull();
  });

  it("returns an English shopper to the English result page after the locale-neutral Paymob redirect", async () => {
    const modulePath = "@/components/checkout/paymob-result";
    const { PaymobResult } = await import(/* @vite-ignore */ modulePath).catch(() => ({
      PaymobResult: () => null
    }));
    sessionStorage.setItem("capella:pending-paymob-checkout", "checkout_abc");
    sessionStorage.setItem("capella:paymob-checkout-lang", "en");
    fetchCheckoutStatus.mockResolvedValue({ checkoutId: "checkout_abc", status: "payment_pending",
      expiresAt: new Date(Date.now() + 300000).toISOString(), attemptsUsed: 1,
      latestAttemptStatus: "pending", canRetry: false, order: null });
    render(<PaymobResult lang="ar" dict={getDict("ar")} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/checkout/payment-result"));
  });

  it("releases the browser checkout key after expiry without clearing the cart", async () => {
    const modulePath = "@/components/checkout/paymob-result";
    const { PaymobResult } = await import(/* @vite-ignore */ modulePath).catch(() => ({
      PaymobResult: () => null
    }));
    sessionStorage.setItem("capella:pending-paymob-checkout", "checkout_abc");
    sessionStorage.setItem("capella:paymob-checkout-request", "old-key");
    fetchCheckoutStatus.mockResolvedValue({ checkoutId: "checkout_abc", status: "expired",
      expiresAt: new Date(Date.now() - 300000).toISOString(), attemptsUsed: 1,
      latestAttemptStatus: "expired", canRetry: false, order: null });
    render(<PaymobResult lang="en" dict={getDict("en")} />);
    expect(await screen.findByText("Checkout expired")).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem("capella:paymob-checkout-request")).toBeNull());
    expect(clear).not.toHaveBeenCalled();
  });

  it("does not invite a second payment when a late charge needs reconciliation", async () => {
    const modulePath = "@/components/checkout/paymob-result";
    const { PaymobResult } = await import(/* @vite-ignore */ modulePath).catch(() => ({
      PaymobResult: () => null
    }));
    sessionStorage.setItem("capella:pending-paymob-checkout", "checkout_abc");
    fetchCheckoutStatus.mockResolvedValue({ checkoutId: "checkout_abc", status: "expired",
      expiresAt: new Date(Date.now() - 300000).toISOString(), attemptsUsed: 1,
      latestAttemptStatus: "reconciliation_required", canRetry: false, order: null });
    render(<PaymobResult lang="en" dict={getDict("en")} />);
    expect(await screen.findByText(/payment needs review/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Return to checkout" })).toBeNull();
    expect(sessionStorage.getItem("capella:pending-paymob-checkout")).toBe("checkout_abc");
    expect(clear).not.toHaveBeenCalled();
  });
});
