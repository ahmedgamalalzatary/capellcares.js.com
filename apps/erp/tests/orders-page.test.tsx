import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrice } from "@capella/shared";

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
  hydrated: true,
  logout: vi.fn()
}));

function makeOrder(
  id: number,
  fullName: string,
  paymentStatus: "pending" | "accepted" | "denied",
  createdAt = "2026-05-19T00:00:00.000Z"
) {
  return {
    id,
    orderCode: `YMFI-00${id}`,
    customerType: "registered",
    customerId: 1,
    fullName,
    phone: "01012345678",
    email: "user@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: null,
    paymentMethod: "cod",
    paymentStatus,
    totalAmount: 213,
    createdAt
  };
}

const makeMockState = () => ({ orders: [makeOrder(5, "Capella User", "pending")] });
let mockState: any = makeMockState();

const mockedUseStore = vi.fn((selector: any) => selector(mockState));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

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
  useStore: (selector: any) => mockedUseStore(selector)
}));

import OrdersPage from "@/app/orders/page";

// formatPrice emits a non-breaking space that testing-library normalizes away on the
// DOM side only, so compare with all whitespace stripped from both sides.
function money(value: number) {
  const expected = formatPrice(value, "ar").replace(/\s+/gu, "");
  return (_content: string, element: Element | null) =>
    element?.textContent?.replace(/\s+/gu, "") === expected;
}
describe("OrdersPage", () => {
  beforeEach(() => {
    cleanup();
    mockState = makeMockState();
    mockedUseAdminAuth.mockReset();
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
      hydrated: true,
      logout: vi.fn()
    });
    mockedUseStore.mockClear();
  });

  it("shows a 403 state without subscribing to order data for unauthorized staff", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(OrdersPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الطلبات.")).toBeInTheDocument();
    expect(mockedUseStore).not.toHaveBeenCalled();
  });

  it("renders an explicit details action linking to the ERP order detail page", () => {
    render(createElement(OrdersPage));

    const detailsLink = screen.getByRole("link", { name: "التفاصيل" });
    expect(detailsLink).toBeInTheDocument();
    expect(detailsLink).toHaveAttribute("href", "/orders/5");
  });

  it("renders the payment status in Arabic instead of the raw enum", () => {
    render(createElement(OrdersPage));

    expect(screen.getByText("قيد المراجعة", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
  });

  it("formats the order total with the shared price formatter", () => {
    render(createElement(OrdersPage));

    expect(screen.getAllByText(money(213)).length).toBe(1);
    expect(screen.queryByText("213")).not.toBeInTheDocument();
  });

  it("gives each payment status its own chip styling", () => {
    mockState = {
      orders: [
        makeOrder(1, "Pending Customer", "pending"),
        makeOrder(2, "Accepted Customer", "accepted"),
        makeOrder(3, "Denied Customer", "denied")
      ]
    };
    render(createElement(OrdersPage));

    expect(screen.getByText("قيد المراجعة", { selector: "span" })).toHaveClass("status--draft");
    expect(screen.getByText("مقبول", { selector: "span" })).toHaveClass("status--active");
    expect(screen.getByText("مرفوض", { selector: "span" })).toHaveClass("status--deleted");
  });

  it("filters by an inclusive local calendar-day range", () => {
    mockState = {
      orders: [
        makeOrder(1, "Before Range", "pending", "2026-05-18T12:00:00.000Z"),
        makeOrder(2, "First Boundary", "pending", "2026-05-19T00:00:00.000Z"),
        makeOrder(3, "Last Boundary", "pending", "2026-05-20T20:59:59.000Z"),
        makeOrder(4, "After Range", "pending", "2026-05-20T21:00:00.000Z")
      ]
    };
    render(createElement(OrdersPage));

    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-05-19" } });
    fireEvent.change(screen.getByLabelText("إلى تاريخ"), { target: { value: "2026-05-20" } });

    expect(screen.queryByText("Before Range")).not.toBeInTheDocument();
    expect(screen.getByText("First Boundary")).toBeInTheDocument();
    expect(screen.getByText("Last Boundary")).toBeInTheDocument();
    expect(screen.queryByText("After Range")).not.toBeInTheDocument();
  });

  it("supports either date bound independently and clearing it", () => {
    mockState = {
      orders: [
        makeOrder(1, "Earlier Order", "pending", "2026-05-18T12:00:00.000Z"),
        makeOrder(2, "Later Order", "pending", "2026-05-21T12:00:00.000Z")
      ]
    };
    render(createElement(OrdersPage));

    const fromDate = screen.getByLabelText("من تاريخ");
    const toDate = screen.getByLabelText("إلى تاريخ");

    fireEvent.change(fromDate, { target: { value: "2026-05-20" } });
    expect(screen.queryByText("Earlier Order")).not.toBeInTheDocument();
    expect(screen.getByText("Later Order")).toBeInTheDocument();

    fireEvent.change(fromDate, { target: { value: "" } });
    fireEvent.change(toDate, { target: { value: "2026-05-20" } });
    expect(screen.getByText("Earlier Order")).toBeInTheDocument();
    expect(screen.queryByText("Later Order")).not.toBeInTheDocument();

    fireEvent.change(toDate, { target: { value: "" } });
    expect(screen.getByText("Earlier Order")).toBeInTheDocument();
    expect(screen.getByText("Later Order")).toBeInTheDocument();
  });

  it("shows the filter-aware empty state for an invalid date range", () => {
    render(createElement(OrdersPage));

    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-05-20" } });
    fireEvent.change(screen.getByLabelText("إلى تاريخ"), { target: { value: "2026-05-19" } });

    expect(screen.queryByText("Capella User")).not.toBeInTheDocument();
    expect(screen.getByText("لا توجد طلبات تطابق البحث أو عوامل التصفية.")).toBeInTheDocument();
  });

  it("combines the date range with the existing payment-status filter", () => {
    mockState = {
      orders: [
        makeOrder(1, "Pending In Range", "pending", "2026-05-19T12:00:00.000Z"),
        makeOrder(2, "Accepted In Range", "accepted", "2026-05-19T12:00:00.000Z"),
        makeOrder(3, "Accepted Out Of Range", "accepted", "2026-05-21T12:00:00.000Z")
      ]
    };
    render(createElement(OrdersPage));

    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-05-19" } });
    fireEvent.change(screen.getByLabelText("إلى تاريخ"), { target: { value: "2026-05-19" } });
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "accepted" } });

    expect(screen.queryByText("Pending In Range")).not.toBeInTheDocument();
    expect(screen.getByText("Accepted In Range")).toBeInTheDocument();
    expect(screen.queryByText("Accepted Out Of Range")).not.toBeInTheDocument();
  });

  it("filters orders by payment status", () => {
    mockState = {
      orders: [
        makeOrder(1, "Pending Customer", "pending"),
        makeOrder(2, "Accepted Customer", "accepted")
      ]
    };
    render(createElement(OrdersPage));

    expect(screen.getByText("2 طلب")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("حالة الدفع"), { target: { value: "accepted" } });

    expect(screen.queryByText("Pending Customer")).not.toBeInTheDocument();
    expect(screen.getByText("Accepted Customer")).toBeInTheDocument();
    expect(screen.getByText("1 طلب")).toBeInTheDocument();
  });
});
