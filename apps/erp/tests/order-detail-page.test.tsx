import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchOrder = vi.fn();
const updateOrderPaymentStatus = vi.fn();
const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
  hydrated: true,
  logout: vi.fn()
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
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

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockedUseAdminAuth.mockReset();
  mockedUseAdminAuth.mockReturnValue({
    user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
    hydrated: true,
    logout: vi.fn()
  });
  fetchOrder.mockReset();
  updateOrderPaymentStatus.mockReset();
});

describe("OrderDetailsPage", () => {
  it("disables payment-status mutation for staff without orders.update_payment_status", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@minikoshk.test", role: "staff", permissionKeys: ["orders.read"] },
      hydrated: true,
      logout: vi.fn()
    });
    fetchOrder.mockResolvedValueOnce({
      id: 5,
      orderCode: "YMFI-005",
      fullName: "Capella User",
      phone: "01012345678",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      paymentStatus: "pending",
      items: []
    });

    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    await waitFor(() => expect(fetchOrder).toHaveBeenCalledWith(5));
    expect(await screen.findByRole("combobox")).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "accepted" } });
    expect(updateOrderPaymentStatus).not.toHaveBeenCalled();
  });

  it("renders the fetched admin order detail and updates payment status", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
      hydrated: true,
      logout: vi.fn()
    });
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
    expect((await screen.findAllByText(/YMFI-005/)).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "accepted" } });

    await waitFor(() => expect(updateOrderPaymentStatus).toHaveBeenCalledWith(5, "accepted"));
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("accepted"));
  });

  it("locks payment-status changes when the order is already denied", async () => {
    fetchOrder.mockResolvedValueOnce({
      id: 5,
      orderCode: "YMFI-005",
      fullName: "Capella User",
      phone: "01012345678",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      paymentStatus: "denied",
      items: []
    });

    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    await waitFor(() => expect(fetchOrder).toHaveBeenCalledWith(5));
    expect(await screen.findByRole("combobox")).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "accepted" } });
    expect(updateOrderPaymentStatus).not.toHaveBeenCalled();
  });

  it("shows an error state instead of hanging when order fetch fails", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
      hydrated: true,
      logout: vi.fn()
    });
    fetchOrder.mockRejectedValueOnce(new Error("fetch failed"));

    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    await waitFor(() => expect(fetchOrder).toHaveBeenCalledWith(5));
    expect(await screen.findByText("تعذر تحميل تفاصيل الطلب. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.queryByText("جارٍ التحميل…")).not.toBeInTheDocument();
  });
});
