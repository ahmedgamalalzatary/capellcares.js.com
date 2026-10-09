"use client";

import { BarChart3 } from "lucide-react";
import { AdminShell } from "@/components/shell/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney, formatNumber } from "@/lib/format";
import { paymentStatusLabel, paymentStatusTone } from "@/lib/payment-status";
import { useStore } from "@/lib/store";
import { useTableSort } from "@/hooks/use-table-sort";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ar-EG-u-nu-latn", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SalesPage() {
  const sales = useStore((s) => s.sales);
  const loaded = useStore((s) => s.loaded);

  const products = useTableSort(sales.productTotals, {
    name: (item) => item.productName,
    units: (item) => item.unitsSold,
    revenue: (item) => item.revenue
  });
  const variants = useTableSort(sales.variantTotals, {
    name: (item) => `${item.productName} ${item.variantLabel}`,
    units: (item) => item.unitsSold,
    revenue: (item) => item.revenue
  });
  const orders = useTableSort(sales.orders, {
    code: (item) => item.orderCode,
    status: (item) => item.paymentStatus,
    total: (item) => item.totalAmount,
    units: (item) => item.unitsSold,
    date: (item) => item.createdAt
  });

  return (
    <AdminShell
      title="المبيعات"
      crumbs={[{ label: "المبيعات" }]}
      description="ملخّص مبيعات المتجر وأفضل العناصر."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {loaded ? (
          <>
            <Metric label="إجمالي الطلبات" value={formatNumber(sales.summary.totalOrders)} />
            <Metric label="إجمالي الوحدات" value={formatNumber(sales.summary.totalUnitsSold)} />
            <Metric label="إجمالي الإيراد" value={formatMoney(sales.summary.totalRevenue)} />
          </>
        ) : (
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 rounded-well" />)
        )}
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="أفضل المنتجات" />
          <Table>
            <THead>
              <tr>
                <SortableTH direction={products.sort?.key === "name" ? products.sort.direction : null} onSort={() => products.toggleSort("name")}>المنتج</SortableTH>
                <SortableTH direction={products.sort?.key === "units" ? products.sort.direction : null} onSort={() => products.toggleSort("units")}>الوحدات</SortableTH>
                <SortableTH direction={products.sort?.key === "revenue" ? products.sort.direction : null} onSort={() => products.toggleSort("revenue")}>الإيراد</SortableTH>
              </tr>
            </THead>
            <TBody>
              {products.sortedRows.map((item) => (
                <TR key={item.productId}>
                  <TD data-cell="lead" className="text-text-strong">{item.productName}</TD>
                  <TD data-label="الوحدات" className="num whitespace-nowrap text-text-2">{formatNumber(item.unitsSold)}</TD>
                  <TD data-label="الإيراد" className="num whitespace-nowrap font-medium text-text-strong">{formatMoney(item.revenue)}</TD>
                </TR>
              ))}
              {products.sortedRows.length === 0 ? <TableState colSpan={3}><TableEmpty label="لا توجد مبيعات منتجات بعد." /></TableState> : null}
            </TBody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="أفضل المقاسات" />
          <Table>
            <THead>
              <tr>
                <SortableTH direction={variants.sort?.key === "name" ? variants.sort.direction : null} onSort={() => variants.toggleSort("name")}>المقاس</SortableTH>
                <SortableTH direction={variants.sort?.key === "units" ? variants.sort.direction : null} onSort={() => variants.toggleSort("units")}>الوحدات</SortableTH>
                <SortableTH direction={variants.sort?.key === "revenue" ? variants.sort.direction : null} onSort={() => variants.toggleSort("revenue")}>الإيراد</SortableTH>
              </tr>
            </THead>
            <TBody>
              {variants.sortedRows.map((item) => (
                <TR key={item.variantId}>
                  <TD data-cell="lead" className="text-text-strong">{item.productName} / {item.variantLabel}</TD>
                  <TD data-label="الوحدات" className="num whitespace-nowrap text-text-2">{formatNumber(item.unitsSold)}</TD>
                  <TD data-label="الإيراد" className="num whitespace-nowrap font-medium text-text-strong">{formatMoney(item.revenue)}</TD>
                </TR>
              ))}
              {variants.sortedRows.length === 0 ? <TableState colSpan={3}><TableEmpty label="لا توجد مبيعات مقاسات بعد." /></TableState> : null}
            </TBody>
          </Table>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="تفصيل الطلبات" />
        <Table>
          <THead>
            <tr>
              <SortableTH direction={orders.sort?.key === "code" ? orders.sort.direction : null} onSort={() => orders.toggleSort("code")}>كود الطلب</SortableTH>
              <SortableTH direction={orders.sort?.key === "status" ? orders.sort.direction : null} onSort={() => orders.toggleSort("status")}>الحالة</SortableTH>
              <SortableTH direction={orders.sort?.key === "total" ? orders.sort.direction : null} onSort={() => orders.toggleSort("total")}>الإجمالي</SortableTH>
              <SortableTH direction={orders.sort?.key === "units" ? orders.sort.direction : null} onSort={() => orders.toggleSort("units")}>الوحدات</SortableTH>
              <TH>العناصر</TH>
              <SortableTH direction={orders.sort?.key === "date" ? orders.sort.direction : null} onSort={() => orders.toggleSort("date")}>التاريخ</SortableTH>
            </tr>
          </THead>
          <TBody>
            {orders.sortedRows.map((order) => (
              <TR key={order.orderId}>
                <TD data-cell="lead" className="text-text-strong"><code className="mono text-sm">{order.orderCode}</code></TD>
                <TD data-label="الحالة"><Badge tone={paymentStatusTone[order.paymentStatus]}>{paymentStatusLabel[order.paymentStatus]}</Badge></TD>
                <TD data-label="الإجمالي" className="num whitespace-nowrap font-medium text-text-strong">{formatMoney(order.totalAmount)}</TD>
                <TD data-label="الوحدات" className="num whitespace-nowrap text-text-2">{formatNumber(order.unitsSold)}</TD>
                <TD data-label="العناصر">
                  <ul className="grid gap-0.5 text-sm text-text-2">
                    {order.items.map((item, index) => (
                      <li key={`${order.orderId}-${index}`}>{item.label} × <span className="num">{formatNumber(item.unitsSold)}</span></li>
                    ))}
                  </ul>
                </TD>
                <TD data-label="التاريخ" className="whitespace-nowrap text-text-2">{formatDate(order.createdAt)}</TD>
              </TR>
            ))}
            {orders.sortedRows.length === 0 ? <TableState colSpan={6}><TableEmpty label="لا توجد طلبات بعد." /></TableState> : null}
          </TBody>
        </Table>
      </Card>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="grid gap-1 py-5">
        <span className="text-sm text-text-muted">{label}</span>
        <span className="num text-2xl font-bold text-text-strong">{value}</span>
      </CardBody>
    </Card>
  );
}

function TableEmpty({ label }: { label: string }) {
  return <EmptyState icon={<BarChart3 />} title={label} className="py-8" />;
}
