"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { AdminOrderReviewFlagDto } from "@capella/shared";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { getStore } from "@/lib/store";
import { flagTitles } from "@/lib/order-review-flags";

const POLL_MS = 60_000;

function canSeeAlerts(user: { role: "admin" | "staff"; permissionKeys?: string[] } | null) {
  return !!user && (user.role === "admin" || (user.permissionKeys ?? []).includes("orders.read"));
}

/** Staff alerts for unresolved order review flags. The x button acknowledges the alert server-side with no note, which hides it for everyone and never changes the order. */
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
    const openIds = new Set(flags.map(flag => flag.id));
    for (const id of shownIds.current) {
      if (openIds.has(id)) continue;
      shownIds.current.delete(id);
      toast.dismiss(`order-review-flag-${id}`);
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
          // Feed reconciliation removes the ID before dismissing the toast.
          if (!shownIds.current.has(flag.id)) return;
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
