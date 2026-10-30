import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderCancel } from "@/components/orders/order-cancel";

const dict = {
  orders: {
    shipping: {
      cancel: "Cancel order",
      confirm: "Confirm cancellation",
      keep: "Keep order",
      cancelling: "Cancelling",
      confirmMessage: "Cancel this order?",
      cancelError: "Could not cancel",
      cancelUnavailable: "No longer cancellable"
    }
  }
};

afterEach(cleanup);

describe("OrderCancel", () => {
  it("cancels only after the customer confirms", async () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    render(createElement(OrderCancel, { dict, onCancel }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps the order when the customer changes their mind", () => {
    const onCancel = vi.fn();
    render(createElement(OrderCancel, { dict, onCancel }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep order" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
  });

  it("explains when the order can no longer be cancelled", async () => {
    const onCancel = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: "ORDER_CANCELLATION_UNAVAILABLE" }));
    render(createElement(OrderCancel, { dict, onCancel }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("No longer cancellable");
  });
});
