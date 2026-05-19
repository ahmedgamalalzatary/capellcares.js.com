"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Order, PaymentStatus } from "@capella/shared";
import { AdminShell } from "@/components/shell/admin-shell";
import { getStore } from "@/lib/store";

export function OrderDetailsView({ orderId, crumbLabel }: { orderId: number; crumbLabel: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    void getStore().fetchOrder(orderId).then((value) => {
      if (cancelled) return;
      setOrder(value);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError("تعذر تحميل تفاصيل الطلب. حاولي مرة أخرى.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <AdminShell title="تفاصيل الطلب" crumbs={[{ label: "الطلبات", href: "/orders" }, { label: order?.orderCode ?? crumbLabel }]}>
      {loading ? (
        <div className="card" style={{ padding: 24 }}>جارٍ التحميل…</div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: "var(--danger)" }}>{error}</div>
      ) : !order ? (
        <div className="card" style={{ padding: 24 }}>لا يمكن العثور على هذا الطلب.</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
            <div><strong>كود الطلب:</strong> {order.orderCode}</div>
            <div><strong>العميل:</strong> {order.fullName} - {order.phone}</div>
            <div><strong>العنوان:</strong> {order.governorate} / {order.cityArea} / {order.addressLine}</div>
            <div className="row" style={{ gap: 12 }}>
              <select
                className="select"
                value={order.paymentStatus}
                onChange={async (e) => {
                  const paymentStatus = e.target.value as PaymentStatus;
                  await getStore().updateOrderPaymentStatus(orderId, paymentStatus);
                  setOrder((prev) => prev ? { ...prev, paymentStatus } : prev);
                }}
              >
                <option value="pending">قيد الانتظار</option>
                <option value="accepted">مقبول</option>
                <option value="denied">مرفوض</option>
              </select>
              <Link href="/orders" className="btn btn--ghost btn--sm">رجوع</Link>
            </div>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>العنصر</th>
                  <th>النوع</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.snapshotNameAr ?? item.snapshotNameEn ?? "—"}</td>
                    <td>{item.itemType}</td>
                    <td>{item.qty}</td>
                    <td>{item.unitPrice}</td>
                    <td>{item.lineTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
