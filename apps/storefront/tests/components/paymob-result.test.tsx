import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const clear = vi.fn();
const fetchCheckoutStatus = vi.fn();
const replace = vi.fn();
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
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
  it("routes the locale-neutral Paymob return using the saved checkout language", async () => {
    const { default: PaymobReturnPage } = await import("@/app/checkout/payment-result/page");
    sessionStorage.setItem("capella:paymob-checkout-lang", "en");

    render(<PaymobReturnPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/checkout/payment-result"));
  });

  it("preserves the checkout reference while localizing the Paymob return", async () => {
    const { default: PaymobReturnPage } = await import("@/app/checkout/payment-result/page");
    sessionStorage.setItem("capella:paymob-checkout-lang", "en");
    window.history.replaceState({}, "", "/checkout/payment-result?checkoutId=checkout_abc");

    render(<PaymobReturnPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      "/en/checkout/payment-result?checkoutId=checkout_abc"
    ));
  });

  it("does not claim to confirm payment when this browser has no checkout reference", async () => {
    const { PaymobResult } = await import("@/components/checkout/paymob-result");
    render(<PaymobResult lang="en" dict={getDict("en")} />);
    expect(await screen.findByText("No payment to check")).toBeInTheDocument();
    expect(screen.queryByText("Confirming your payment")).toBeNull();
    expect(fetchCheckoutStatus).not.toHaveBeenCalled();
  });

  it("checks the payment returned by Paymob when browser session storage is unavailable", async () => {
    const { PaymobResult } = await import("@/components/checkout/paymob-result");
    fetchCheckoutStatus.mockResolvedValue({ checkoutId: "checkout_abc", status: "completed",
      expiresAt: new Date(Date.now() + 300000).toISOString(), attemptsUsed: 1,
      latestAttemptStatus: "succeeded", canRetry: false,
      order: { id: 7, orderCode: "CAP-7" } });

    render(<PaymobResult lang="en" dict={getDict("en")} returnCheckoutId="checkout_abc" />);

    expect(await screen.findByText("CAP-7")).toBeInTheDocument();
    expect(fetchCheckoutStatus).toHaveBeenCalledWith("checkout_abc");
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

  it("preserves the checkout reference when redirecting to the saved locale", async () => {
    const modulePath = "@/components/checkout/paymob-result";
    const { PaymobResult } = await import(/* @vite-ignore */ modulePath).catch(() => ({
      PaymobResult: () => null
    }));
    sessionStorage.setItem("capella:paymob-checkout-lang", "ar");
    fetchCheckoutStatus.mockResolvedValue({ checkoutId: "checkout_abc", status: "payment_pending",
      expiresAt: new Date(Date.now() + 300000).toISOString(), attemptsUsed: 1,
      latestAttemptStatus: "pending", canRetry: false, order: null });
    render(<PaymobResult lang="en" dict={getDict("en")} returnCheckoutId="checkout abc&x=1" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      `/ar/checkout/payment-result?checkoutId=${encodeURIComponent("checkout abc&x=1")}`
    ));
  });

  it("restarts polling and displayed results when the callback identifier changes", async () => {
    const modulePath = "@/components/checkout/paymob-result";
    const { PaymobResult } = await import(/* @vite-ignore */ modulePath).catch(() => ({
      PaymobResult: () => null
    }));
    fetchCheckoutStatus.mockImplementation((checkoutId: string) => {
      if (checkoutId === "checkout_first") {
        return Promise.resolve({ checkoutId, status: "payment_pending",
          expiresAt: new Date(Date.now() + 300000).toISOString(), attemptsUsed: 1,
          latestAttemptStatus: "failed", canRetry: false, order: null });
      }
      if (checkoutId === "checkout_second") {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve({ checkoutId, status: "payment_pending",
        expiresAt: new Date(Date.now() + 300000).toISOString(), attemptsUsed: 1,
        latestAttemptStatus: "pending", canRetry: false, order: null });
    });
    const { rerender } = render(
      <PaymobResult lang="en" dict={getDict("en")} returnCheckoutId="checkout_first" />
    );
    expect(await screen.findByText("Payment was not completed")).toBeInTheDocument();

    rerender(<PaymobResult lang="en" dict={getDict("en")} returnCheckoutId="checkout_second" />);
    await waitFor(() => expect(fetchCheckoutStatus).toHaveBeenCalledWith("checkout_second"));
    expect(screen.queryByText("Payment was not completed")).toBeNull();
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    rerender(<PaymobResult lang="en" dict={getDict("en")} returnCheckoutId="checkout_third" />);
    await waitFor(() => expect(fetchCheckoutStatus).toHaveBeenCalledWith("checkout_third"));
    expect(await screen.findByText(/confirming your payment/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
