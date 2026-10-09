"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";
import type { PaymentStatus } from "@capella/shared";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canReadErpModule } from "@/lib/erp-permissions";
import { formatMoney } from "@/lib/format";
import { orderMatchesPaymentStatusFilter, orderPaymentBadge, paymentStatusFilterOptions } from "@/lib/payment-status";
import { useStore } from "@/lib/store";
import { useTableSort } from "@/hooks/use-table-sort";

type OrderSortKey = "code" | "customer" | "email" | "total" | "payment" | "date";

const ORDER_SORT_COLUMNS: Array<{ key: OrderSortKey; label: string }> = [
  { key: "code", label: "كود الطلب" },
  { key: "customer", label: "العميل" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "total", label: "الإجمالي" },
  { key: "payment", label: "حالة الدفع" },
  { key: "date", label: "تاريخ الطلب" }
];

function localDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOrderDate(value: string) {
  return new Date(value).toLocaleDateString("ar-EG-u-nu-latn", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OrdersPage() {
  const { user } = useAdminAuth();

  if (!canReadErpModule(user, "orders")) {
    return (
      <AdminShell title="الطلبات" crumbs={[{ label: "الطلبات" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى الطلبات." />
      </AdminShell>
    );
  }

  return <OrdersPageContent />;
}

function OrdersPageContent() {
  const orders = useStore((s) => s.orders);
  const loaded = useStore((s) => s.loaded);
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = useMemo(() => {
    const byStatus = paymentStatusFilter === "all"
      ? orders
      : orders.filter((order) => orderMatchesPaymentStatusFilter(order, paymentStatusFilter));
    const byDate = byStatus.filter((order) => {
      const orderDate = localDateKey(order.createdAt);
      return (!fromDate || orderDate >= fromDate) && (!toDate || orderDate <= toDate);
    });
    if (!search.trim()) return byDate;
    const term = search.trim().toLowerCase();
    return byDate.filter((order) =>
      order.orderCode.toLowerCase().includes(term) ||
      order.fullName.toLowerCase().includes(term) ||
      order.email.toLowerCase().includes(term) ||
      order.phone.includes(term)
    );
  }, [fromDate, orders, paymentStatusFilter, search, toDate]);

  const { sort, toggleSort, sortedRows } = useTableSort(filtered, {
    code: (order) => order.orderCode,
    customer: (order) => order.fullName,
    email: (order) => order.email,
    total: (order) => order.totalAmount,
    payment: (order) => order.paymentStatus,
    date: (order) => order.createdAt
  });

  return (
    <AdminShell
      title="الطلبات"
      crumbs={[{ label: "الطلبات" }]}
      description="كل طلبات المتجر وحالة دفعها وتفاصيلها."
      actions={
        <Button asChild variant="secondary">
          <Link href="/orders/reconciliation"><ReceiptText /> مدفوعات قيد المراجعة</Link>
        </Button>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي بكود الطلب، الاسم، البريد، أو الهاتف…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={loaded ? `${filtered.length} طلب` : "جارٍ التحميل…"}
        filters={[
          {
            key: "paymentStatus",
            label: "حالة الدفع",
            value: paymentStatusFilter,
            onChange: (value) => setPaymentStatusFilter(value as PaymentStatus | "all"),
            options: paymentStatusFilterOptions
          }
        ]}
        customFilters={
          <>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-text-2">من تاريخ</span>
              <Input aria-label="من تاريخ" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-text-2">إلى تاريخ</span>
              <Input aria-label="إلى تاريخ" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              {ORDER_SORT_COLUMNS.map((column) => (
                <SortableTH key={column.key} direction={sort?.key === column.key ? sort.direction : null} onSort={() => toggleSort(column.key)}>
                  {column.label}
                </SortableTH>
              ))}
              <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
            </tr>
          </THead>
          <TBody aria-busy={!loaded}>
            {!loaded ? Array.from({ length: 5 }, (_, index) => (
              <TR key={index} aria-hidden>
                <TD data-cell="lead"><Skeleton className="h-3.5 w-28" /></TD>
                <TD><Skeleton className="h-3.5 w-32" /></TD>
                <TD><Skeleton className="h-3.5 w-40" /></TD>
                <TD><Skeleton className="h-3.5 w-20" /></TD>
                <TD><Skeleton className="h-6 w-24 rounded-full" /></TD>
                <TD><Skeleton className="h-3.5 w-24" /></TD>
                <TD data-cell="actions" />
              </TR>
            )) : null}
            {loaded && sortedRows.map((order) => {
              const payment = orderPaymentBadge(order);
              return (
                <TR key={order.id}>
                  <TD data-cell="lead">
                    <Link href={`/orders/${order.id}`} className="font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">
                      <code className="mono text-sm">{order.orderCode}</code>
                    </Link>
                  </TD>
                  <TD data-label="العميل">
                    <span className="block font-medium text-text-strong">{order.fullName}</span>
                    <span dir="ltr" className="block text-end text-sm text-text-muted">{order.phone}</span>
                  </TD>
                  <TD data-label="البريد الإلكتروني">
                    <a href={`mailto:${order.email}`} dir="ltr" className="text-text-2 decoration-line-strong underline-offset-4 hover:underline">{order.email}</a>
                  </TD>
                  <TD data-label="الإجمالي" className="whitespace-nowrap">
                    <span className="num font-medium text-text-strong">{formatMoney(order.totalAmount)}</span>
                  </TD>
                  <TD data-label="حالة الدفع"><Badge tone={payment.tone}>{payment.label}</Badge></TD>
                  <TD data-label="تاريخ الطلب" className="whitespace-nowrap text-text-2">{formatOrderDate(order.createdAt)}</TD>
                  <TD data-cell="actions">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/orders/${order.id}`}>التفاصيل</Link>
                    </Button>
                  </TD>
                </TR>
              );
            })}
            {loaded && sortedRows.length === 0 ? (
              <TableState colSpan={7}>
                <EmptyState
                  icon={<ReceiptText />}
                  title={orders.length === 0 ? "لا توجد طلبات بعد" : "لا توجد طلبات تطابق البحث"}
                  description={orders.length === 0 ? "ستظهر الطلبات هنا بمجرد وصولها من المتجر." : "جرّبي كلمة أخرى أو غيّري فلتر الدفع أو التاريخ."}
                />
              </TableState>
            ) : null}
          </TBody>
        </Table>
      </Card>
    </AdminShell>
  );
}
