import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchOrder = vi.fn();
const updateOrderPaymentStatus = vi.fn();
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
    updateOrderPaymentStatus
  })
}));

import { OrderDetailsView } from "@/components/orders/order-details-view";

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
});

describe("OrderDetailsPage", () => {
  it("shows verified collection independently of a contradictory current carrier state", async () => {
    fetchOrder.mockResolvedValueOnce({ ...detailedOrder, paymentStatus: "accepted", shippingQuoteId: "quote",
      shipping: { manualState: null, carrierState: "in_transit", rawProviderCode: 41, rawProviderType: "SEND",
        custodyState: "carrier", collection: { confirmed: true, amountCents: 20000 },
        processing: { startedAtMs: 1760000000123, pickupAtMs: 1760000000123, addressBlockedAtMs: null, untouchedExpiryApplies: false }, history: [] } });
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    const region = within(await screen.findByRole("region", { name: "حالات الشحن" }));
    expect(region.getByText("في الطريق (بوسطة)")).toBeInTheDocument();
    expect(region.getByText("مع شركة الشحن")).toBeInTheDocument();
    expect(region.getByText("التحصيل مؤكد")).toBeInTheDocument();
    expect(region.getByText(/٢٠٠/)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("accepted");
  });
  it("shows staff and Bosta states separately while retaining independent payment, custody and collection evidence", async () => {
    fetchOrder.mockResolvedValueOnce({ ...detailedOrder, shippingQuoteId: "quote", shippingAmountCents: 9700,
      shipping: { manualState: "delivered", carrierState: "in_transit", rawProviderCode: 41, rawProviderType: "SEND",
        custodyState: "carrier", collection: { confirmed: false, amountCents: null },
        processing: { startedAtMs: 1760000000123, pickupAtMs: 1760000000456, addressBlockedAtMs: null, untouchedExpiryApplies: false },
        history: [{ id: 1, state: "delivered", actorType: "staff", actorId: 7, atMs: 1760000000123, reason: "Staff report" }] } });
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    const region = within(await screen.findByRole("region", { name: "حالات الشحن" }));
    expect(region.getByText("تم التسليم (الموظفة)")).toBeInTheDocument();
    expect(region.getByText("في الطريق (بوسطة)")).toBeInTheDocument();
    expect(region.getByText("مع شركة الشحن")).toBeInTheDocument();
    expect(region.getByText("التحصيل غير مؤكد")).toBeInTheDocument();
    expect(region.getByText("Staff report")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("pending");
    expect(within(screen.getByRole("combobox")).getByRole("option", { name: "مقبول" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "accepted" } });
    expect(updateOrderPaymentStatus).not.toHaveBeenCalled();
    expect(screen.queryByText("مهلة مراجعة الدفع عند الاستلام")).not.toBeInTheDocument();
  });
  it("shows the original deadline again for pre-pickup address trouble and never treats a return as approved restocking", async () => {
    fetchOrder.mockResolvedValueOnce({ ...detailedOrder, shippingQuoteId: "quote",
      shipping: { manualState: "preparing", carrierState: "returned", rawProviderCode: 46, rawProviderType: "RTO",
        custodyState: "warehouse_uninspected", collection: { confirmed: false, amountCents: null },
        processing: { startedAtMs: 1760000000123, pickupAtMs: null, addressBlockedAtMs: 1760000000456, untouchedExpiryApplies: true }, history: [] } });
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    const region = within(await screen.findByRole("region", { name: "حالات الشحن" }));
    expect(region.getByText("راجع للمخزن؛ بانتظار الفحص")).toBeInTheDocument();
    expect(region.getByText("مشكلة عنوان قبل الاستلام؛ المهلة الأصلية قائمة")).toBeInTheDocument();
    expect(screen.getByText("مهلة مراجعة الدفع عند الاستلام")).toBeInTheDocument();
  });
  it("shows the checkout contact, complete delivery instructions, and recorded dates", async () => {
    fetchOrder.mockResolvedValueOnce(detailedOrder);
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    expect(await screen.findByRole("link", { name: "checkout@example.test" }))
      .toHaveAttribute("href", "mailto:checkout@example.test");
    expect(screen.getByRole("link", { name: "01012345678" })).toHaveAttribute("href", "tel:01012345678");
    expect(screen.getByText(detailedOrder.buildingApartment)).toBeInTheDocument();
    expect(screen.getByText(/Call before delivery/)).toHaveTextContent("After 6 pm");
    expect(screen.getByText("ضيف")).toBeInTheDocument();
    for (const value of [detailedOrder.createdAt, detailedOrder.updatedAt, detailedOrder.codExpiresAt]) {
      expect(document.querySelector(`time[datetime="${value}"]`)).not.toBeNull();
    }
    expect(screen.getByText("منتج")).toBeInTheDocument();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
  });

  it("shows Paymob references and converts refunded minor units without reducing the original total", async () => {
    fetchOrder.mockResolvedValueOnce({ ...detailedOrder, paymentMethod: "paymob", codExpiresAt: null,
      providerPaymentStatus: "partially_refunded", refundedAmountCents: 5025,
      payment: { environment: "test", paymentMethod: "card", attemptNumber: 2,
        paymobOrderId: "987654", paymobTransactionId: "123456789", merchantReference: "capella_reference",
        integrationId: 5885253, createdAt: "2026-09-21T08:58:00.000Z" } });
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));

    expect(await screen.findByText("123456789")).toBeInTheDocument();
    expect(screen.getByText("987654")).toBeInTheDocument();
    expect(screen.getByText("capella_reference")).toBeInTheDocument();
    expect(screen.getByText("تجريبي")).toBeInTheDocument();
    expect(screen.getByText("بطاقة بنكية")).toBeInTheDocument();
    const summary = within(screen.getByRole("region", { name: "ملخص المبالغ" }));
    expect(summary.getByText(/٥٠٫٢٥/)).toBeInTheDocument();
    expect(summary.getByText(/١٤٩٫٧٥/)).toBeInTheDocument();
    expect(summary.getByText(/٢٠٠/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
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
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("prevents overlapping payment changes and preserves the saved status when an update fails", async () => {
    fetchOrder.mockResolvedValueOnce(detailedOrder);
    let rejectUpdate!: (error: Error) => void;
    updateOrderPaymentStatus.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectUpdate = reject; }));
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: "accepted" } });
    expect(select).toBeDisabled();
    await act(async () => { rejectUpdate(new Error("Request failed")); });
    expect(screen.getByRole("alert")).toHaveTextContent("تعذر تحديث حالة الدفع");
    expect(select).toHaveValue("pending");
    expect(select).toBeEnabled();
  });
  it("shows provider-confirmed Paymob payment separately and blocks manual payment changes", async () => {
    fetchOrder.mockResolvedValueOnce({ ...detailedOrder, id: 9, orderCode: "PAY-009", fullName: "Online Customer",
      phone: "01012345678", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1",
      paymentMethod: "paymob", paymentStatus: "pending", providerPaymentStatus: "succeeded",
      totalAmount: 35, createdAt: "2026-09-11T12:00:00.000Z", items: [] });
    render(createElement(OrderDetailsView, { orderId: 9, crumbLabel: "9" }));
    expect(await screen.findByText("PAY-009")).toBeInTheDocument();
    expect(screen.getByText("مدفوع عبر باي موب")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(updateOrderPaymentStatus).not.toHaveBeenCalled();
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
    expect(await screen.findByRole("combobox")).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "accepted" } });
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

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "accepted" } });

    await waitFor(() => expect(updateOrderPaymentStatus).toHaveBeenCalledWith(5, "accepted"));
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("accepted"));
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
    expect(await screen.findByRole("combobox")).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "accepted" } });
    expect(updateOrderPaymentStatus).not.toHaveBeenCalled();
  });

  it("refreshes recorded order data after a successful payment change", async () => {
    fetchOrder.mockResolvedValueOnce(detailedOrder).mockResolvedValueOnce({ ...detailedOrder,
      paymentStatus: "accepted", updatedAt: "2026-09-21T11:00:00.000Z" });
    updateOrderPaymentStatus.mockResolvedValueOnce(undefined);
    render(createElement(OrderDetailsView, { orderId: 5, crumbLabel: "5" }));
    fireEvent.change(await screen.findByRole("combobox"), { target: { value: "accepted" } });
    await waitFor(() => expect(document.querySelector('time[datetime="2026-09-21T11:00:00.000Z"]')).not.toBeNull());
    expect(screen.getByRole("combobox")).toHaveValue("accepted");
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
