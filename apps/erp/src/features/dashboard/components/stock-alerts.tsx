"use client";

import Link from "next/link";
import { useState } from "react";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableState, TBody, TD, TR } from "@/components/ui/table";
import type { stockAlerts } from "@/features/dashboard/lib/metrics";
import { formatNumber } from "@/lib/format";

const SHOWN = 8;

/** Sold-out and nearly sold-out sizes, best sellers first, so the one that costs sales gets restocked first. */
export function StockAlerts({ alerts, loaded }: { alerts: ReturnType<typeof stockAlerts>; loaded: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? alerts : alerts.slice(0, SHOWN);

  return (
    <Card id="stock" aria-label="المخزون" className="scroll-mt-24 overflow-hidden">
      <CardHeader
        title="المخزون"
        description="المقاسات التي نفدت أو قاربت على النفاد، الأكثر مبيعًا أولًا."
        actions={loaded && alerts.length > 0 ? <Badge tone="warning"><span className="num">{formatNumber(alerts.length)}</span></Badge> : undefined}
      />
      <Table>
        <TBody>
          {!loaded ? (
            <TableState colSpan={3}><Skeleton className="h-24 w-full" /></TableState>
          ) : alerts.length === 0 ? (
            <TableState colSpan={3}><EmptyState icon={<Package />} title="كل المخزون بحالة جيدة" className="py-8" /></TableState>
          ) : (
            visible.map(({ product, variant, level, sold }) => (
              <TR key={variant.id}>
                <TD data-cell="lead">
                  <Link href={`/products/${product.id}/edit`} className="font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">
                    {product.name.ar}
                  </Link>
                  <span className="block text-sm text-text-muted">{variant.size}</span>
                </TD>
                <TD data-label="مبيعات 30 يومًا" className="whitespace-nowrap text-sm text-text-muted">
                  {/* Phones already show the cell label above the value. */}
                  {sold > 0 ? <><span className="max-md:hidden">مبيعات 30 يومًا: </span><span className="num font-medium text-text-2">{formatNumber(sold)}</span></> : "بلا مبيعات"}
                </TD>
                <TD data-label="الحالة" className="text-end max-md:items-end">
                  {level === "out"
                    ? <Badge tone="danger">نفد</Badge>
                    : <Badge tone="warning"><span className="num">{formatNumber(variant.stock)}</span> متبقٍ</Badge>}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
      {loaded && alerts.length > SHOWN ? (
        <div className="border-t border-line px-5 py-3 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "عرض أقل" : <>عرض الكل (<span className="num">{formatNumber(alerts.length)}</span>)</>}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
