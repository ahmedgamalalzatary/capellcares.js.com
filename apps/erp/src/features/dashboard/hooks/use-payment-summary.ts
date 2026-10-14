"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export interface PaymentSummary {
  accepted: number;
  pending: number;
  denied: number;
}

/** Orders per payment outcome, counted by the server (all time, or since `since`); `null` until loaded or when disabled. */
export function usePaymentSummary(since: Date | null, enabled: boolean) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const sinceIso = since?.toISOString() ?? null;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const query = sinceIso ? `?${new URLSearchParams({ since: sinceIso })}` : "";
    void api.get<PaymentSummary>(`/api/erp/orders/payment-summary${query}`)
      .then((result) => { if (!cancelled) setSummary(result); })
      // Like the rest of the dashboard on a failed load: show empty counts rather than a skeleton that never resolves.
      .catch(() => { if (!cancelled) setSummary({ accepted: 0, pending: 0, denied: 0 }); });
    return () => { cancelled = true; };
  }, [enabled, sinceIso]);

  return enabled ? summary : null;
}
