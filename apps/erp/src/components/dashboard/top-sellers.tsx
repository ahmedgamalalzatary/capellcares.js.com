"use client";

import Link from "next/link";
import type { Product } from "@capella/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

const SLOW_SHOWN = 6;

/** The period's five best sellers as bars, then the in-stock products nobody bought in 30 days (candidates for an offer). */
export function TopSellers({
  rows,
  slow,
  periodLabel,
  loaded,
}: {
  rows: Array<{ productId: number; name: string; units: number }>;
  /** Absent when the person may not read products. */
  slow: Product[] | null;
  periodLabel: string;
  loaded: boolean;
}) {
  const max = rows[0]?.units ?? 0;

  return (
    <Card aria-label="الأكثر مبيعًا" className="flex flex-col">
      <CardHeader title="الأكثر مبيعًا" description={`بعدد القطع المباعة خلال ${periodLabel}.`} />
      <CardBody className="grid flex-1 content-start gap-6">
        {!loaded ? (
          <Skeleton className="h-56 w-full rounded-well" />
        ) : (
          <>
            {rows.length === 0 ? (
              <p className="rounded-control bg-sunken px-4 py-6 text-center text-base text-text-muted">لا مبيعات في هذه الفترة.</p>
            ) : (
              <ol className="grid gap-3.5">
                {rows.map((row, index) => (
                  <li key={row.productId} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                    <span className="num text-sm font-bold text-text-muted">{formatNumber(index + 1)}</span>
                    <Link href={`/products/${row.productId}/edit`} className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">
                      {row.name}
                    </Link>
                    <span className="num font-bold text-text-strong" title="القطع المباعة">{formatNumber(row.units)}</span>
                    <span aria-hidden className="col-start-2 col-end-4 h-1.5 overflow-hidden rounded-full bg-sunken">
                      <span className="block h-full rounded-full bg-nude-strong" style={{ width: `${max > 0 ? (row.units / max) * 100 : 0}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {slow && slow.length > 0 ? (
              <div className="grid gap-2.5 border-t border-line pt-5">
                <span className="text-sm font-medium text-text-2">
                  متوفرة لكن بلا مبيعات منذ 30 يومًا <span className="num text-text-muted">({formatNumber(slow.length)})</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {slow.slice(0, SLOW_SHOWN).map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}/edit`}
                      className="rounded-full bg-sunken px-3 py-1 text-sm text-text-2 transition-colors hover:bg-hover hover:text-text-strong"
                    >
                      {product.name.ar}
                    </Link>
                  ))}
                  {slow.length > SLOW_SHOWN ? (
                    <span className="px-1 py-1 text-sm text-text-muted">و<span className="num">{formatNumber(slow.length - SLOW_SHOWN)}</span> أخرى</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
