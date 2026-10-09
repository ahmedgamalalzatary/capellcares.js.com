import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/lib/format";

const fetchPaymobReconciliation = vi.fn();
const fetchOpenOrderReviewFlags = vi.fn();
const mockedUseAdminAuth = vi.fn();
let mockState: any;

vi.mock("@/components/providers/admin-auth", () => ({ useAdminAuth: () => mockedUseAdminAuth() }));
vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions, description }: any) => createElement("div", null, description, actions, children)
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));
vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(mockState),
  getStore: () => ({ fetchPaymobReconciliation, fetchOpenOrderReviewFlags })
}));

import DashboardPage from "@/app/dashboard/page";

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString();
const old = new Date(2026, 0, 1).toISOString();

function product(id: number, ar: string, en: string, variants: any[]) {
  return {
    id, sku: `SKU-${id}`, slug: `p-${id}`, name: { ar, en }, description: { ar: "وصف", en: "Description" },
    ingredients: { ar: "", en: "" }, howToUse: { ar: "", en: "" }, warnings: { ar: "", en: "" }, keywords: ["k"],
    buyingPrice: 10, imagePath: "/p.jpg", status: "active", isNew: false, isBestseller: false, categoryId: 1,
    variants: variants.map((variant) => ({ productId: id, price: 100, ...variant })), createdAt: old, updatedAt: old, deletedAt: null
  };
}

function order(id: number, paymentStatus: "pending" | "accepted") {
  return {
    id, orderCode: `O-${id}`, customerType: "guest", customerId: null, fullName: "Customer", phone: "01000000000",
    email: "c@example.com", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street", buildingApartment: "1",
    notes: null, paymentMethod: "cod", paymentStatus, providerPaymentStatus: null, refundedAmountCents: 0,
    totalAmount: 100, createdAt: at(9, 9)
  };
}

const sale = (orderId: number, createdAt: string, totalAmount: number, items: Array<[number, number, number]>) => ({
  orderId, orderCode: `S-${orderId}`, paymentStatus: "accepted", totalAmount, createdAt,
  unitsSold: items.reduce((sum, [, , units]) => sum + units, 0),
  items: items.map(([productId, variantId, unitsSold]) => ({ label: `P${productId} / size`, productId, variantId, unitsSold }))
});

function makeState() {
  return {
    loaded: true,
    products: [
      product(1, "سيروم فيتامين سي", "Vitamin C Serum", [{ id: 10, size: "30ml", stock: 0 }, { id: 11, size: "50ml", stock: 20 }]),
      product(2, "كريم الليل", "", [{ id: 20, size: "50ml", stock: 3,
        discount: { type: "percentage", value: 10, startsAt: at(1, 0), endsAt: at(11, 20), status: "active" } }]),
      product(3, "لوشن الجسم", "Body Lotion", [{ id: 30, size: "200ml", stock: 12 }])
    ],
    offers: [],
    collections: [],
    orders: [order(1, "pending"), order(2, "accepted")],
    sales: {
      summary: { totalOrders: 3, totalUnitsSold: 6, totalRevenue: 600 },
      productTotals: [],
      variantTotals: [],
      orders: [
        sale(1, at(9, 10), 300, [[1, 11, 3]]),
        sale(2, at(8, 13), 100, [[1, 11, 1]]),
        sale(3, at(5, 12), 200, [[2, 20, 2]])
      ]
    }
  };
}

const admin = { name: "أحمد", email: "admin@capella.test", role: "admin", permissionKeys: [] };
const staff = (...permissionKeys: string[]) => ({ name: "سارة", email: "staff@capella.test", role: "staff", permissionKeys });

// formatMoney may emit a non-breaking space that testing-library normalizes away on the DOM side only, so compare with all whitespace stripped.
function money(value: number) {
  const expected = formatMoney(value).replace(/\s+/gu, "");
  return (_content: string, element: Element | null) => element?.textContent?.replace(/\s+/gu, "") === expected;
}

const region = (name: string) => screen.getByRole("region", { name });

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 9, 14, 0));
    mockState = makeState();
    mockedUseAdminAuth.mockReturnValue({ user: admin, hydrated: true });
    fetchPaymobReconciliation.mockReset().mockResolvedValue({ items: [{}, {}], callbackProblems: [{}] });
    fetchOpenOrderReviewFlags.mockReset().mockResolvedValue([{
      id: 1, orderId: 7, orderCode: "CAP-0007", flagType: "address_review", reason: "Street missing", status: "open",
      customerName: "منى", totalAmount: 250, orderCreatedAt: at(8, 10), flaggedAt: at(8, 11)
    }]);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("greets the signed-in person by name", () => {
    render(createElement(DashboardPage));

    expect(screen.getByText(/مساء الخير، أحمد/)).toBeInTheDocument();
  });

  it("links every waiting task with its count", async () => {
    render(createElement(DashboardPage));
    const attention = region("يحتاج انتباهك");

    const reconciliation = await within(attention).findByRole("link", { name: /مدفوعات تحتاج مطابقة/ });
    expect(reconciliation).toHaveAttribute("href", "/orders/reconciliation");
    expect(reconciliation).toHaveTextContent("3");
    const flagged = await within(attention).findByRole("button", { name: /طلبات معلَّمة للمراجعة/ });
    expect(flagged).toHaveTextContent("1");
    const pending = within(attention).getByRole("link", { name: /طلبات بانتظار تأكيد الدفع/ });
    expect(pending).toHaveAttribute("href", "/orders?payment=pending");
    expect(pending).toHaveTextContent("1");
    const soldOut = within(attention).getByRole("link", { name: /مقاسات نفدت/ });
    expect(soldOut).toHaveAttribute("href", "#stock");
    expect(soldOut).toHaveTextContent("1");
  });

  it("lists the flagged orders, each linking to its order", async () => {
    render(createElement(DashboardPage));
    const attention = region("يحتاج انتباهك");

    fireEvent.click(await within(attention).findByRole("button", { name: /طلبات معلَّمة للمراجعة/ }));

    const link = within(attention).getByRole("link", { name: /CAP-0007/ });
    expect(link).toHaveAttribute("href", "/orders/7");
    expect(link).toHaveTextContent("مشكلة في عنوان الطلب");
    expect(link).toHaveTextContent("منى");
  });

  it("says nothing is waiting when every count is zero", async () => {
    fetchPaymobReconciliation.mockResolvedValue({ items: [], callbackProblems: [] });
    fetchOpenOrderReviewFlags.mockResolvedValue([]);
    mockState.orders = [order(2, "accepted")];
    mockState.products[0].variants[0].stock = 4;
    render(createElement(DashboardPage));

    expect(await within(region("يحتاج انتباهك")).findByText("لا شيء يحتاج انتباهك الآن")).toBeInTheDocument();
    expect(within(region("يحتاج انتباهك")).queryAllByRole("link")).toHaveLength(0);
    expect(within(region("يحتاج انتباهك")).queryAllByRole("button")).toHaveLength(0);
  });

  it("never claims all is well when a check could not load", async () => {
    fetchPaymobReconciliation.mockRejectedValue(new Error("offline"));
    fetchOpenOrderReviewFlags.mockResolvedValue([]);
    mockState.orders = [order(2, "accepted")];
    mockState.products[0].variants[0].stock = 4;
    render(createElement(DashboardPage));
    const attention = region("يحتاج انتباهك");

    expect(await within(attention).findByText("تعذّر تحميل بعض التنبيهات، حدّثي الصفحة.")).toBeInTheDocument();
    expect(within(attention).queryByText("لا شيء يحتاج انتباهك الآن")).not.toBeInTheDocument();
  });

  it("shows only what a staff member may read", async () => {
    mockedUseAdminAuth.mockReturnValue({ user: staff("products.read"), hydrated: true });
    render(createElement(DashboardPage));

    expect(within(region("يحتاج انتباهك")).getByRole("link", { name: /مقاسات نفدت/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "نبض المبيعات" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "الأكثر مبيعًا" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /طلبات بانتظار تأكيد الدفع/ })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchPaymobReconciliation).not.toHaveBeenCalled());
    expect(fetchOpenOrderReviewFlags).not.toHaveBeenCalled();
  });

  it("switches the sales figures between periods", () => {
    render(createElement(DashboardPage));
    const pulse = region("نبض المبيعات");

    expect(within(pulse).getAllByText(money(600)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "اليوم" }));

    expect(within(pulse).getAllByText(money(300)).length).toBeGreaterThan(0);
    expect(within(pulse).getByText(/200%/)).toBeInTheDocument();
    expect(within(region("الأكثر مبيعًا")).getByText("سيروم فيتامين سي")).toBeInTheDocument();
    expect(within(region("الأكثر مبيعًا")).queryByText("كريم الليل")).not.toBeInTheDocument();
  });

  it("ranks best sellers and names products with no recent sales", () => {
    render(createElement(DashboardPage));
    const top = region("الأكثر مبيعًا");

    const rows = within(top).getAllByRole("listitem").map((item) => item.textContent);
    expect(rows[0]).toContain("سيروم فيتامين سي");
    expect(rows[0]).toContain("4");
    expect(rows[1]).toContain("كريم الليل");
    expect(within(top).getByRole("link", { name: "لوشن الجسم" })).toHaveAttribute("href", "/products/3/edit");
  });

  it("lists low and sold-out sizes, best seller first", () => {
    render(createElement(DashboardPage));
    const rows = within(region("المخزون")).getAllByRole("row");

    expect(rows[0]).toHaveTextContent("كريم الليل");
    expect(rows[1]).toHaveTextContent("سيروم فيتامين سي");
    expect(rows[1]).toHaveTextContent("نفد");
  });

  it("warns about discounts that end soon", () => {
    render(createElement(DashboardPage));
    const ending = region("خصومات تنتهي قريبًا");

    expect(within(ending).getByRole("link", { name: /كريم الليل/ })).toHaveAttribute("href", "/products/2/discount");
    expect(within(ending).getByText("ينتهي بعد يومين")).toBeInTheDocument();
  });

  it("scores the catalog and lists the products behind each gap", () => {
    render(createElement(DashboardPage));
    const health = region("جودة الكتالوج");

    expect(within(health).getByText("92%")).toBeInTheDocument();
    fireEvent.click(within(health).getByRole("button", { name: /بدون اسم إنجليزي/ }));

    expect(within(health).getByRole("link", { name: "كريم الليل" })).toHaveAttribute("href", "/products/2/edit");
  });

  it("offers only the create pages the person may use", () => {
    mockedUseAdminAuth.mockReturnValue({ user: staff("products.read", "products.create"), hydrated: true });
    render(createElement(DashboardPage));

    fireEvent.pointerDown(screen.getByRole("button", { name: "جديد" }));

    expect(screen.getByRole("menuitem", { name: "منتج جديد" })).toHaveAttribute("href", "/products/new");
    expect(screen.queryByRole("menuitem", { name: "عرض جديد" })).not.toBeInTheDocument();
  });
});
