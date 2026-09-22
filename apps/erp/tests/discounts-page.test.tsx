import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { apiPost, refetch } = vi.hoisted(() => ({
  apiPost: vi.fn().mockResolvedValue({ ok: true, counts: { variants: 2, offers: 1, collections: 1 } }),
  refetch: vi.fn().mockResolvedValue(undefined)
}));

const state = {
  loaded: true,
  error: null as string | null,
  categories: [
    { id: 1, parentId: null, name: { ar: "العناية", en: "Care" }, slug: "care" },
    { id: 2, parentId: 1, name: { ar: "البشرة", en: "Skin" }, slug: "skin" },
    { id: 3, parentId: 1, name: { ar: "الجسم", en: "Body" }, slug: "body" }
  ],
  products: [
    { id: 11, name: { ar: "كريم", en: "Cream" }, sku: "CREAM", categoryId: 2, variants: [{ id: 111, size: "100ml", price: 100, discount: null }] },
    { id: 12, name: { ar: "غسول", en: "Wash" }, sku: "WASH", categoryId: 3, variants: [{ id: 121, size: "200ml", price: 50, discount: null }] }
  ],
  offers: [{ id: 21, name: { ar: "عرض العناية", en: "Care Offer" }, categoryId: 1, price: 80, discount: null }],
  collections: [{ id: 31, name: { ar: "مجموعة العناية", en: "Care Set" }, categoryId: 1, price: 70, discount: null }]
};

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => createElement("div", null, children)
}));
vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({ user: { role: "admin", name: "Admin", email: "admin@test", permissionKeys: [] } })
}));
vi.mock("@/lib/store", () => ({
  useStore: (selector: (value: typeof state) => unknown) => selector(state),
  getStore: () => ({ refetch })
}));
vi.mock("@/lib/api/client", () => ({ api: { post: apiPost } }));

import DiscountsPage from "@/app/discounts/page";

afterEach(() => cleanup());
beforeEach(() => { apiPost.mockClear(); refetch.mockClear(); state.error = null; state.offers[0].price = 80; });

it("blocks a percentage discount for a zero-priced offer", () => {
  state.offers[0].price = 0;
  render(createElement(DiscountsPage));
  fireEvent.click(screen.getByLabelText("عرض: عرض العناية"));
  fireEvent.change(screen.getByLabelText("قيمة الخصم"), { target: { value: "20" } });
  fireEvent.change(screen.getByLabelText("بداية الخصم"), { target: { value: "2026-10-01T10:00" } });
  fireEvent.change(screen.getByLabelText("نهاية الخصم"), { target: { value: "2026-11-01T10:00" } });
  expect(screen.getByRole("button", { name: "تطبيق الخصم" })).toBeDisabled();
});

it("combines two categories with an individual offer and collection, then saves one reviewed discount", async () => {
  render(createElement(DiscountsPage));
  fireEvent.click(screen.getByLabelText("قسم: البشرة"));
  fireEvent.click(screen.getByLabelText("قسم: الجسم"));
  fireEvent.click(screen.getByLabelText("عرض: عرض العناية"));
  fireEvent.click(screen.getByLabelText("مجموعة: مجموعة العناية"));
  expect(screen.getByText("4 عناصر مستهدفة")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("قيمة الخصم"), { target: { value: "20" } });
  fireEvent.change(screen.getByLabelText("بداية الخصم"), { target: { value: "2026-10-01T10:00" } });
  fireEvent.change(screen.getByLabelText("نهاية الخصم"), { target: { value: "2026-11-01T10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "تطبيق الخصم" }));
  await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/erp/discounts/bulk", expect.objectContaining({
    categoryIds: [2, 3], offerIds: [21], collectionIds: [31],
    discount: expect.objectContaining({ type: "percentage", value: 20 })
  })));
  expect(refetch).toHaveBeenCalled();
});

it("can exclude one product variant after expanding a category", () => {
  render(createElement(DiscountsPage));
  fireEvent.click(screen.getByLabelText("قسم: العناية"));
  fireEvent.click(screen.getByLabelText("استبعاد كريم — 100ml"));
  expect(screen.getByText("3 عناصر مستهدفة")).toBeInTheDocument();
});

it("removes discounts from a mixed selection after confirmation", async () => {
  render(createElement(DiscountsPage));
  fireEvent.click(screen.getByLabelText("منتج: كريم (CREAM)"));
  fireEvent.click(screen.getByLabelText("عرض: عرض العناية"));
  fireEvent.click(screen.getByRole("button", { name: "إزالة الخصومات" }));
  fireEvent.click(screen.getByRole("button", { name: "تأكيد الإزالة" }));
  await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/erp/discounts/bulk", expect.objectContaining({
    productIds: [11], offerIds: [21], discount: null
  })));
});

it("blocks bulk editing when catalog data did not load completely", () => {
  state.error = "تعذر تحميل العروض";
  render(createElement(DiscountsPage));
  expect(screen.getByText("تعذر تحميل العروض")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "تطبيق الخصم" })).not.toBeInTheDocument();
});
