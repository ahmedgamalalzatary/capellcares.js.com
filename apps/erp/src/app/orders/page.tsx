"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPrice, type PaymentStatus } from "@capella/shared";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canReadErpModule } from "@/lib/erp-permissions";
import { paymentStatusChip, paymentStatusFilterOptions, paymentStatusLabel } from "@/lib/payment-status";
import { useStore } from "@/lib/store";


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
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | "all">("all");

  const filtered = useMemo(() => {
    const byStatus = paymentStatusFilter === "all"
      ? orders
      : orders.filter((o) => o.paymentStatus === paymentStatusFilter);
    if (!search.trim()) return byStatus;
    const term = search.trim().toLowerCase();
    return byStatus.filter((o) =>
      o.orderCode.toLowerCase().includes(term) ||
      o.fullName.toLowerCase().includes(term) ||
      o.phone.includes(term)
    );
  }, [orders, paymentStatusFilter, search]);

  return (
    <AdminShell title="الطلبات" crumbs={[{ label: "الطلبات" }]}>
      <AdminListHeader
        searchPlaceholder="ابحثي بكود الطلب، الاسم، أو رقم الهاتف…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={`${filtered.length} طلب`}
        filters={[
          {
            key: "paymentStatus",
            label: "حالة الدفع",
            value: paymentStatusFilter,
            onChange: (value) => setPaymentStatusFilter(value as PaymentStatus | "all"),
            options: paymentStatusFilterOptions
          }
        ]}
      />

      <div className="card">
        <div className="table-outer">
        <table className="table">
          <thead>
            <tr>
              <th>كود الطلب</th>
              <th>العميل</th>
              <th>الإجمالي</th>
              <th>حالة الدفع</th>
              <th>تاريخ الطلب</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/orders/${order.id}`} className="table-title">
                    <code className="mono fs-12-5">{order.orderCode}</code>
                  </Link>
                </td>
                <td>
                  <div className="fw-600">{order.fullName}</div>
                  <div className="faint cell-subline">{order.phone}</div>
                </td>
                <td className="fw-600 c-accent">{formatPrice(order.totalAmount, "ar")}</td>
                <td><span className={paymentStatusChip[order.paymentStatus]}>{paymentStatusLabel[order.paymentStatus]}</span></td>
                <td className="muted">{new Date(order.createdAt).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td>
                  <Link href={`/orders/${order.id}`} className="btn btn--ghost btn--sm">
                    التفاصيل
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="state-note state-note--lg state-note--muted">
                {orders.length === 0 ? "لا توجد طلبات بعد." : "لا توجد طلبات تطابق البحث."}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </AdminShell>
  );
}
