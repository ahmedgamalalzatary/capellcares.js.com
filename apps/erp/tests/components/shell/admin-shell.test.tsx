import { createElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const POLL_MS = 60_000;

const mockedUseAdminAuth = vi.fn();

const { fetchOpenOrderReviewFlags, resolveOrderReviewFlag, toastWarning } = vi.hoisted(() => ({
  fetchOpenOrderReviewFlags: vi.fn(),
  resolveOrderReviewFlag: vi.fn(),
  toastWarning: vi.fn()
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({ fetchOpenOrderReviewFlags, resolveOrderReviewFlag })
}));

vi.mock("sonner", () => ({
  toast: { warning: toastWarning, error: vi.fn(), success: vi.fn() }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/sales"
}));

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

import { AdminShell } from "@/components/shell/admin-shell";

describe("AdminShell", () => {
  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
    fetchOpenOrderReviewFlags.mockReset();
    fetchOpenOrderReviewFlags.mockResolvedValue([]);
    resolveOrderReviewFlag.mockReset();
    resolveOrderReviewFlag.mockResolvedValue(undefined);
    toastWarning.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the staff management navigation item for admin users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    const staffLinks = screen.getAllByText("فريق العمل");
    expect(staffLinks.length).toBeGreaterThan(0);
  });

  it("hides the staff management navigation item for staff users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["sales.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    expect(screen.queryByText("فريق العمل")).not.toBeInTheDocument();
  });

  it("includes a visible sales navigation item", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["dashboard.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    const salesLinks = screen.getAllByText("المبيعات");
    expect(salesLinks.length).toBeGreaterThan(0);
  });

  it("includes a visible collections navigation item", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["dashboard.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    const collectionLinks = screen.getAllByText("المجموعات");
    expect(collectionLinks.length).toBeGreaterThan(0);
  });

  it("shows bulk discounts navigation for staff with bulk discount permission", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["discounts.manage"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });
    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));
    expect(screen.getAllByRole("link", { name: "الخصومات" }).length).toBeGreaterThan(0);
  });

  it("shows reviews navigation only when the reviews module is readable", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["reviews.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    expect(screen.getAllByText("التقييمات").length).toBeGreaterThan(0);
    expect(screen.queryByText("الطلبات")).not.toBeInTheDocument();
  });

  it("shows only authorized module navigation items for staff users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: {
        name: "Staff User",
        email: "staff@capella.test",
        role: "staff",
        permissionKeys: ["dashboard.read", "orders.read", "sales.read"]
      },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    expect(screen.getAllByText("الرئيسية").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الطلبات").length).toBeGreaterThan(0);
    expect(screen.getAllByText("المبيعات").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("المنتجات")).toHaveLength(0);
    expect(screen.queryAllByText("الأقسام")).toHaveLength(0);
    expect(screen.queryAllByText("المحذوفات")).toHaveLength(0);
    expect(screen.queryAllByText("فريق العمل")).toHaveLength(0);
  });

  it("shows the shipping navigation item only for staff with shipping.read", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["shipping.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    expect(screen.getAllByText("الشحن").length).toBeGreaterThan(0);
  });

  it("hides the shipping navigation item for staff without shipping.read", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["orders.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    expect(screen.queryAllByText("الشحن")).toHaveLength(0);
  });

  it("raises a sonner alert for each open order review flag and resolves it when dismissed", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });
    fetchOpenOrderReviewFlags.mockResolvedValue([
      { id: 31, orderId: 5, orderCode: "YMFI-005", flagType: "untouched_paid",
        reason: "Paid order passed the 96-hour deadline with no processing", status: "open",
        customerName: "Checkout Customer", totalAmount: 200,
        orderCreatedAt: "2026-09-21T09:00:00.000Z", flaggedAt: "2026-09-25T09:00:00.000Z" }
    ]);

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    await waitFor(() => expect(toastWarning).toHaveBeenCalled());
    const [title, options] = toastWarning.mock.calls[0];
    expect(title).toBe("طلب مدفوع تجاوز 96 ساعة دون تجهيز");
    expect(options.description).toContain("YMFI-005");
    expect(options.closeButton).toBe(true);
    expect(options.duration).toBe(Infinity);

    options.onDismiss();
    expect(resolveOrderReviewFlag).toHaveBeenCalledWith(31);
  });

  it("never repeats an alert it has already shown and shows nothing without the orders permission", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["orders.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));
    await waitFor(() => expect(fetchOpenOrderReviewFlags).toHaveBeenCalledTimes(1));

    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["sales.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });
    cleanup();
    fetchOpenOrderReviewFlags.mockClear();

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));
    await waitFor(() => expect(fetchOpenOrderReviewFlags).not.toHaveBeenCalled());
  });

  it("re-raises a still-open alert after a failed dismissal", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });
    const openFlag = { id: 44, orderId: 5, orderCode: "YMFI-005", flagType: "untouched_paid",
      reason: "Passed the deadline", status: "open", customerName: "Checkout Customer", totalAmount: 200,
      orderCreatedAt: "2026-09-21T09:00:00.000Z", flaggedAt: "2026-09-25T09:00:00.000Z" };
    fetchOpenOrderReviewFlags.mockResolvedValue([openFlag]);
    resolveOrderReviewFlag.mockRejectedValue(new Error("API 500"));

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));
    await waitFor(() => expect(toastWarning).toHaveBeenCalledTimes(1));

    toastWarning.mock.calls[0][1].onDismiss();
    await waitFor(() => expect(resolveOrderReviewFlag).toHaveBeenCalledWith(44));

    // The dismissal failed, so the still-open alert must come back on the next poll.
    fetchOpenOrderReviewFlags.mockResolvedValue([openFlag]);
    await act(async () => { vi.advanceTimersByTime(POLL_MS); });
    await waitFor(() => expect(toastWarning).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });
});
