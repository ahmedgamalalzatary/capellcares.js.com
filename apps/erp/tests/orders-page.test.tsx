import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrice } from "@capella/shared";

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
  hydrated: true,
  logout: vi.fn()
}));

function makeOrder(id: number, fullName: string, paymentStatus: "pending" | "accepted" | "denied") {
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
    createdAt: "2026-05-19T00:00:00.000Z"
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
