"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { AttentionStrip } from "@/components/dashboard/attention-strip";
import { CatalogHealth } from "@/components/dashboard/catalog-health";
import { EndingDiscounts } from "@/components/dashboard/ending-discounts";
import { NewMenu } from "@/components/dashboard/new-menu";
import { rangeLabels, SalesPulse } from "@/components/dashboard/sales-pulse";
import { StockAlerts } from "@/components/dashboard/stock-alerts";
import { TopSellers } from "@/components/dashboard/top-sellers";
import { Button } from "@/components/ui/button";
import {
  catalogHealth,
  endingDiscounts,
  paymentSplit,
  rangeWindow,
  slowMovers,
  stockAlerts,
  topSellers,
  type DashboardRange,
} from "@/lib/dashboard";
import { canReadErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

const ranges: DashboardRange[] = ["today", "7d", "30d"];

export default function DashboardPage() {
  const { user } = useAdminAuth();
  const products = useStore((s) => s.products);
  const offers = useStore((s) => s.offers);
  const collections = useStore((s) => s.collections);
  const orders = useStore((s) => s.orders);
  const sales = useStore((s) => s.sales);
  const loaded = useStore((s) => s.loaded);
  const [range, setRange] = useState<DashboardRange>("7d");
  // The clock is read after mount: the server renders in its own time zone, so a greeting or a "today" window from it would not match the browser's.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const canReadProducts = canReadErpModule(user, "products");
  const canReadOrders = canReadErpModule(user, "orders");
  const canReadSales = canReadErpModule(user, "sales");
  const clock = now ?? new Date(0);
  const ready = loaded && now !== null;
  const period = rangeWindow(range, clock);
  const alerts = stockAlerts(products, sales.orders, clock, 30);
  const periodLabel = range === "today" ? "اليوم" : `آخر ${rangeLabels[range]}`;

  const greeting = now && user
    ? `${now.getHours() < 12 ? "صباح الخير" : "مساء الخير"}، ${user.name} · ${now.toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long" })}`
    : "نظرة سريعة على المتجر.";

  return (
    <AdminShell
      title="لوحة التحكم"
      crumbs={[{ label: "نظرة عامة" }]}
      description={greeting}
      actions={(
        <>
          {canReadSales ? (
            <div className="flex gap-1 rounded-control bg-sunken p-1" role="tablist" aria-label="الفترة">
              {ranges.map((value) => (
                <Button
                  key={value}
                  variant={range === value ? "primary" : "ghost"}
                  size="sm"
                  role="tab"
                  aria-selected={range === value}
                  className="flex-1"
                  onClick={() => setRange(value)}
                >
                  {rangeLabels[value]}
                </Button>
              ))}
            </div>
          ) : null}
          <NewMenu />
        </>
      )}
    >
      <div className="grid gap-5">
        <AttentionStrip
          canReadOrders={canReadOrders}
          canReadProducts={canReadProducts}
          loaded={ready}
          pendingPayments={paymentSplit(orders, null).pending}
          soldOutSizes={alerts.filter((alert) => alert.level === "out").length}
        />

        {canReadSales ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <SalesPulse
              sales={sales.orders}
              range={range}
              now={clock}
              loaded={ready}
              payments={canReadOrders ? paymentSplit(orders, period.start) : null}
            />
            <TopSellers
              rows={topSellers(sales.orders, period.start, products, 5)}
              slow={canReadProducts ? slowMovers(products, sales.orders, clock, 30) : null}
              periodLabel={periodLabel}
              loaded={ready}
            />
          </div>
        ) : null}

        {canReadProducts ? (
          <>
            <div className="grid gap-5 xl:grid-cols-2">
              <StockAlerts alerts={alerts} loaded={ready} />
              <EndingDiscounts rows={endingDiscounts({ products, offers, collections }, clock, 7)} now={clock} loaded={ready} />
            </div>
            <CatalogHealth health={catalogHealth(products)} loaded={ready} />
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
