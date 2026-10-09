"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { AdminOrderReviewFlagDto } from "@capella/shared";
import { ChevronDown, CircleCheck, Clock, Flag, PackageX, Scale } from "lucide-react";
import { flagTitles } from "@/components/orders/order-review-flag-alerts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { getStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Null means that check failed to load. */
type Counts = { reconciliation: number | null; flags: AdminOrderReviewFlagDto[] | null };

/** One row of everything waiting on staff, each chip opening the place to deal with it. Zero counts hide; all zero shows a calm line instead. */
export function AttentionStrip({
  canReadOrders,
  canReadProducts,
  loaded,
  pendingPayments,
  soldOutSizes,
}: {
  canReadOrders: boolean;
  canReadProducts: boolean;
  loaded: boolean;
  pendingPayments: number;
  soldOutSizes: number;
}) {
  const [counts, setCounts] = useState<Counts>({ reconciliation: null, flags: null });
  const [showFlags, setShowFlags] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!canReadOrders) return;
    // Permissions can arrive after the first render; until this run settles the strip must stay in its loading state.
    setFetched(false);
    let cancelled = false;
    const store = getStore();
    // A failed check hides its chip and shows a reload hint, rather than blocking the rest of the strip.
    void Promise.all([
      store.fetchPaymobReconciliation().then((result) => result.items.length + result.callbackProblems.length, () => null),
      store.fetchOpenOrderReviewFlags().catch(() => null),
    ]).then(([reconciliation, flags]) => {
      if (cancelled) return;
      setCounts({ reconciliation, flags });
      setFetched(true);
    });
    return () => {
      cancelled = true;
    };
  }, [canReadOrders]);

  const chips = [
    { key: "reconciliation", show: canReadOrders, href: "/orders/reconciliation", label: "مدفوعات تحتاج مطابقة", count: counts.reconciliation ?? 0, tone: "danger" as const, icon: <Scale /> },
    { key: "pending", show: canReadOrders, href: "/orders?payment=pending", label: "طلبات بانتظار تأكيد الدفع", count: pendingPayments, tone: "warning" as const, icon: <Clock /> },
    { key: "sold-out", show: canReadProducts, href: "#stock", label: "مقاسات نفدت", count: soldOutSizes, tone: "warning" as const, icon: <PackageX /> },
  ].filter((chip) => chip.show && chip.count > 0);

  const flags = counts.flags ?? [];
  const failed = canReadOrders && fetched && (counts.reconciliation === null || counts.flags === null);
  const ready = loaded && (!canReadOrders || fetched);

  return (
    <Card aria-label="يحتاج انتباهك">
      <CardHeader title="يحتاج انتباهك" />
      <CardBody className="flex flex-wrap gap-2.5">
        {!ready ? (
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-11 w-52 rounded-control" />)
        ) : chips.length === 0 && flags.length === 0 && !failed ? (
          <p className="flex items-center gap-2 text-base text-success [&_svg]:size-5">
            <CircleCheck aria-hidden />
            لا شيء يحتاج انتباهك الآن
          </p>
        ) : (
          <>
            {flags.length > 0 ? (
              <button
                type="button"
                aria-expanded={showFlags}
                onClick={() => setShowFlags((value) => !value)}
                className={cn(chipClass, showFlags && "bg-hover shadow-[inset_0_0_0_1px_var(--line-strong)]")}
              >
                <ChipContent label="طلبات معلَّمة للمراجعة" count={flags.length} tone="danger" icon={<Flag />} />
                <ChevronDown aria-hidden className={cn("size-4 text-text-muted transition-transform", showFlags && "rotate-180")} />
              </button>
            ) : null}
            {chips.map(({ key, href, label, count, tone, icon }) => (
              <Link key={key} href={href} className={chipClass}>
                <ChipContent label={label} count={count} tone={tone} icon={icon} />
              </Link>
            ))}
            {failed ? <p className="flex h-11 items-center text-sm text-text-muted">تعذّر تحميل بعض التنبيهات، حدّثي الصفحة.</p> : null}
          </>
        )}
      </CardBody>
      {ready && showFlags && flags.length > 0 ? (
        <ul className="grid gap-2 border-t border-line px-5 py-4 sm:px-6">
          {flags.map((flag) => (
            <li key={flag.id}>
              <Link
                href={`/orders/${flag.orderId}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-sunken px-4 py-3 transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="num font-medium text-text-strong" dir="ltr">{flag.orderCode}</span>
                <span className="font-medium text-danger">{flagTitles[flag.flagType]}</span>
                <span className="text-sm text-text-muted">{flag.customerName}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

const chipClass = "flex h-11 items-center gap-2.5 rounded-control bg-sunken ps-1.5 pe-3.5 text-base font-medium text-text-strong transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:w-full";

function ChipContent({ label, count, tone, icon }: { label: string; count: number; tone: "danger" | "warning"; icon: ReactNode }) {
  return (
    <>
      <span
        className={cn(
          "num grid h-8 min-w-8 place-items-center rounded-control px-2 text-sm font-bold",
          tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
        )}
      >
        {formatNumber(count)}
      </span>
      <span aria-hidden className="text-text-muted [&_svg]:size-4">{icon}</span>
      {label}
    </>
  );
}
