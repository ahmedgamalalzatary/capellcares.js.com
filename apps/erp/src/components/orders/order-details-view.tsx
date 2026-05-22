"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Order, PaymentStatus } from "@capella/shared";
import { AdminShell } from "@/components/shell/admin-shell";
import { getStore } from "@/lib/store";

function statusChip(status: string) {
  const s = status.toLowerCase();
  if (s.includes("accept") || s.includes("paid")) return "status status--active";
  if (s.includes("pending") || s.includes("processing")) return "status status--draft";
  if (s.includes("deny") || s.includes("cancel") || s.includes("fail")) return "status status--deleted";
  return "status";
}

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
    <AdminShell
      title="تفاصيل الطلب"
      crumbs={[{ label: "الطلبات", href: "/orders" }, { label: order?.orderCode ?? crumbLabel }]}
      actions={<Link href="/orders" className="btn btn--ghost btn--sm">رجوع للطلبات</Link>}
    >
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>جارٍ تحميل تفاصيل الطلب…</div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: "var(--error)" }}>{error}</div>
      ) : !order ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>لا يمكن العثور على هذا الطلب.</div>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {/* Hero card */}
          <div className="card" style={{ padding: 28, display: "grid", gap: 16, gridTemplateColumns: "1fr auto", alignItems: "start" }}>
            <div>
              <div className="eyebrow" style={{ color: "var(--accent)", marginBottom: 10 }}>كود الطلب</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                {order.orderCode}
              </div>
              <div className="row" style={{ gap: 12, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
                <span className={statusChip(order.paymentStatus)}>{order.paymentStatus}</span>
                <span style={{ color: "var(--ink-3)", fontSize: 12.5 }}>·</span>
                <span style={{ fontSize: 13 }}>
                  الإجمالي:{" "}
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>{order.totalAmount}</span>
                </span>
                <span style={{ color: "var(--ink-3)", fontSize: 12.5 }}>·</span>
                <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  {new Date(order.createdAt).toLocaleDateString("ar-EG", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label className="eyebrow" style={{ color: "var(--ink-3)", fontSize: 10.5 }}>حاله الدفع</label>
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
            </div>
          </div>

          {/* Customer + address grid */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
            <div className="card" style={{ padding: 22 }}>
              <div className="eyebrow" style={{ color: "var(--ink-3)", marginBottom: 12 }}>العميل</div>
              <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--ink)" }}>{order.fullName}</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, fontFamily: "var(--font-mono)" }}>{order.phone}</div>
            </div>
            <div className="card" style={{ padding: 22 }}>
              <div className="eyebrow" style={{ color: "var(--ink-3)", marginBottom: 12 }}>عنوان التوصيل</div>
              <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.7 }}>
                {order.governorate} <span style={{ color: "var(--ink-3)" }}>·</span>{" "}
                {order.cityArea}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>{order.addressLine}</div>
            </div>
          </div>

          {/* Items */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card__head">
              <h3 className="card__title">عناصر الطلب</h3>
              <span className="muted" style={{ fontSize: 12 }}>{order.items.length} عنصر</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>العنصر</th>
                  <th>النوع</th>
                  <th style={{ textAlign: "center", width: 80 }}>الكمية</th>
                  <th style={{ textAlign: "end", width: 120 }}>السعر</th>
                  <th style={{ textAlign: "end", width: 120 }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.snapshotNameAr ?? item.snapshotNameEn ?? "—"}</div>
                      {item.snapshotNameEn && item.snapshotNameAr && (
                        <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{item.snapshotNameEn}</div>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{item.itemType}</td>
                    <td style={{ textAlign: "center" }}>×{item.qty}</td>
                    <td style={{ textAlign: "end" }}>{item.unitPrice}</td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: "var(--ink)" }}>{item.lineTotal}</td>
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
