"use client";

import Link from "next/link";
import { ReceiptText } from "lucide-react";
import type { OrderSummary } from "@capella/shared";
import { TableEmptyRow, TableSkeletonRows } from "@/components/admin/list-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { orderPaymentBadge } from "@/lib/payment-status";
import type { SortState } from "@/hooks/use-table-sort";

export type OrderSortKey = "code" | "customer" | "email" | "total" | "payment" | "date";

export const ORDER_SORT_COLUMNS: Array<{ key: OrderSortKey; label: string }> = [
  { key: "code", label: "كود الطلب" },
  { key: "customer", label: "العميل" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "total", label: "الإجمالي" },
  { key: "payment", label: "حالة الدفع" },
  { key: "date", label: "تاريخ الطلب" }
];

export function OrdersTable({
  loading,
  orders,
  sort,
  onSort,
  emptyTitle,
  emptyDescription
}: {
  loading: boolean;
  /** Rows already filtered and sorted by the page. */
  orders: OrderSummary[];
  sort: SortState<OrderSortKey> | null;
  onSort: (key: OrderSortKey) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            {ORDER_SORT_COLUMNS.map((column) => (
              <SortableTH key={column.key} direction={sort?.key === column.key ? sort.direction : null} onSort={() => onSort(column.key)}>
                {column.label}
              </SortableTH>
            ))}
            <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
          </tr>
        </THead>
        <TBody aria-busy={loading}>
          {loading ? (
            <TableSkeletonRows
              cells={[
                <TD key="lead" data-cell="lead"><Skeleton className="h-3.5 w-28" /></TD>,
                <TD key="customer"><Skeleton className="h-3.5 w-32" /></TD>,
                <TD key="email"><Skeleton className="h-3.5 w-40" /></TD>,
                <TD key="total"><Skeleton className="h-3.5 w-20" /></TD>,
                <TD key="payment"><Skeleton className="h-6 w-24 rounded-full" /></TD>,
                <TD key="date"><Skeleton className="h-3.5 w-24" /></TD>,
                <TD key="actions" data-cell="actions" />
              ]}
            />
          ) : null}
          {!loading && orders.map((order) => {
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
                <TD data-label="تاريخ الطلب" className="whitespace-nowrap text-text-2">{formatDate(order.createdAt)}</TD>
                <TD data-cell="actions">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/orders/${order.id}`}>التفاصيل</Link>
                  </Button>
                </TD>
              </TR>
            );
          })}
          {!loading && orders.length === 0 ? (
            <TableEmptyRow colSpan={7} icon={<ReceiptText />} title={emptyTitle} description={emptyDescription} />
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
