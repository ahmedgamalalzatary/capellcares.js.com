"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";
import type { PaymentStatus } from "@capella/shared";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { canReadErpModule } from "@/lib/erp-permissions";
import { localDateKey } from "@/lib/format";
import { orderMatchesPaymentStatusFilter, paymentStatusFilterOptions, paymentStatusLabel } from "@/lib/payment-status";
import { useStore } from "@/lib/store";
import { useTableSort } from "@/hooks/use-table-sort";

export default function OrdersPage() {
  const { user } = useAdminAuth();

  if (!canReadErpModule(user, "orders")) {
    return (
      <ForbiddenPage title="الطلبات" crumbs={[{ label: "الطلبات" }]} message="لا تملكين صلاحية الوصول إلى الطلبات." />
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

  // Links such as the dashboard's "awaiting payment" chip open the list pre-filtered with ?payment=<status>. Read after mount so the server render stays unfiltered.
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("payment");
    if (status && Object.hasOwn(paymentStatusLabel, status)) setPaymentStatusFilter(status as PaymentStatus);
  }, []);

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

      <OrdersTable
        loading={!loaded}
        orders={sortedRows}
        sort={sort}
        onSort={toggleSort}
        emptyTitle={orders.length === 0 ? "لا توجد طلبات بعد" : "لا توجد طلبات تطابق البحث"}
        emptyDescription={orders.length === 0 ? "ستظهر الطلبات هنا بمجرد وصولها من المتجر." : "جرّبي كلمة أخرى أو غيّري فلتر الدفع أو التاريخ."}
      />
    </AdminShell>
  );
}
