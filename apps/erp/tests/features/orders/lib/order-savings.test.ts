import { describe, expect, it } from "vitest";
import { orderSavings } from "@/features/orders/lib/order-savings";

const line = (overrides: Record<string, unknown>) => ({ qty: 1, unitPrice: 100, lineTotal: 100, snapshotBaseUnitPrice: null, promoDiscountAmount: null, ...overrides });

describe("orderSavings", () => {
  it("counts sale savings from the original price on lines without a code", () => {
    expect(orderSavings([line({ qty: 2, unitPrice: 80, lineTotal: 160, snapshotBaseUnitPrice: 100 })])).toEqual({ saleCents: 4000, promoCents: 0, giftCents: 0 });
  });

  it("separates the code's discount from sale savings kept on pieces the code did not cover", () => {
    // 3 pieces, original 100, sale 80: two at the code price 90, one still on sale (80) = 260 paid, code took 20.
    expect(orderSavings([line({ qty: 3, unitPrice: 100, lineTotal: 260, snapshotBaseUnitPrice: 100, promoDiscountAmount: 20 })])).toEqual({ saleCents: 2000, promoCents: 2000, giftCents: 0 });
  });

  it("adds up every line and never reports negative savings", () => {
    expect(orderSavings([
      line({ unitPrice: 100, lineTotal: 90, promoDiscountAmount: 10 }),
      line({ unitPrice: 50, lineTotal: 50 })
    ])).toEqual({ saleCents: 0, promoCents: 1000, giftCents: 0 });
  });

  it("counts a free gift at its normal price as gift value, never as a sale saving", () => {
    expect(orderSavings([line({ qty: 2, unitPrice: 0, lineTotal: 0, snapshotBaseUnitPrice: 40, isPromoGift: true })]))
      .toEqual({ saleCents: 0, promoCents: 0, giftCents: 8000 });
  });
});
