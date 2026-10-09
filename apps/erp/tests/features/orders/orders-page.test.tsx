import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/lib/format";

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

const makeMockState = () => ({ loaded: true, orders: [makeOrder(5, "Capella User", "pending")] });
let mockState: any = makeMockState();

const mockedUseStore = vi.fn((selector: any) => selector(mockState));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
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

// formatMoney may emit a non-breaking space that testing-library normalizes away on the DOM side only, so compare with all whitespace stripped from both sides.
function money(value: number) {
  const expected = formatMoney(value).replace(/\s+/gu, "");
  return (_content: string, element: Element | null) =>
    element?.textContent?.replace(/\s+/gu, "") === expected;
}

const SEARCH = "ابحثي بكود الطلب، الاسم، البريد، أو الهاتف…";
const openPanel = () => fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));

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
    // The filter panel (plain labelled selects + date fields) is the phone layout; force it so the tests can drive the filters.
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a 403 state for unauthorized staff", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(OrdersPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الطلبات.")).toBeInTheDocument();
  });

  it("renders an explicit details action linking to the ERP order detail page", () => {
    render(createElement(OrdersPage));

    const detailsLink = screen.getByRole("link", { name: "التفاصيل" });
    expect(detailsLink).toBeInTheDocument();
    expect(detailsLink).toHaveAttribute("href", "/orders/5");
  });

  it("finds an order by its checkout email, ignoring case and surrounding spaces", () => {
    mockState = { loaded: true, orders: [
      { ...makeOrder(1, "Matching Customer", "pending"), email: "checkout@example.test" },
      makeOrder(2, "Other Customer", "pending")
    ] };
    render(createElement(OrdersPage));

    expect(screen.getByRole("columnheader", { name: "البريد الإلكتروني" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(SEARCH), { target: { value: "  CHECKOUT@EXAMPLE.TEST  " } });

    expect(screen.getByText("Matching Customer")).toBeInTheDocument();
    expect(screen.queryByText("Other Customer")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "checkout@example.test" }))
      .toHaveAttribute("href", "mailto:checkout@example.test");
  });

  it("links staff to paid Paymob checkouts that need reconciliation but have no order", () => {
    render(createElement(OrdersPage));
    expect(screen.getByRole("link", { name: "مدفوعات قيد المراجعة" }))
      .toHaveAttribute("href", "/orders/reconciliation");
  });

  it("renders the payment status in Arabic instead of the raw enum", () => {
    render(createElement(OrdersPage));

    expect(screen.getByText("قيد المراجعة")).toBeInTheDocument();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
  });

  it("shows a Paymob-confirmed order as paid rather than pending", () => {
    mockState = { loaded: true, orders: [{ ...makeOrder(5, "Online Customer", "pending"),
      paymentMethod: "paymob", providerPaymentStatus: "succeeded" }] };
    render(createElement(OrdersPage));
    expect(screen.getByText("مدفوع عبر باي موب")).toBeInTheDocument();
    expect(screen.queryByText("قيد المراجعة")).toBeNull();
  });

  it("formats the order total with the shared price formatter", () => {
    render(createElement(OrdersPage));

    expect(screen.getAllByText(money(213)).length).toBeGreaterThan(0);
    expect(screen.queryByText("213")).not.toBeInTheDocument();
  });

  it("preserves piastres in order totals", () => {
    mockState = { loaded: true, orders: [{ ...makeOrder(5, "Customer", "pending"), totalAmount: 213.75 }] };
    render(createElement(OrdersPage));
    expect(screen.getAllByText(money(213.75)).length).toBeGreaterThan(0);
  });

  it("labels each payment status in Arabic", () => {
    mockState = {
      loaded: true,
      orders: [
        makeOrder(1, "Pending Customer", "pending"),
        makeOrder(2, "Accepted Customer", "accepted"),
        makeOrder(3, "Denied Customer", "denied")
      ]
    };
    render(createElement(OrdersPage));
    expect(screen.getAllByText("قيد المراجعة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("مقبول").length).toBeGreaterThan(0);
    expect(screen.getAllByText("مرفوض").length).toBeGreaterThan(0);
  });

  it("filters by an inclusive local calendar-day range", () => {
    mockState = {
      loaded: true,
      orders: [
        makeOrder(1, "Before Range", "pending", "2026-05-18T12:00:00.000Z"),
        makeOrder(2, "First Boundary", "pending", "2026-05-19T00:00:00.000Z"),
        makeOrder(3, "Last Boundary", "pending", "2026-05-20T20:59:59.000Z"),
        makeOrder(4, "After Range", "pending", "2026-05-20T21:00:00.000Z")
      ]
    };
    render(createElement(OrdersPage));
    openPanel();

    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-05-19" } });
    fireEvent.change(screen.getByLabelText("إلى تاريخ"), { target: { value: "2026-05-20" } });

    expect(screen.queryByText("Before Range")).not.toBeInTheDocument();
    expect(screen.getByText("First Boundary")).toBeInTheDocument();
    expect(screen.getByText("Last Boundary")).toBeInTheDocument();
    expect(screen.queryByText("After Range")).not.toBeInTheDocument();
  });

  it("supports either date bound independently and clearing it", () => {
    mockState = {
      loaded: true,
      orders: [
        makeOrder(1, "Earlier Order", "pending", "2026-05-18T12:00:00.000Z"),
        makeOrder(2, "Later Order", "pending", "2026-05-21T12:00:00.000Z")
      ]
    };
    render(createElement(OrdersPage));
    openPanel();

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
    openPanel();

    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-05-20" } });
    fireEvent.change(screen.getByLabelText("إلى تاريخ"), { target: { value: "2026-05-19" } });

    expect(screen.queryByText("Capella User")).not.toBeInTheDocument();
    expect(screen.getByText("لا توجد طلبات تطابق البحث")).toBeInTheDocument();
  });

  it("combines the date range with the existing payment-status filter", () => {
    mockState = {
      loaded: true,
      orders: [
        makeOrder(1, "Pending In Range", "pending", "2026-05-19T12:00:00.000Z"),
        makeOrder(2, "Accepted In Range", "accepted", "2026-05-19T12:00:00.000Z"),
        makeOrder(3, "Accepted Out Of Range", "accepted", "2026-05-21T12:00:00.000Z")
      ]
    };
    render(createElement(OrdersPage));
    openPanel();

    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-05-19" } });
    fireEvent.change(screen.getByLabelText("إلى تاريخ"), { target: { value: "2026-05-19" } });
    fireEvent.change(screen.getByLabelText("حالة الدفع"), { target: { value: "accepted" } });

    expect(screen.queryByText("Pending In Range")).not.toBeInTheDocument();
    expect(screen.getByText("Accepted In Range")).toBeInTheDocument();
    expect(screen.queryByText("Accepted Out Of Range")).not.toBeInTheDocument();
  });

  it("opens already filtered by the payment status in the link", () => {
    mockState = {
      loaded: true,
      orders: [makeOrder(1, "Pending Customer", "pending"), makeOrder(2, "Accepted Customer", "accepted")]
    };
    window.history.replaceState(null, "", "/orders?payment=pending");
    try {
      render(createElement(OrdersPage));
    } finally {
      window.history.replaceState(null, "", "/");
    }

    expect(screen.getByText("Pending Customer")).toBeInTheDocument();
    expect(screen.queryByText("Accepted Customer")).not.toBeInTheDocument();
  });

  it("ignores an unknown payment status in the link", () => {
    mockState = {
      loaded: true,
      orders: [makeOrder(1, "Pending Customer", "pending"), makeOrder(2, "Accepted Customer", "accepted")]
    };
    window.history.replaceState(null, "", "/orders?payment=bogus");
    try {
      render(createElement(OrdersPage));
    } finally {
      window.history.replaceState(null, "", "/");
    }

    expect(screen.getByText("Accepted Customer")).toBeInTheDocument();
  });

  it("keeps a Paymob-confirmed order out of the pending payment filter", () => {
    mockState = {
      loaded: true,
      orders: [
        makeOrder(1, "Awaiting Customer", "pending"),
        { ...makeOrder(5, "Online Customer", "pending"), paymentMethod: "paymob", providerPaymentStatus: "succeeded" }
      ]
    };
    render(createElement(OrdersPage));
    openPanel();

    fireEvent.change(screen.getByLabelText("حالة الدفع"), { target: { value: "pending" } });

    expect(screen.getByText("Awaiting Customer")).toBeInTheDocument();
    expect(screen.queryByText("Online Customer")).not.toBeInTheDocument();
  });

  it("groups a Paymob-confirmed order under the accepted payment filter", () => {
    mockState = {
      loaded: true,
      orders: [
        makeOrder(1, "Awaiting Customer", "pending"),
        { ...makeOrder(5, "Online Customer", "pending"), paymentMethod: "paymob", providerPaymentStatus: "succeeded" }
      ]
    };
    render(createElement(OrdersPage));
    openPanel();

    fireEvent.change(screen.getByLabelText("حالة الدفع"), { target: { value: "accepted" } });

    expect(screen.getByText("Online Customer")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting Customer")).not.toBeInTheDocument();
  });

  it("filters orders by payment status", () => {
    mockState = {
      loaded: true,
      orders: [
        makeOrder(1, "Pending Customer", "pending"),
        makeOrder(2, "Accepted Customer", "accepted")
      ]
    };
    render(createElement(OrdersPage));

    expect(screen.getByText("2 طلب")).toBeInTheDocument();
    openPanel();

    fireEvent.change(screen.getByLabelText("حالة الدفع"), { target: { value: "accepted" } });

    expect(screen.queryByText("Pending Customer")).not.toBeInTheDocument();
    expect(screen.getByText("Accepted Customer")).toBeInTheDocument();
    expect(screen.getByText("1 طلب")).toBeInTheDocument();
  });

  it.each([
    ["failed", "فشل الدفع عبر باي موب"],
    ["voided", "أُلغي الدفع عبر باي موب"]
  ])("shows a %s Paymob payment as terminal and excludes it from pending", (providerPaymentStatus, label) => {
    mockState = { loaded: true, orders: [{ ...makeOrder(5, "Online Customer", "pending"), paymentMethod: "paymob", providerPaymentStatus }] };
    render(createElement(OrdersPage));
    expect(screen.getByText(label)).toBeInTheDocument();
    openPanel();
    fireEvent.change(screen.getByLabelText("حالة الدفع"), { target: { value: "pending" } });
    expect(screen.queryByText("Online Customer")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("حالة الدفع"), { target: { value: "denied" } });
    expect(screen.getByText("Online Customer")).toBeInTheDocument();
  });
});
