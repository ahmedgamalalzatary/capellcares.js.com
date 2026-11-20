type SavingsLine = {
  qty: number;
  unitPrice: number;
  lineTotal: number;
  snapshotBaseUnitPrice?: number | null;
  promoDiscountAmount?: number | null;
  isPromoGift?: boolean;
};

/** What the customer saved against original prices, split into sale discounts, the promo code and the code's free gift
 * (at its normal price) (spec section 9.2), in fils. */
export function orderSavings(lines: SavingsLine[]): { saleFils: number; promoFils: number; giftFils: number } {
  let saleFils = 0;
  let promoFils = 0;
  let giftFils = 0;
  for (const line of lines) {
    if (line.isPromoGift) {
      giftFils += Math.round((line.snapshotBaseUnitPrice ?? 0) * 1000) * line.qty;
      continue;
    }
    const originalFils = Math.round((line.snapshotBaseUnitPrice ?? line.unitPrice) * 1000) * line.qty;
    const promo = Math.round((line.promoDiscountAmount ?? 0) * 1000);
    promoFils += promo;
    saleFils += Math.max(0, originalFils - Math.round(line.lineTotal * 1000) - promo);
  }
  return { saleFils, promoFils, giftFils };
}
