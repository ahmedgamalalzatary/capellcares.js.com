import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPrice } from "@capella/shared";

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    sales: {
      summary: {
        totalOrders: 2,
        totalUnitsSold: 4,
        totalRevenue: 140
      },
      productTotals: [
        { productId: 1, productName: "Baseline Product 1", unitsSold: 3, revenue: 105 },
        { productId: 2, productName: "Baseline Product 2", unitsSold: 1, revenue: 35 }
      ],
      variantTotals: [
        { variantId: 11, productId: 1, productName: "Baseline Product 1", variantLabel: "100ml", unitsSold: 3, revenue: 105 },
        { variantId: 12, productId: 2, productName: "Baseline Product 2", variantLabel: "200ml", unitsSold: 1, revenue: 35 }
      ],
      orders: [
        { orderId: 5, orderCode: "SALE-001", paymentStatus: "denied", totalAmount: 70, unitsSold: 2, createdAt: "2026-05-19T00:00:00.000Z", items: [{ label: "Baseline Product 1 / 100ml", unitsSold: 2 }] },
        { orderId: 6, orderCode: "SALE-002", paymentStatus: "accepted", totalAmount: 70, unitsSold: 2, createdAt: "2026-05-20T00:00:00.000Z", items: [{ label: "Baseline Product 1 / 100ml", unitsSold: 1 }, { label: "Baseline Product 2 / 200ml", unitsSold: 1 }] }
      ]
    }
  })
}));

import SalesPage from "@/app/sales/page";

// formatPrice emits a non-breaking space that testing-library normalizes away on the
// DOM side only, so compare with all whitespace stripped from both sides.
function money(value: number) {
  const expected = formatPrice(value, "ar").replace(/\s+/gu, "");
  return (_content: string, element: Element | null) =>
    element?.textContent?.replace(/\s+/gu, "") === expected;
}

describe("SalesPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("formats every money figure with the shared price formatter", () => {
    render(createElement(SalesPage));

    expect(screen.getAllByText(money(140)).length).toBe(1);
    expect(screen.getAllByText(money(105)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(money(70)).length).toBe(2);
  });

  it("renders payment status in Arabic instead of the raw enum", () => {
    render(createElement(SalesPage));

    expect(screen.getByText("مرفوض")).toBeInTheDocument();
    expect(screen.getByText("مقبول")).toBeInTheDocument();
    expect(screen.queryByText("denied")).not.toBeInTheDocument();
    expect(screen.queryByText("accepted")).not.toBeInTheDocument();
  });

  it("renders summary metrics and per-order breakdown", () => {
    render(createElement(SalesPage));

    expect(screen.getByText("إجمالي الطلبات")).toBeInTheDocument();
    expect(screen.getByText("إجمالي الوحدات")).toBeInTheDocument();
    expect(screen.getByText("إجمالي الإيراد")).toBeInTheDocument();
    expect(screen.getByText("Baseline Product 1")).toBeInTheDocument();
    expect(screen.getByText("SALE-001")).toBeInTheDocument();
    expect(screen.getAllByText("Baseline Product 1 / 100ml").length).toBeGreaterThan(0);
    expect(screen.getByText("Baseline Product 1 / 100ml x2")).toBeInTheDocument();
    expect(screen.getByText("Baseline Product 2 / 200ml x1")).toBeInTheDocument();
  });
});
