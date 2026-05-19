import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const fetchOrder = vi.fn();
const updateOrderPaymentStatus = vi.fn();

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    fetchOrder,
    updateOrderPaymentStatus
  })
}));

import { OrderDetailsView } from "@/components/orders/order-details-view";

describe("OrderDetailsPage", () => {
  it("renders the fetched admin order detail and updates payment status", async () => {
    fetchOrder.mockResolvedValueOnce({
      id: 5,
      orderCode: "YMFI-005",
      fullName: "Capella User",
      phone: "01012345678",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      paymentStatus: "pending",
      items: [
        {
          id: 11,
          itemType: "product",
          qty: 2,
          unitPrice: 100,
          lineTotal: 200,
          snapshotNameAr: "شامبو",
          snapshotNameEn: "Shampoo"
        }
      ]
    });
    updateOrderPaymentStatus.mockResolvedValueOnce(undefined);

    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    await waitFor(() => expect(fetchOrder).toHaveBeenCalledWith(5));
    expect(await screen.findByText(/YMFI-005/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "accepted" } });

    await waitFor(() => expect(updateOrderPaymentStatus).toHaveBeenCalledWith(5, "accepted"));
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("accepted"));
  });

  it("shows an error state instead of hanging when order fetch fails", async () => {
    fetchOrder.mockRejectedValueOnce(new Error("fetch failed"));

    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    await waitFor(() => expect(fetchOrder).toHaveBeenCalledWith(5));
    expect(await screen.findByText("تعذر تحميل تفاصيل الطلب. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.queryByText("جارٍ التحميل…")).not.toBeInTheDocument();
  });
});
