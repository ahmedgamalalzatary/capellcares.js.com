"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/shell/admin-shell";
import { getStore } from "@/lib/store";

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<any>(null);
  const orderId = Number(id);

  useEffect(() => {
    void getStore().fetchOrder(orderId).then(setOrder);
  }, [orderId]);

  return (
    <AdminShell title="تفاصيل الطلب" crumbs={[{ label: "الطلبات", href: "/orders" }, { label: order?.orderCode ?? id }]}>
      {!order ? (
        <div className="card" style={{ padding: 24 }}>جارٍ التحميل…</div>
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
                  if (orderId == null) return;
                  const paymentStatus = e.target.value as "pending" | "accepted" | "denied";
                  await getStore().updateOrderPaymentStatus(orderId, paymentStatus);
                  setOrder((prev: any) => ({ ...prev, paymentStatus }));
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
                {order.items.map((item: any) => (
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
