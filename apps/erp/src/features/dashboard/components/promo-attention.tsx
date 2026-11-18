"use client";

import Link from "next/link";
import { TicketPercent } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromoAttention } from "@/features/promos/lib/promo-report";
import { formatPromoDateTime } from "@/features/promos/components/promo-code-detail";

const rowClass = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-control bg-sunken px-4 py-3 transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Promo items for the dashboard: free orders a code made that wait for staff, and running codes that end within a week. */
export function PromoAttentionCard({ attention, loaded }: { attention: PromoAttention | null; loaded: boolean }) {
  const empty = attention !== null && attention.freeOrderReviews.length === 0 && attention.endingSoon.length === 0;
  return (
    <Card aria-label="أكواد الخصم" className="flex flex-col">
      <CardHeader title="أكواد الخصم" description="طلبات مجانية تنتظر المراجعة، وأكواد تنتهي خلال 7 أيام." />
      <CardBody className="flex-1">
        {!loaded || attention === null ? (
          <Skeleton className="h-24 w-full" />
        ) : empty ? (
          <EmptyState icon={<TicketPercent />} title="لا شيء يحتاج انتباهك في أكواد الخصم" className="py-8" />
        ) : (
          <ul className="grid gap-2">
            {attention.freeOrderReviews.map((row) => (
              <li key={`free-${row.orderId}`}>
                <Link href={`/orders/${row.orderId}`} className={rowClass}>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium text-text-strong">{row.orderCode}</span>
                    <span className="text-sm text-text-muted">{`طلب مجاني بالكود ${row.codeText ?? ""}`}</span>
                  </span>
                  <span className="text-sm font-medium text-danger">يحتاج مراجعة قبل الشحن</span>
                </Link>
              </li>
            ))}
            {attention.endingSoon.map((row) => (
              <li key={`ending-${row.id}`}>
                <Link href={`/promo-codes/${row.id}`} className={rowClass}>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium text-text-strong">{row.code}</span>
                    <span className="text-sm text-text-muted">{row.arName}</span>
                  </span>
                  <span className="text-sm font-medium text-warning">{`ينتهي ${formatPromoDateTime(row.endsAt)}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
