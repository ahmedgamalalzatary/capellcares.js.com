"use client";

import Link from "next/link";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore } from "@/lib/store";

export default function OrdersPage() {
  const orders = useStore((s) => s.orders);

  return (
    <AdminShell title="الطلبات" crumbs={[{ label: "الطلبات" }]}>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>كود الطلب</th>
              <th>العميل</th>
              <th>الإجمالي</th>
              <th>حالة الدفع</th>
              <th>تاريخ الطلب</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td><Link href={`/orders/${order.id}`} style={{ fontWeight: 600 }}>{order.orderCode}</Link></td>
                <td>
                  <div>{order.fullName}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{order.phone}</div>
                </td>
                <td>{order.totalAmount}</td>
                <td>{order.paymentStatus}</td>
                <td>{new Date(order.createdAt).toLocaleDateString("ar-EG")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>لا توجد طلبات بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
