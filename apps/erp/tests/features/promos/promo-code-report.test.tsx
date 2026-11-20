import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children) }));

import { PromoCodeReportView } from "@/features/promos/components/promo-code-report";
import { PromoAttentionCard } from "@/features/dashboard/components/promo-attention";
import type { PromoCodeReport } from "@/features/promos/lib/promo-report";

afterEach(cleanup);

const report = (overrides: Partial<PromoCodeReport> = {}): PromoCodeReport => ({
  uses: { used: 2, released: 1, remaining: 6 },
  money: { revenueFils: 25000, discountFils: 3000, shippingAbsorbedFils: 1250, giftCostFils: 8000, saleGivenUpFils: 500,
    averageOrderFils: 12500, storeAverageFils: 10000 },
  customers: { newVsReturning: { newCustomers: 1, returningCustomers: 1 },
    byCustomer: [{ customerId: 7, name: "Mona", phone: "+96551112222", uses: 2, orders: 2, spentFils: 25000 }] },
  orders: [
    { id: 41, orderCode: "ABCD-041", createdAt: "2030-01-02T10:00:00.000Z", customerName: "Mona", totalAmount: 15, paymentStatus: "accepted",
      useState: "used", releaseReason: null },
    { id: 42, orderCode: "ABCD-042", createdAt: "2030-01-03T10:00:00.000Z", customerName: "Sara", totalAmount: 9, paymentStatus: "denied",
      useState: "released", releaseReason: "denied" }
  ],
  health: { cancelled: { count: 1, total: 4 }, usageByDay: [{ date: "2030-01-02", uses: 2 }] },
  ...overrides
});

describe("PromoCodeReportView", () => {
  it("shows uses with what is left of the limit, and every money figure in dinars", () => {
    render(createElement(PromoCodeReportView, { report: report() }));
    const uses = within(screen.getByRole("region", { name: "الاستخدام" }));
    expect(uses.getByText("مستخدم").nextElementSibling).toHaveTextContent("2");
    expect(uses.getByText("أُعيد").nextElementSibling).toHaveTextContent("1");
    expect(uses.getByText("المتبقي").nextElementSibling).toHaveTextContent("6");
    const money = within(screen.getByRole("region", { name: "الأرقام المالية" }));
    expect(money.getByText("الإيراد").nextElementSibling).toHaveTextContent("25");
    expect(money.getByText("إجمالي الخصم").nextElementSibling).toHaveTextContent("3");
    expect(money.getByText("تكلفة التوصيل المجاني").nextElementSibling).toHaveTextContent("1.25");
    expect(money.getByText("تكلفة الهدايا").nextElementSibling).toHaveTextContent("8");
    expect(money.getByText("تخفيضات استبدلها الكود").nextElementSibling).toHaveTextContent("0.5");
    expect(money.getByText("متوسط الطلب بالكود").nextElementSibling).toHaveTextContent("12.5");
    expect(money.getByText("متوسط الطلب في المتجر").nextElementSibling).toHaveTextContent("10");
  });

  it("lists customers and orders, linking each order and marking those that gave their use back", () => {
    render(createElement(PromoCodeReportView, { report: report() }));
    const customers = within(screen.getByRole("region", { name: "العملاء" }));
    expect(customers.getByText("عملاء جدد").nextElementSibling).toHaveTextContent("1");
    expect(customers.getByRole("cell", { name: "Mona" })).toBeInTheDocument();
    const orders = within(screen.getByRole("region", { name: "الطلبات" }));
    expect(orders.getByRole("link", { name: "ABCD-041" })).toHaveAttribute("href", "/orders/41");
    expect(orders.getByRole("row", { name: /ABCD-042/ })).toHaveTextContent("أُعيد (رفض)");
  });

  it("shows the cancellation rate out of all orders with the code", () => {
    render(createElement(PromoCodeReportView, { report: report() }));
    const health = within(screen.getByRole("region", { name: "المؤشرات" }));
    expect(health.getByText("نسبة الإلغاء والرفض").nextElementSibling).toHaveTextContent("25%");
  });

  it("says when no order has used the code yet", () => {
    render(createElement(PromoCodeReportView, { report: report({ orders: [], customers: { newVsReturning: { newCustomers: 0, returningCustomers: 0 }, byCustomer: [] },
      health: { cancelled: { count: 0, total: 0 }, usageByDay: [] } }) }));
    expect(screen.getByText("لم يُستخدم الكود في أي طلب بعد.")).toBeInTheDocument();
  });
});

describe("PromoAttentionCard", () => {
  it("links free orders waiting for review and codes ending within a week", () => {
    render(createElement(PromoAttentionCard, { loaded: true, attention: {
      freeOrderReviews: [{ orderId: 51, orderCode: "FREE-051", codeText: "FREE100", createdAt: "2030-01-02T10:00:00.000Z" }],
      endingSoon: [{ id: 9, code: "SOON", arName: "قريب", endsAt: "2030-01-04T10:00:00.000Z" }]
    } }));
    expect(screen.getByRole("link", { name: /FREE-051/ })).toHaveAttribute("href", "/orders/51");
    expect(screen.getByRole("link", { name: /SOON/ })).toHaveAttribute("href", "/promo-codes/9");
  });

  it("says when nothing needs attention", () => {
    render(createElement(PromoAttentionCard, { loaded: true, attention: { freeOrderReviews: [], endingSoon: [] } }));
    expect(screen.getByText("لا شيء يحتاج انتباهك في أكواد الخصم")).toBeInTheDocument();
  });
});
