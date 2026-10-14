"use client";

import { BarChart3 } from "lucide-react";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canReadErpModule } from "@/lib/erp-permissions";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { paymentStatusLabel, paymentStatusTone } from "@/lib/payment-status";
import { useStore } from "@/lib/store";
import { SmartPagination } from "@/components/admin/smart-pagination";
import { useLocalList } from "@/hooks/use-paginated-list";
import type { ListSchema } from "@/lib/pagination";
import type { SalesAnalytics } from "@/lib/store/types";

const productAccessors = {
  name: (item: SalesAnalytics["productTotals"][number]) => item.productName,
  units: (item: SalesAnalytics["productTotals"][number]) => item.unitsSold,
  revenue: (item: SalesAnalytics["productTotals"][number]) => item.revenue
};
const variantAccessors = {
  name: (item: SalesAnalytics["variantTotals"][number]) => `${item.productName} ${item.variantLabel}`,
  units: (item: SalesAnalytics["variantTotals"][number]) => item.unitsSold,
  revenue: (item: SalesAnalytics["variantTotals"][number]) => item.revenue
};
const orderAccessors = {
  code: (item: SalesAnalytics["orders"][number]) => item.orderCode,
  status: (item: SalesAnalytics["orders"][number]) => item.paymentStatus,
  total: (item: SalesAnalytics["orders"][number]) => item.totalAmount,
  units: (item: SalesAnalytics["orders"][number]) => item.unitsSold,
  date: (item: SalesAnalytics["orders"][number]) => item.createdAt
};

const TOTALS_LIST = { filters: {}, sortKeys: ["name", "units", "revenue"] } satisfies ListSchema<never, keyof typeof productAccessors>;
const ORDERS_LIST = { filters: {}, sortKeys: ["code", "status", "total", "units", "date"] } satisfies ListSchema<never, keyof typeof orderAccessors>;


export default function SalesPage() {
  const { user } = useAdminAuth();

  if (!canReadErpModule(user, "sales")) {
    return (
      <ForbiddenPage title="المبيعات" crumbs={[{ label: "المبيعات" }]} message="لا تملكين صلاحية الوصول إلى المبيعات." />
    );
  }

  return <SalesPageContent />;
}

function SalesPageContent() {
  const sales = useStore((s) => s.sales);
  const loaded = useStore((s) => s.loaded);

  const products = useLocalList(sales.productTotals, productAccessors, { listId: "sales-products", schema: TOTALS_LIST, paramPrefix: "products_" });
  const variants = useLocalList(sales.variantTotals, variantAccessors, { listId: "sales-variants", schema: TOTALS_LIST, paramPrefix: "variants_" });
  const orders = useLocalList(sales.orders, orderAccessors, { listId: "sales-orders", schema: ORDERS_LIST });

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
        <div className="min-w-0">
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
        <SmartPagination {...products.paginationProps(products.total, !loaded)} />
        </div>

        <div className="min-w-0">
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
        <SmartPagination {...variants.paginationProps(variants.total, !loaded)} />
        </div>
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
      <SmartPagination {...orders.paginationProps(orders.total, !loaded)} />
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
