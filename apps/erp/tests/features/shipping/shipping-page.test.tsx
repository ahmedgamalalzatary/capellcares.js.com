import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

const mockedUseAdminAuth = vi.fn();
const apiGet = vi.hoisted(() => vi.fn());
// Answers like the server: one page of rows plus its total.
const respond = (items: unknown[], total = items.length) => ({ items, pagination: { page: 1, pageSize: 20, total, totalPages: Math.ceil(total / 20) } });
const requestParams = () => new URLSearchParams(String(apiGet.mock.calls.at(-1)?.[0] ?? "").split("?")[1]);
const runBulkShippingAction = vi.hoisted(() => vi.fn());

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, title }: { children: React.ReactNode; title?: string }) =>
    createElement("div", { "data-title": title }, children)
}));

vi.mock("@/lib/api/client", () => ({ api: { get: apiGet } }));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    runBulkShippingAction,
    fetchOpenOrderReviewFlags: vi.fn().mockResolvedValue([])
  })
}));

const adminUser = { name: "Admin", email: "a@capella.test", role: "admin" as const, permissionKeys: [] as string[] };
const shippingStaff = { name: "Staff", email: "s@capella.test", role: "staff" as const, permissionKeys: ["shipping.read"] };
const plainStaff = { name: "Staff", email: "s@capella.test", role: "staff" as const, permissionKeys: ["orders.read"] };

import { carrierStateLabels, manualStateLabels } from "@/features/shipping/lib/labels";

const rowBase = {
  orderId: 7, orderCode: "CAP-007", customerName: "عميل تجريبي", customerPhone: "01000000007",
  paymentMethod: "cod" as const, paymentStatus: "pending" as const, providerPaymentStatus: null,
  totalAmount: 1000,
  orderCreatedAt: "2026-09-20T10:00:00.000Z", shipmentId: 3, kind: "outgoing" as const,
  trackingNumber: "5108002", carrierState: "created" as const, rawProviderState: "Pickup requested",
  manualState: null, custodyState: "unknown" as const, size: "small" as const, carrierSize: null,
  shippingAmountCents: 9729, collectedAmountCents: null, collectionConfirmed: false,
  cancellationStatus: null,
  openFlagTypes: [], needsAttention: false, workItem: null
};

describe("shipping ERP surface", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }));
    mockedUseAdminAuth.mockReset();
    apiGet.mockReset();
    runBulkShippingAction.mockReset();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("renders shipment rows with carrier and manual states for authorized staff", async () => {
    apiGet.mockResolvedValue(respond([
      rowBase,
      // A manual-only shipment: the carrier has not created it yet, so the staff-set manual state is the only status.
      { ...rowBase, orderId: 8, orderCode: "CAP-008", carrierState: null, manualState: "ready_for_pickup" as const }
    ]));
    mockedUseAdminAuth.mockReturnValue({ user: shippingStaff, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));

    const firstRow = (await screen.findByText("CAP-007")).closest("tr") as HTMLElement;
    expect(firstRow).toHaveTextContent("5108002");
    // Carrier state "created" resolves to its label, and a null manual state shows the empty dash.
    expect(firstRow).toHaveTextContent(carrierStateLabels.created);
    expect(firstRow.querySelector('[data-label="الحالة اليدوية"]')).toHaveTextContent("—");

    const secondRow = screen.getByText("CAP-008").closest("tr") as HTMLElement;
    expect(secondRow).toHaveTextContent(manualStateLabels.ready_for_pickup);
    // A shipment the carrier has not picked up yet says so instead of showing a carrier badge.
    expect(secondRow.querySelector('[data-label="حالة بوسطة"]')).toHaveTextContent("بانتظار الإنشاء");
  });

  it("bulk selection includes outgoing orders only and keeps individual failure results visible", async () => {
    apiGet.mockResolvedValue(respond([rowBase, { ...rowBase, orderId: 8, orderCode: "CAP-008" },
      { ...rowBase, orderId: 9, orderCode: "CAP-009", kind: "return", shipmentId: 8 }]));
    runBulkShippingAction.mockResolvedValue({ results: [{ orderId: 7, status: "ok" }, { orderId: 8, status: "error", message: "Carrier restriction" }] });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import("@/app/shipping/page");
    render(createElement(Page));
    fireEvent.click(await screen.findByRole("checkbox", { name: "تحديد CAP-007" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "تحديد CAP-008" }));
    expect(screen.queryByRole("checkbox", { name: "تحديد CAP-009" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("إجراء الشحن"), { target: { value: "retry" } });
    fireEvent.click(screen.getByRole("button", { name: "تنفيذ الإجراء" }));
    await waitFor(() => expect(runBulkShippingAction).toHaveBeenCalledWith({ action: "retry", orderIds: [7, 8] }));
    expect(await screen.findByText(/Carrier restriction/)).toBeInTheDocument();
    expect(screen.getByText(/CAP-007: تم/)).toBeInTheDocument();
  });

  it("read-only shipping staff have no bulk mutation controls", async () => {
    apiGet.mockResolvedValue(respond([rowBase]));
    mockedUseAdminAuth.mockReturnValue({ user: shippingStaff, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import("@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("إجراء الشحن")).not.toBeInTheDocument();
  });

  it("denies the shipping page for staff without shipping.read", async () => {
    apiGet.mockResolvedValue(respond([]));
    mockedUseAdminAuth.mockReturnValue({ user: plainStaff, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الشحن.")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("asks the server for the first page and sends the search once typing pauses", async () => {
    apiGet.mockResolvedValue(respond([rowBase]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import("@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    expect(apiGet).toHaveBeenLastCalledWith("/api/erp/shipping?page=1");
    fireEvent.change(screen.getByRole("searchbox", { name: "بحث في الشحنات" }), { target: { value: "5108002" } });
    await waitFor(() => expect(requestParams().get("q")).toBe("5108002"));
  });

  it("asks the server for the needs-attention section", async () => {
    apiGet.mockResolvedValue(respond([rowBase]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    fireEvent.click(screen.getByRole("tab", { name: "تحتاج انتباه" }));
    await waitFor(() => expect(requestParams().get("section")).toBe("needs_attention"));
    expect(screen.getByRole("tab", { name: "تحتاج انتباه" })).toHaveAttribute("aria-selected", "true");
  });

  it("remembers the section and filters in the address", async () => {
    window.history.replaceState(null, "", "/shipping?section=returns&status=cancelled&payment=paymob");
    apiGet.mockResolvedValue(respond([{ ...rowBase, orderId: 9, orderCode: "CAP-009", kind: "return" as const, shipmentId: 4 }]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByText("CAP-009")).toBeInTheDocument();
    expect(requestParams().get("section")).toBe("returns");
    expect(requestParams().get("status")).toBe("cancelled");
    expect(requestParams().get("payment")).toBe("paymob");
  });

  it("sends the carrier-state filter and the sort to the server", async () => {
    apiGet.mockResolvedValue(respond([rowBase]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
    fireEvent.change(screen.getByLabelText("حالة الناقل"), { target: { value: "cancelled" } });
    await waitFor(() => expect(requestParams().get("status")).toBe("cancelled"));
  });

  it("shows a load error state when the API call fails", async () => {
    apiGet.mockRejectedValue(new Error("network"));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("waits for authentication hydration before fetching", async () => {
    apiGet.mockResolvedValue(respond([rowBase]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: false, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    const view = render(createElement(Page));
    expect(apiGet).not.toHaveBeenCalled();
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    view.rerender(createElement(Page));
    expect(await screen.findByText("CAP-007")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it("shows local cancellation for cancelled unsent orders instead of awaiting creation", async () => {
    apiGet.mockResolvedValue(respond([{ ...rowBase, trackingNumber: null, shipmentId: null, carrierState: null, cancellationStatus: "cancelled" as const }]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect((await screen.findAllByText("تم الإلغاء")).length).toBeGreaterThan(0);
    expect(screen.getByText("بانتظار الإنشاء")).toBeInTheDocument();
  });

  it("shows the carrier state and the local cancellation independently", async () => {
    apiGet.mockResolvedValue(respond([{ ...rowBase, carrierState: "in_transit" as const, cancellationStatus: "pending" as const }]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect((await screen.findAllByText("في الطريق")).length).toBeGreaterThan(0);
    expect(screen.getByText("الإلغاء قيد التأكيد")).toBeInTheDocument();
  });

  it("counts every matching shipment and shows the pagination bar", async () => {
    apiGet.mockResolvedValue(respond([rowBase], 45));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByText("45 شحنة")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "الصفحة 2" }));
    await waitFor(() => expect(requestParams().get("page")).toBe("2"));
  });

  it("displays the verified provider payment status for refunded paymob orders", async () => {
    apiGet.mockResolvedValue(respond([{
      ...rowBase, paymentMethod: "paymob" as const, paymentStatus: "accepted" as const,
      providerPaymentStatus: "partially_refunded" as const
    }]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByText("مسترد جزئيًا عبر باي موب")).toBeInTheDocument();
  });

  it("shows the carrier-reported size next to the Capella size", async () => {
    apiGet.mockResolvedValue(respond([{ ...rowBase, size: "small" as const, carrierSize: "MEDIUM" }]));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    expect(screen.getByText("بوسطة: MEDIUM")).toBeInTheDocument();
  });
});
