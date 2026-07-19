"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canReadErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";

function statusChip(status: string) {
  const s = status.toLowerCase();
  if (s.includes("paid") || s.includes("delivered") || s.includes("complete")) return "status status--active";
  if (s.includes("pending") || s.includes("processing")) return "status status--draft";
  if (s.includes("cancel") || s.includes("fail")) return "status status--deleted";
  return "status";
}

export default function OrdersPage() {
  const { user } = useAdminAuth();

  if (!canReadErpModule(user, "orders")) {
    return (
      <AdminShell title="الطلبات" crumbs={[{ label: "الطلبات" }]}>
        <ErpForbiddenState message="لا تملك صلاحية الوصول إلى الطلبات." />
      </AdminShell>
    );
  }

  return <OrdersPageContent />;
}

function OrdersPageContent() {
  const orders = useStore((s) => s.orders);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const term = search.trim().toLowerCase();
    return orders.filter((o) =>
      o.orderCode.toLowerCase().includes(term) ||
      o.fullName.toLowerCase().includes(term) ||
      o.phone.includes(term)
    );
  }, [orders, search]);

  return (
    <AdminShell title="الطلبات" crumbs={[{ label: "الطلبات" }]}>
      <div className="toolbar">
        <div className="search">
          <Icon.Search />
          <input
            placeholder="ابحثي بكود الطلب، الاسم، أو رقم الهاتف…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ marginInlineStart: "auto" }} className="muted">{filtered.length} طلب</div>
      </div>

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
                    <code className="mono" style={{ fontSize: 12.5 }}>{order.orderCode}</code>
                  </Link>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{order.fullName}</div>
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{order.phone}</div>
                </td>
                <td style={{ fontWeight: 600, color: "var(--accent)" }}>{order.totalAmount}</td>
                <td><span className={statusChip(order.paymentStatus)}>{order.paymentStatus}</span></td>
                <td className="muted">{new Date(order.createdAt).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td>
                  <Link href={`/orders/${order.id}`} className="btn btn--ghost btn--sm">
                    التفاصيل
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>
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
