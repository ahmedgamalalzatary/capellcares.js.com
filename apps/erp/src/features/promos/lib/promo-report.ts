/** One code's report from GET /api/erp/promo-codes/:id/report (spec section 9.3). Money is in fils. */
export type PromoCodeReport = {
  uses: { used: number; released: number; remaining: number | null };
  money: {
    revenueFils: number;
    discountFils: number;
    shippingAbsorbedFils: number;
    giftCostFils: number;
    saleGivenUpFils: number;
    averageOrderFils: number;
    storeAverageFils: number;
  };
  customers: {
    newVsReturning: { newCustomers: number; returningCustomers: number };
    byCustomer: Array<{ customerId: number | null; name: string; phone: string; uses: number; orders: number; spentFils: number }>;
  };
  orders: Array<{
    id: number;
    orderCode: string;
    createdAt: string;
    customerName: string;
    totalAmount: number;
    paymentStatus: string;
    useState: "used" | "released" | null;
    releaseReason: string | null;
  }>;
  health: {
    cancelled: { count: number; total: number };
    usageByDay: Array<{ date: string; uses: number }>;
  };
};

/** Dashboard items from GET /api/erp/promo-codes/attention. */
export type PromoAttention = {
  freeOrderReviews: Array<{ orderId: number; orderCode: string; codeText: string | null; createdAt: string }>;
  endingSoon: Array<{ id: number; code: string; arName: string; endsAt: string }>;
};

/** A share as a whole percentage; 0 when there is nothing to divide. */
export function percent(part: { count: number; total: number }): string {
  return part.total === 0 ? "0%" : `${Math.round((part.count / part.total) * 100)}%`;
}

export const RELEASE_REASON_LABELS: Record<string, string> = {
  denied: "رفض",
  cancelled: "إلغاء العميل",
  expired: "انتهاء المهلة"
};
