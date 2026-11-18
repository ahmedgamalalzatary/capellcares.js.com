import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children) }));

import { PromoCodeDetailView } from "@/features/promos/components/promo-code-detail";
import { buildPromoCatalog } from "@/features/promos/lib/promo-catalog";
import type { PromoCodeDetail } from "@/features/promos/lib/promo-form";

const catalog = buildPromoCatalog({
  products: [],
  categories: [{ id: 2, parentId: null, slug: "hair", name: { ar: "الشعر", en: "Hair" } }] as never,
  offers: [{ id: 4, name: { ar: "عرض الصيف", en: "Summer offer" } }] as never,
  collections: []
});

const code = (overrides: Partial<PromoCodeDetail> = {}): PromoCodeDetail => ({
  id: 3, code: "SUMMER20", arName: "خصم الصيف", enName: "Summer", status: "active",
  startsAt: "2030-01-01T08:00:00.000Z", endsAt: null,
  discountType: "percentage", discountValue: 20, maxDiscountAmount: null, freeShipping: false,
  gift: { itemType: "offer", itemId: 4, qty: 1 },
  eligibilityScope: "selected", eligibility: { scope: "selected", include: [{ type: "category", id: 2 }], exclude: [] },
  minOrderAmount: null, maxOrderAmount: null, minEligiblePieces: null, maxDiscountedPieces: null,
  totalUsageLimit: 50, perCustomerLimit: null, firstOrderOnly: true, isPrivate: false, showInAccount: false,
  createdAt: "2029-12-01T00:00:00.000Z",
  usage: { used: 4, reserved: 1, released: 2, overLimit: 1 },
  customers: [],
  events: [{ action: "created", adminName: "Admin", createdAt: "2029-12-01T00:00:00.000Z" }],
  ...overrides
});

afterEach(cleanup);

const view = (overrides: Partial<PromoCodeDetail> = {}, permissions = { canUpdateStatus: true, canCreate: true }) => {
  const onStatusChange = vi.fn().mockResolvedValue(undefined);
  render(createElement(PromoCodeDetailView, { code: code(overrides), catalog, onStatusChange, ...permissions }));
  return onStatusChange;
};

describe("PromoCodeDetailView", () => {
  it("shows the code's benefits, eligibility, gift, rules and usage", () => {
    view();
    expect(screen.getByText("خصم 20%")).toBeInTheDocument();
    expect(screen.getByText("قسم: الشعر")).toBeInTheDocument();
    expect(screen.getByText("عرض الصيف × 1")).toBeInTheDocument();
    expect(screen.getByText("للطلب الأول فقط")).toBeInTheDocument();
    expect(screen.getByText("4 / 50")).toBeInTheDocument();
    expect(screen.getByText("فوق الحد (دفع متأخر)")).toBeInTheDocument();
    expect(screen.getByText("إنشاء")).toBeInTheDocument();
  });

  it("offers pause and stop on an active code, and resume and stop on a paused one", () => {
    view();
    expect(screen.getByRole("button", { name: "إيقاف مؤقت" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "استئناف" })).not.toBeInTheDocument();
    cleanup();
    view({ status: "paused" });
    expect(screen.getByRole("button", { name: "استئناف" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إنهاء الكود" })).toBeInTheDocument();
  });

  it("offers no status actions once stopped, or without the permission", () => {
    view({ status: "stopped" });
    expect(screen.queryByRole("button", { name: "إيقاف مؤقت" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "إنهاء الكود" })).not.toBeInTheDocument();
    cleanup();
    view({}, { canUpdateStatus: false, canCreate: false });
    expect(screen.queryByRole("button", { name: "إيقاف مؤقت" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "نسخ ككود جديد" })).not.toBeInTheDocument();
  });

  it("pauses right away but asks before stopping for good", async () => {
    const onStatusChange = view();
    fireEvent.click(screen.getByRole("button", { name: "إيقاف مؤقت" }));
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("pause"));

    fireEvent.click(screen.getByRole("button", { name: "إنهاء الكود" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("لا يمكن إعادة تشغيل الكود بعد إنهائه.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "إنهاء" }));
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("stop"));
  });

  it("links to a new code that starts from this one's rules", () => {
    view();
    expect(screen.getByRole("link", { name: "نسخ ككود جديد" })).toHaveAttribute("href", "/promo-codes/new?from=3");
  });
});
