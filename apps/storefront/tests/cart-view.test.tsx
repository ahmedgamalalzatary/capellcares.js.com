import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { CartView } from "@/components/cart/CartView";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("CartView", () => {
  it("does not mark lines unavailable after a catalog request failure and disables checkout", async () => {
    localStorage.setItem("minikoshk_cart", JSON.stringify([{ type: "product", variantId: 1, qty: 1 }]));
    const fetchMock = vi.fn().mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    render(<LocaleProvider lang="en"><CartView /></LocaleProvider>);

    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      await Promise.allSettled(fetchMock.mock.results.map(({ value }) => value));
    });
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
    const checkout = screen.getByText("Proceed to checkout");
    expect(checkout).toHaveAttribute("aria-disabled", "true");
    expect(checkout).not.toHaveAttribute("href");
  });
});
