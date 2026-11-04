import { addMoney } from "../orders/money.js";

/** One cart line as delivery sees it: offers and collections have no product and no own fee. */
export interface DeliveryLine {
  productId: number | null;
  ownFee: number | null;
}

/**
 * Order delivery fee:
 * - each distinct product with its own fee (> 0) adds that fee once, whatever its sizes, colours or quantity;
 * - everything else (no own fee, 0, offers, collections) shares the area fee, charged once.
 * An empty cart costs nothing.
 */
export function computeDeliveryFee(areaFee: number, lines: DeliveryLine[]) {
  const ownFees = new Map<number, number>();
  let usesAreaFee = false;
  for (const line of lines) {
    if (line.productId != null && line.ownFee != null && line.ownFee > 0) {
      ownFees.set(line.productId, line.ownFee);
    } else {
      usesAreaFee = true;
    }
  }
  let total = usesAreaFee ? areaFee : 0;
  for (const fee of ownFees.values()) total = addMoney(total, fee);
  return total;
}
