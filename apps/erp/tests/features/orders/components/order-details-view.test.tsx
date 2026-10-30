import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchOrder = vi.fn();
const updateOrderPaymentStatus = vi.fn();
const performShippingAction = vi.fn();
const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
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
    updateOrderPaymentStatus,
    performShippingAction
  })
}));

import { OrderDetailsView } from "@/features/orders/components/order-details-view";

const detailedOrder = {
  id: 5, orderCode: "YMFI-005", customerType: "guest", customerId: null,
  fullName: "Checkout Customer", phone: "01012345678", email: "checkout@example.test",
  governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 10",
  buildingApartment: "Building 4, floor 3, apartment 12", notes: "Call before delivery\nAfter 6 pm",
  paymentMethod: "cod", paymentStatus: "pending", providerPaymentStatus: null,
  refundedAmountCents: 0, totalAmount: 200, createdAt: "2026-09-21T09:00:00.000Z",
  updatedAt: "2026-09-21T10:00:00.000Z", codExpiresAt: "2026-09-23T09:00:00.000Z", payment: null,
  items: [{ id: 11, orderId: 5, itemType: "product_variant", variantId: 7, offerId: null,
    collectionId: null, qty: 2, unitPrice: 100, lineTotal: 200,
    snapshotNameAr: "شامبو", snapshotNameEn: "Shampoo", snapshotSizeLabel: "100ml",
    snapshotBaseUnitPrice: 125, snapshotDiscountType: "percentage", snapshotDiscountValue: 20 }]
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockedUseAdminAuth.mockReset();
  mockedUseAdminAuth.mockReturnValue({
    user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
    hydrated: true,
    logout: vi.fn()
  });
  fetchOrder.mockReset();
  updateOrderPaymentStatus.mockReset();
  performShippingAction.mockReset();
});

describe("OrderDetailsPage", () => {
  it("shows the checkout contact, complete delivery instructions, and recorded dates", async () => {
    fetchOrder.mockResolvedValueOnce(detailedOrder);
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    expect(await screen.findByRole("link", { name: "checkout@example.test" }))
      .toHaveAttribute("href", "mailto:checkout@example.test");
    expect(screen.getByRole("link", { name: "01012345678" })).toHaveAttribute("href", "tel:01012345678");
    expect(screen.getByText(detailedOrder.buildingApartment)).toBeInTheDocument();
    expect(screen.getByText(/Call before delivery/)).toHaveTextContent("After 6 pm");
    expect(screen.getByText("ضيف")).toBeInTheDocument();
    expect(screen.getByText("منتج")).toBeInTheDocument();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
  });

  it("waits for read permission before fetching and survives access changes", async () => {
    mockedUseAdminAuth.mockReturnValue({ user: { name: "Staff", email: "staff@example.test", role: "staff", permissionKeys: [] },
      hydrated: true, logout: vi.fn() });
    const view = render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    expect(fetchOrder).not.toHaveBeenCalled();
    fetchOrder.mockResolvedValueOnce(detailedOrder);
    mockedUseAdminAuth.mockReturnValue({ user: { name: "Staff", email: "staff@example.test", role: "staff", permissionKeys: ["orders.read"] },
      hydrated: true, logout: vi.fn() });
    view.rerender(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    expect(await screen.findByText("YMFI-005")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "حالة الدفع عند الاستلام" })).toBeDisabled();
  });

  it("prevents overlapping payment changes and preserves the saved status when an update fails", async () => {
    fetchOrder.mockResolvedValueOnce(detailedOrder);
    let rejectUpdate!: (error: Error) => void;
    updateOrderPaymentStatus.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectUpdate = reject; }));
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    const select = await screen.findByRole("combobox", { name: "حالة الدفع عند الاستلام" });
    fireEvent.change(select, { target: { value: "accepted" } });
    expect(select).toBeDisabled();
    await act(async () => { rejectUpdate(new Error("Request failed")); });
    expect(screen.getByRole("alert")).toHaveTextContent("تعذر تحديث حالة الدفع");
    expect(select).toHaveValue("pending");
    expect(select).toBeEnabled();
  });
  it("disables payment-status mutation for staff without orders.update_payment_status", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["orders.read"] },
      hydrated: true,
      logout: vi.fn()
    });
    fetchOrder.mockResolvedValueOnce({
      ...detailedOrder,
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
    expect(await screen.findByRole("combobox", { name: "حالة الدفع عند الاستلام" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "حالة الدفع عند الاستلام" }), { target: { value: "accepted" } });
    expect(updateOrderPaymentStatus).not.toHaveBeenCalled();
  });

  it("renders the fetched admin order detail and updates payment status", async () => {
    fetchOrder.mockResolvedValue({ ...detailedOrder, paymentStatus: "accepted" });
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
      hydrated: true,
      logout: vi.fn()
    });
    fetchOrder.mockResolvedValueOnce({
      ...detailedOrder,
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
          itemType: "product_variant",
          qty: 2,
          unitPrice: 100,
          lineTotal: 200,
          snapshotNameAr: "شامبو",
          snapshotNameEn: "Shampoo",
          snapshotSizeLabel: "100ml"
        }
      ]
    });
    updateOrderPaymentStatus.mockResolvedValueOnce(undefined);

    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    await waitFor(() => expect(fetchOrder).toHaveBeenCalledWith(5));
    expect((await screen.findAllByText(/YMFI-005/)).length).toBeGreaterThan(0);
    expect(await screen.findByText("100ml")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "حالة الدفع عند الاستلام" }), { target: { value: "accepted" } });

    await waitFor(() => expect(updateOrderPaymentStatus).toHaveBeenCalledWith(5, "accepted"));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "حالة الدفع عند الاستلام" })).toHaveValue("accepted"));
  });

  it("locks payment-status changes when the order is already denied", async () => {
    fetchOrder.mockResolvedValueOnce({
      ...detailedOrder,
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
    expect(await screen.findByRole("combobox", { name: "حالة الدفع عند الاستلام" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "حالة الدفع عند الاستلام" }), { target: { value: "accepted" } });
    expect(updateOrderPaymentStatus).not.toHaveBeenCalled();
  });

  it("refreshes recorded order data after a successful payment change", async () => {
    fetchOrder.mockResolvedValueOnce(detailedOrder).mockResolvedValueOnce({ ...detailedOrder,
      paymentStatus: "accepted", updatedAt: "2026-09-21T11:00:00.000Z" });
    updateOrderPaymentStatus.mockResolvedValueOnce(undefined);
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    fireEvent.change(await screen.findByRole("combobox", { name: "حالة الدفع عند الاستلام" }), { target: { value: "accepted" } });
    const refreshed = "2026-09-21T11:00:00.000Z";
    await waitFor(() => expect(screen.getByText(new Date(refreshed).toLocaleString("ar-EG-u-nu-latn", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo"
    }))).toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "حالة الدفع عند الاستلام" })).toHaveValue("accepted");
    expect(screen.queryByText("مهلة مراجعة الدفع عند الاستلام")).not.toBeInTheDocument();
  });

  it("shows an error state instead of hanging when order fetch fails", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
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
