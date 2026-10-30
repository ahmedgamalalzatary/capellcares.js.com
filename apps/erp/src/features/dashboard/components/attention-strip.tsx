"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CircleCheck, Clock, PackageX } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const chips = [
    { key: "pending", show: canReadOrders, href: "/orders?payment=pending", label: "طلبات بانتظار تأكيد الدفع", count: pendingPayments, tone: "warning" as const, icon: <Clock /> },
    { key: "sold-out", show: canReadProducts, href: "#stock", label: "مقاسات نفدت", count: soldOutSizes, tone: "warning" as const, icon: <PackageX /> },
  ].filter((chip) => chip.show && chip.count > 0);

  const ready = loaded;

  return (
    <Card aria-label="يحتاج انتباهك">
      <CardHeader title="يحتاج انتباهك" />
      <CardBody className="flex flex-wrap gap-2.5">
        {!ready ? (
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-11 w-52 rounded-control" />)
        ) : chips.length === 0 ? (
          <p className="flex items-center gap-2 text-base text-success [&_svg]:size-5">
            <CircleCheck aria-hidden />
            لا شيء يحتاج انتباهك الآن
          </p>
        ) : (
          <>
            {chips.map(({ key, href, label, count, tone, icon }) => (
              <Link key={key} href={href} className={chipClass}>
                <ChipContent label={label} count={count} tone={tone} icon={icon} />
              </Link>
            ))}
          </>
        )}
      </CardBody>
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
