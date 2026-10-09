"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { daysPhrase, type endingDiscounts } from "@/features/dashboard/lib/metrics";

const DAY_MS = 24 * 60 * 60 * 1000;

function endsIn(endsAt: string, now: Date) {
  const end = new Date(endsAt);
  const days = Math.round(
    (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / DAY_MS,
  );
  if (days <= 0) return "ينتهي اليوم";
  if (days === 1) return "ينتهي غدًا";
  return `ينتهي بعد ${daysPhrase(days)}`;
}

function formatEnd(endsAt: string) {
  return new Date(endsAt).toLocaleString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
}

/** Running discounts that stop within a week, soonest first, so a sale never ends unnoticed. */
export function EndingDiscounts({ rows, now, loaded }: { rows: ReturnType<typeof endingDiscounts>; now: Date; loaded: boolean }) {
  return (
    <Card aria-label="خصومات تنتهي قريبًا" className="flex flex-col">
      <CardHeader title="خصومات تنتهي قريبًا" description="الخصومات السارية التي تنتهي خلال 7 أيام." />
      <CardBody className="flex-1">
        {!loaded ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<CalendarClock />} title="لا خصومات تنتهي خلال 7 أيام" className="py-8" />
        ) : (
          <ul className="grid gap-2">
            {rows.map((row) => {
              const label = endsIn(row.endsAt, now);
              return (
                <li key={row.key}>
                  <Link
                    href={row.href}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-control bg-sunken px-4 py-3 transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate font-medium text-text-strong">{row.name}</span>
                      <span className="text-sm text-text-muted">{formatEnd(row.endsAt)}</span>
                    </span>
                    <span className={label === "ينتهي اليوم" || label === "ينتهي غدًا" ? "text-sm font-medium text-danger" : "text-sm font-medium text-warning"}>
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
