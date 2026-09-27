"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { AdminOrderReviewFlagDto } from "@capella/shared";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { getStore } from "@/lib/store";

const flagTitles: Record<AdminOrderReviewFlagDto["flagType"], string> = {
  address_review: "مشكلة في عنوان الطلب",
  expiry_review: "مهلة الطلب انتهت وتحتاج مراجعة",
  refund_review: "استرداد يحتاج مراجعة",
  amount_mismatch: "المبلغ المحصل لا يطابق الطلب",
  custody_review: "حيازة الشحنة غير مؤكدة",
  cancellation_pending: "تأكيد الإلغاء معلق",
  untouched_paid: "طلب مدفوع تجاوز 96 ساعة دون تجهيز"
};

const POLL_MS = 60_000;

function canSeeAlerts(user: { role: "admin" | "staff"; permissionKeys?: string[] } | null) {
  return !!user && (user.role === "admin" || (user.permissionKeys ?? []).includes("orders.read"));
}

/**
 * Staff alerts for unresolved order review flags. The x button acknowledges the alert
 * server-side with no note, which hides it for everyone and never changes the order.
 */
export function OrderReviewFlagAlerts() {
  const { user } = useAdminAuth();
  const shownIds = useRef(new Set<number>());

  const sync = useCallback(async () => {
    if (!canSeeAlerts(user)) return;
    let flags: AdminOrderReviewFlagDto[];
    try {
      flags = await getStore().fetchOpenOrderReviewFlags();
    } catch {
      return;
    }
    for (const flag of flags) {
      if (shownIds.current.has(flag.id)) continue;
      shownIds.current.add(flag.id);
      toast.warning(flagTitles[flag.flagType], {
        id: `order-review-flag-${flag.id}`,
        description: `${flag.orderCode} — ${flag.customerName} — ${flag.reason}`,
        duration: Infinity,
        closeButton: true,
        // A failed dismissal must not hide the still-open alert for the rest of this mount.
        onDismiss: () => {
          void getStore().resolveOrderReviewFlag(flag.id)
            .catch(() => { shownIds.current.delete(flag.id); });
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (!canSeeAlerts(user)) return;
    void sync();
    const timer = window.setInterval(() => { void sync(); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [user, sync]);

  return null;
}
