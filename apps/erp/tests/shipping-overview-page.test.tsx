import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

const mockedUseAdminAuth = vi.fn();
const fetchShippingOverview = vi.hoisted(() => vi.fn());
const runBulkShippingAction = vi.hoisted(() => vi.fn());

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, title }: { children: React.ReactNode; title?: string }) =>
    createElement("div", { "data-title": title }, children)
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    fetchShippingOverview,
    runBulkShippingAction,
    fetchOpenOrderReviewFlags: vi.fn().mockResolvedValue([])
  })
}));

const adminUser = { name: "Admin", email: "a@capella.test", role: "admin" as const, permissionKeys: [] as string[] };
const shippingStaff = { name: "Staff", email: "s@capella.test", role: "staff" as const, permissionKeys: ["shipping.read"] };
const plainStaff = { name: "Staff", email: "s@capella.test", role: "staff" as const, permissionKeys: ["orders.read"] };

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
    mockedUseAdminAuth.mockReset();
    fetchShippingOverview.mockReset();
    runBulkShippingAction.mockReset();
  });
  afterEach(() => cleanup());

  it("renders shipment rows with carrier and manual states for authorized staff", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [rowBase], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: shippingStaff, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByText("CAP-007")).toBeInTheDocument();
    expect(screen.getByText("5108002")).toBeInTheDocument();
  });

  it("bulk selection includes outgoing orders only and keeps individual failure results visible", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [rowBase, { ...rowBase, orderId: 8, orderCode: "CAP-008" },
      { ...rowBase, orderId: 9, orderCode: "CAP-009", kind: "return", shipmentId: 8 }], nextCursor: null });
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
    fetchShippingOverview.mockResolvedValue({ items: [rowBase], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: shippingStaff, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import("@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("إجراء الشحن")).not.toBeInTheDocument();
  });

  it("denies the shipping page for staff without shipping.read", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: plainStaff, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByText("غير مصرح")).toBeInTheDocument();
    expect(fetchShippingOverview).not.toHaveBeenCalled();
  });

  it("filters rows into the needs-attention section only when flagged or failing", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [
      rowBase,
      { ...rowBase, orderId: 8, orderCode: "CAP-008", needsAttention: true, openFlagTypes: ["address_review"] }
    ], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    fireEvent.click(screen.getByRole("tab", { name: "تحتاج انتباه" }));
    expect(screen.getByText("CAP-008")).toBeInTheDocument();
    expect(screen.queryByText("CAP-007")).not.toBeInTheDocument();
  });

  it("shows the returns and exchanges section rows", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [
      rowBase,
      { ...rowBase, orderId: 9, orderCode: "CAP-009", kind: "return" as const, shipmentId: 4, trackingNumber: "R-9001" }
    ], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    fireEvent.click(await screen.findByRole("tab", { name: "المرتجعات والاستبدالات" }));
    expect(screen.getByText("CAP-009")).toBeInTheDocument();
    expect(screen.queryByText("CAP-007")).not.toBeInTheDocument();
  });

  it("searches by order code, customer and tracking number", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [
      rowBase,
      { ...rowBase, orderId: 9, orderCode: "CAP-009", customerName: "شخص آخر", trackingNumber: null, shipmentId: null }
    ], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    fireEvent.change(screen.getByRole("textbox", { name: "بحث في الشحنات" }), { target: { value: "5108002" } });
    expect(screen.getByText("CAP-007")).toBeInTheDocument();
    expect(screen.queryByText("CAP-009")).not.toBeInTheDocument();
  });

  it("shows a load error state when the API call fails", async () => {
    fetchShippingOverview.mockRejectedValue(new Error("network"));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("waits for authentication hydration before fetching", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [rowBase], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: false, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    const view = render(createElement(Page));
    expect(fetchShippingOverview).not.toHaveBeenCalled();
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    view.rerender(createElement(Page));
    expect(await screen.findByText("CAP-007")).toBeInTheDocument();
    expect(fetchShippingOverview).toHaveBeenCalledTimes(1);
  });

  it("shows local cancellation for cancelled unsent orders instead of awaiting creation", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [{ ...rowBase, trackingNumber: null, shipmentId: null, carrierState: null, cancellationStatus: "cancelled" as const }], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect((await screen.findAllByText("تم الإلغاء")).length).toBeGreaterThan(0);
    expect(screen.getByText("بانتظار الإنشاء")).toBeInTheDocument();
  });

  it("shows the carrier state and the local cancellation independently", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [{ ...rowBase, carrierState: "in_transit" as const, cancellationStatus: "pending" as const }], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect((await screen.findAllByText("في الطريق")).length).toBeGreaterThan(0);
    expect(screen.getByText("الإلغاء قيد التأكيد")).toBeInTheDocument();
  });

  it("matches the cancelled filter only for unsent orders with a local cancellation", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [
      { ...rowBase, orderCode: "CAP-007", carrierState: "in_transit" as const, cancellationStatus: "cancelled" as const },
      { ...rowBase, orderId: 8, shipmentId: null, orderCode: "CAP-008", carrierState: null, cancellationStatus: "cancelled" as const }
    ], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    fireEvent.change(screen.getByRole("combobox", { name: "حالة الناقل" }), { target: { value: "cancelled" } });
    expect(screen.queryByText("CAP-007")).not.toBeInTheDocument();
    expect(screen.getByText("CAP-008")).toBeInTheDocument();
  });

  it("loads more pages through the load-more button", async () => {
    const rowB = { ...rowBase, orderId: 8, orderCode: "CAP-008" };
    fetchShippingOverview.mockImplementation((cursor?: string) => Promise.resolve(cursor
      ? { items: [rowB], nextCursor: null }
      : { items: [rowBase], nextCursor: "2026-09-20T10:00:00.000Z|7" }));
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByText("CAP-007")).toBeInTheDocument();
    expect(screen.queryByText("CAP-008")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تحميل المزيد" }));
    expect(await screen.findByText("CAP-008")).toBeInTheDocument();
    expect(fetchShippingOverview).toHaveBeenLastCalledWith("2026-09-20T10:00:00.000Z|7");
  });

  it("displays the verified provider payment status for refunded paymob orders", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [{
      ...rowBase, paymentMethod: "paymob" as const, paymentStatus: "accepted" as const,
      providerPaymentStatus: "partially_refunded" as const
    }], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    expect(await screen.findByText("مسترد جزئيًا عبر باي موب")).toBeInTheDocument();
  });

  it("shows the carrier-reported size next to the Capella size", async () => {
    fetchShippingOverview.mockResolvedValue({ items: [{ ...rowBase, size: "small" as const, carrierSize: "MEDIUM" }], nextCursor: null });
    mockedUseAdminAuth.mockReturnValue({ user: adminUser, hydrated: true, logout: vi.fn() });
    const { default: Page } = await import(/* @vite-ignore */ "@/app/shipping/page");
    render(createElement(Page));
    await screen.findByText("CAP-007");
    expect(screen.getByText("بوسطة: MEDIUM")).toBeInTheDocument();
  });
});
