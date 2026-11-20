/** One code's report from GET /api/erp/promo-codes/:id/report (spec section 9.3). Money is in piastres. */
export type PromoCodeReport = {
  uses: { used: number; reserved: number; released: number; overLimit: number; remaining: number | null };
  money: {
    revenueCents: number;
    discountCents: number;
    shippingAbsorbedCents: number;
    giftCostCents: number;
    saleGivenUpCents: number;
    averageOrderCents: number;
    storeAverageCents: number;
  };
  customers: {
    newVsReturning: { newCustomers: number; returningCustomers: number };
    byCustomer: Array<{ customerId: number | null; name: string; phone: string; uses: number; orders: number; spentCents: number }>;
  };
  orders: Array<{
    id: number;
    orderCode: string;
    createdAt: string;
    customerName: string;
    totalAmount: number;
    paymentStatus: string;
    refundedAmountCents: number;
    useState: "reserved" | "used" | "released" | null;
    releaseReason: string | null;
    overLimit: boolean;
  }>;
  health: {
    cancelled: { count: number; total: number };
    refunded: { count: number; total: number };
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
  cancelled: "إلغاء",
  expired: "انتهاء المهلة",
  payment_failed: "فشل الدفع",
  session_expired: "انتهاء جلسة الدفع",
  early_refund: "استرداد قبل الطلب"
};
