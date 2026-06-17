import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { createSale, toastSuccess, toastError } = vi.hoisted(() => ({
  createSale: vi.fn().mockResolvedValue({ id: 77, orderCode: "SALE-077" }),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError
  }
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, title }: any) => createElement("main", null, createElement("h1", null, title), children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["sales.read", "sales.create"] }
  })
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({ createSale }),
  useStore: (selector: any) => selector({
    products: [{
      id: 1,
      sku: "SKU-1",
      slug: "baseline-product",
      name: { ar: "منتج أساسي", en: "Baseline Product" },
      status: "active",
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 5 }]
    }],
    offers: [{
      id: 5,
      slug: "baseline-offer",
      name: { ar: "عرض أساسي", en: "Baseline Offer" },
      price: 80,
      stock: 3,
      status: "active"
    }],
    collections: [{
      id: 9,
      slug: "baseline-collection",
      name: { ar: "مجموعة أساسية", en: "Baseline Collection" },
      price: 120,
      stock: 2,
      status: "active",
      visibility: "visible"
    }]
  })
}));

import SalesPage from "@/app/sales/page";

describe("SalesPage", () => {
  it("creates a sale with product, offer, and collection lines", async () => {
    render(createElement(SalesPage));

    expect(screen.getByRole("heading", { name: "إضافة بيع" })).toBeInTheDocument();
    expect(screen.getByTestId("sale-entry-layout")).toHaveStyle({ display: "flex" });
    expect(screen.getByTestId("sale-entry-layout")).toHaveClass("sales-entry-layout");
    expect(screen.getByTestId("sale-total-summary")).toHaveStyle({ display: "flex" });

    fireEvent.change(screen.getByLabelText("اسم العميل"), { target: { value: "ERP Sale" } });
    fireEvent.change(screen.getByLabelText("ملاحظات"), { target: { value: "Created from ERP" } });
    fireEvent.change(screen.getByLabelText("سعر البيع النهائي"), { target: { value: "350" } });

    const rows = screen.getAllByTestId("sale-line");
    expect(within(rows[0]).getByTestId("sale-line-qty-actions")).toHaveStyle({ display: "flex" });
    fireEvent.change(within(rows[0]).getByLabelText("نوع العنصر"), { target: { value: "product" } });
    fireEvent.change(within(rows[0]).getByLabelText("العنصر"), { target: { value: "product:11" } });
    fireEvent.change(within(rows[0]).getByLabelText("الكمية"), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: "إضافة بند" }));
    const secondRow = screen.getAllByTestId("sale-line")[1];
    fireEvent.change(within(secondRow).getByLabelText("نوع العنصر"), { target: { value: "offer" } });
    fireEvent.change(within(secondRow).getByLabelText("العنصر"), { target: { value: "offer:5" } });
    fireEvent.change(within(secondRow).getByLabelText("الكمية"), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: "إضافة بند" }));
    const thirdRow = screen.getAllByTestId("sale-line")[2];
    fireEvent.change(within(thirdRow).getByLabelText("نوع العنصر"), { target: { value: "collection" } });
    fireEvent.change(within(thirdRow).getByLabelText("العنصر"), { target: { value: "collection:9" } });
    fireEvent.change(within(thirdRow).getByLabelText("الكمية"), { target: { value: "1" } });

    expect(screen.getByText("فرق سعر البيع: +20")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("سعر البيع النهائي"), { target: { value: "280" } });
    expect(screen.getByText("فرق سعر البيع: -50")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تسجيل البيع" }));

    await waitFor(() => {
      expect(createSale).toHaveBeenCalledWith({
        fullName: "ERP Sale",
        phone: "",
        addressLine: "",
        notes: "Created from ERP",
        soldTotalAmount: 280,
        items: [
          { type: "product", variantId: 11, qty: 1 },
          { type: "offer", offerId: 5, qty: 2 },
          { type: "collection", collectionId: 9, qty: 1 }
        ]
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("تم تسجيل البيع بكود SALE-077");
    expect(screen.queryByText("تم تسجيل البيع بكود SALE-077")).not.toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });
});
