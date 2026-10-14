import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney, localDayEnd, localDayStart } from "@/lib/format";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
  hydrated: true,
  logout: vi.fn()
}));

function makeOrder(id: number, fullName: string, paymentStatus: "pending" | "accepted" | "denied", overrides: Record<string, unknown> = {}) {
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
    providerPaymentStatus: null,
    totalAmount: 213,
    createdAt: "2026-05-19T00:00:00.000Z",
    ...overrides
  };
}

function serverPage(items: unknown[], total = items.length) {
  return { items, pagination: { page: 1, pageSize: 20, total, totalPages: Math.ceil(total / 20) } };
}

vi.mock("@/lib/api/client", () => ({ api: { get: apiGet } }));

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

import OrdersPage from "@/app/orders/page";

// formatMoney may emit a non-breaking space that testing-library normalizes away on the DOM side only, so compare with all whitespace stripped from both sides.
function money(value: number) {
  const expected = formatMoney(value).replace(/\s+/gu, "");
  return (_content: string, element: Element | null) =>
    element?.textContent?.replace(/\s+/gu, "") === expected;
}

const SEARCH = "ابحثي بكود الطلب، الاسم، البريد، أو الهاتف…";
const openPanel = () => fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
const lastRequest = () => String(apiGet.mock.calls.at(-1)?.[0] ?? "");
const requestParams = () => new URLSearchParams(lastRequest().split("?")[1]);

async function renderWith(items: unknown[], total?: number) {
  apiGet.mockResolvedValue(serverPage(items, total));
  render(createElement(OrdersPage));
  await waitFor(() => expect(apiGet).toHaveBeenCalled());
}

describe("OrdersPage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    mockedUseAdminAuth.mockReset();
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read", "orders.update_payment_status"] },
      hydrated: true,
      logout: vi.fn()
    });
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

  it("shows a 403 state for unauthorized staff and never asks for orders", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(OrdersPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الطلبات.")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("asks the server for the first page, newest first", async () => {
    await renderWith([makeOrder(5, "Capella User", "pending")]);
    expect(lastRequest()).toBe("/api/erp/orders?page=1&pageSize=20&pages=1");
  });

  it("renders an explicit details action linking to the ERP order detail page", async () => {
    await renderWith([makeOrder(5, "Capella User", "pending")]);
    expect(await screen.findByRole("link", { name: "التفاصيل" })).toHaveAttribute("href", "/orders/5");
  });

  it("links the customer email", async () => {
    await renderWith([makeOrder(1, "Matching Customer", "pending", { email: "checkout@example.test" })]);
    expect(await screen.findByRole("link", { name: "checkout@example.test" })).toHaveAttribute("href", "mailto:checkout@example.test");
  });

  it("labels each payment state in Arabic, Paymob orders by the provider's status", async () => {
    await renderWith([
      makeOrder(1, "Pending Customer", "pending"),
      makeOrder(2, "Accepted Customer", "accepted"),
      makeOrder(3, "Denied Customer", "denied"),
      makeOrder(4, "Online Customer", "pending", { paymentMethod: "paymob", providerPaymentStatus: "succeeded" }),
      makeOrder(6, "Failed Customer", "pending", { paymentMethod: "paymob", providerPaymentStatus: "failed" }),
      makeOrder(7, "Voided Customer", "pending", { paymentMethod: "paymob", providerPaymentStatus: "voided" })
    ]);
    expect(await screen.findByText("قيد المراجعة")).toBeInTheDocument();
    expect(screen.getByText("مقبول")).toBeInTheDocument();
    expect(screen.getByText("مرفوض")).toBeInTheDocument();
    expect(screen.getByText("مدفوع عبر باي موب")).toBeInTheDocument();
    expect(screen.getByText("فشل الدفع عبر باي موب")).toBeInTheDocument();
    expect(screen.getByText("أُلغي الدفع عبر باي موب")).toBeInTheDocument();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
  });

  it("formats order totals with the shared price formatter, keeping piastres", async () => {
    await renderWith([makeOrder(5, "Customer", "pending", { totalAmount: 213.75 })]);
    expect((await screen.findAllByText(money(213.75))).length).toBeGreaterThan(0);
  });

  it("counts every matching order, not just the page", async () => {
    await renderWith([makeOrder(5, "Customer", "pending")], 45);
    expect(await screen.findByText("45 طلب")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "التنقل بين الصفحات" })).toBeInTheDocument();
  });

  it("searches on the server once typing pauses, starting from page 1", async () => {
    window.history.replaceState(null, "", "/orders?page=2");
    await renderWith([makeOrder(5, "Customer", "pending")], 45);
    fireEvent.change(screen.getByPlaceholderText(SEARCH), { target: { value: "  CHECKOUT@EXAMPLE.TEST  " } });
    await waitFor(() => expect(requestParams().get("q")).toBe("CHECKOUT@EXAMPLE.TEST"));
    expect(requestParams().get("page")).toBe("1");
  });

  it("sends the payment filter to the server", async () => {
    await renderWith([makeOrder(5, "Customer", "pending")]);
    openPanel();
    fireEvent.change(screen.getByLabelText("حالة الدفع"), { target: { value: "accepted" } });
    await waitFor(() => expect(requestParams().get("payment")).toBe("accepted"));
  });

  it("sends the date range as the viewer's own day bounds", async () => {
    await renderWith([makeOrder(5, "Customer", "pending")]);
    openPanel();
    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-05-19" } });
    fireEvent.change(screen.getByLabelText("إلى تاريخ"), { target: { value: "2026-05-20" } });
    await waitFor(() => expect(requestParams().get("to")).toBe(localDayEnd("2026-05-20")));
    expect(requestParams().get("from")).toBe(localDayStart("2026-05-19"));

    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "" } });
    await waitFor(() => expect(requestParams().has("from")).toBe(false));
  });

  it("sends the sort column and direction", async () => {
    await renderWith([makeOrder(5, "Customer", "pending")]);
    fireEvent.click(screen.getByRole("button", { name: /الإجمالي/ }));
    await waitFor(() => expect(requestParams().get("sort")).toBe("total"));
    expect(requestParams().get("dir")).toBe("asc");
  });

  it("opens already filtered by the payment status in the link", async () => {
    window.history.replaceState(null, "", "/orders?payment=pending");
    await renderWith([makeOrder(1, "Pending Customer", "pending")]);
    expect(requestParams().get("payment")).toBe("pending");
  });

  it("ignores an unknown payment status in the link", async () => {
    window.history.replaceState(null, "", "/orders?payment=bogus");
    await renderWith([makeOrder(1, "Pending Customer", "pending")]);
    expect(requestParams().has("payment")).toBe(false);
  });

  it("tells an empty store apart from an empty search", async () => {
    await renderWith([]);
    expect(await screen.findByText("لا توجد طلبات بعد")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(SEARCH), { target: { value: "nobody" } });
    expect(await screen.findByText("لا توجد طلبات تطابق البحث")).toBeInTheDocument();
  });

  it("offers a retry when the page fails to load", async () => {
    apiGet.mockRejectedValueOnce(new Error("down")).mockResolvedValue(serverPage([makeOrder(5, "Back Again", "pending")]));
    render(createElement(OrdersPage));
    fireEvent.click(await screen.findByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByText("Back Again")).toBeInTheDocument();
  });
});
