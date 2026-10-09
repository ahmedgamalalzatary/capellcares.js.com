"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { daysPhrase, salesPulse, type DashboardRange } from "@/features/dashboard/lib/metrics";
import { formatMoney, formatNumber } from "@/lib/format";
import type { SalesAnalytics } from "@/lib/store/types";
import { cn } from "@/lib/utils";

export const rangeLabels: Record<DashboardRange, string> = { today: "اليوم", "7d": "7 أيام", "30d": "30 يومًا" };
const previousLabels: Record<DashboardRange, string> = { today: "عن أمس", "7d": "عن الأيام السبعة السابقة", "30d": "عن الثلاثين يومًا السابقة" };

/** Revenue for the chosen period with its trend, a bar per hour (today) or day, and how the period's orders were paid. */
export function SalesPulse({
  sales,
  range,
  now,
  loaded,
  payments,
}: {
  sales: SalesAnalytics["orders"];
  range: DashboardRange;
  now: Date;
  loaded: boolean;
  /** Absent when the person may not read orders. */
  payments: { accepted: number; pending: number; denied: number } | null;
}) {
  const pulse = salesPulse(sales, range, now);

  return (
    <Card aria-label="نبض المبيعات" className="flex flex-col">
      <CardHeader title="نبض المبيعات" description={`إيراد المنتجات المدفوعة خلال ${rangeLabels[range] === "اليوم" ? "اليوم" : `آخر ${rangeLabels[range]}`}، بدون الشحن.`} />
      <CardBody className="grid flex-1 content-start gap-6">
        {!loaded ? (
          <Skeleton className="h-56 w-full rounded-well" />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="grid gap-1.5">
                <span className="num text-2xl font-bold text-text-strong">{formatMoney(pulse.revenue)}</span>
                <Change change={pulse.change} label={previousLabels[range]} />
              </div>
              <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <Figure label="الطلبات" value={formatNumber(pulse.orderCount)} />
                <Figure label="متوسط الطلب" value={formatMoney(Math.round(pulse.averageOrder))} />
                <Figure label="القطع المباعة" value={formatNumber(pulse.units)} />
              </dl>
            </div>
            <Bars series={pulse.series} range={range} />
            {payments ? <PaymentSplit {...payments} /> : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Change({ change, label }: { change: number | null; label: string }) {
  if (change === null) return <span className="text-sm text-text-muted">لا مبيعات في الفترة السابقة للمقارنة</span>;
  const percent = Math.round(change * 100);
  const up = percent >= 0;
  return (
    <span className={cn("flex items-center gap-1.5 text-sm font-medium [&_svg]:size-4", up ? "text-success" : "text-danger")}>
      {up ? <TrendingUp aria-hidden /> : <TrendingDown aria-hidden />}
      <span className="num" dir="ltr">{`${up ? "+" : "−"}${formatNumber(Math.abs(percent))}%`}</span>
      <span className="font-normal text-text-muted">{label}</span>
    </span>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="num text-md font-bold whitespace-nowrap text-text-strong">{value}</dd>
    </div>
  );
}

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** Oldest bucket first, so in RTL time runs right to left like the text. */
function Bars({ series, range }: { series: number[]; range: DashboardRange }) {
  const max = Math.max(...series, 0);
  const caption = (index: number) => {
    if (range === "today") return hourLabel(index);
    const daysAgo = series.length - 1 - index;
    return daysAgo === 0 ? "اليوم" : daysAgo === 1 ? "أمس" : `قبل ${daysPhrase(daysAgo)}`;
  };
  return (
    <figure className="grid gap-2">
      <div className="flex h-28 items-end gap-[3px]" aria-hidden>
        {series.map((value, index) => (
          <span
            key={index}
            title={`${caption(index)}: ${formatMoney(value)}`}
            className={cn("flex-1 rounded-t-[3px]", value > 0 ? "bg-nude-strong hover:bg-text-strong" : "bg-line")}
            style={{ height: value > 0 && max > 0 ? `${Math.max(6, (value / max) * 100)}%` : "2px" }}
          />
        ))}
      </div>
      <figcaption className="flex justify-between text-xs text-text-muted">
        <span>{range === "today" ? "منتصف الليل" : caption(0)}</span>
        <span>{range === "today" ? "الآن" : "اليوم"}</span>
      </figcaption>
    </figure>
  );
}

function PaymentSplit({ accepted, pending, denied }: { accepted: number; pending: number; denied: number }) {
  const total = accepted + pending + denied;
  const parts = [
    { key: "accepted", label: "مقبول", count: accepted, bar: "bg-success" },
    { key: "pending", label: "قيد المراجعة", count: pending, bar: "bg-warning" },
    { key: "denied", label: "مرفوض", count: denied, bar: "bg-danger" },
  ];
  return (
    <div className="grid gap-2.5 border-t border-line pt-5">
      <span className="text-sm font-medium text-text-2">حالة الدفع لكل طلبات الفترة</span>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
        {total > 0 ? parts.map((part) => part.count > 0 ? <span key={part.key} className={part.bar} style={{ width: `${(part.count / total) * 100}%` }} /> : null) : null}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-2">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", part.bar)} />
            {part.label}
            <span className="num font-medium text-text-strong">{formatNumber(part.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
