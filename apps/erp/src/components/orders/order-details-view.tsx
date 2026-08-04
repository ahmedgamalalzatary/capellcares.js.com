"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Order, PaymentStatus } from "@capella/shared";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { hasErpPermission } from "@/lib/erp-permissions";
import { getStore } from "@/lib/store";

function statusChip(status: string) {
  const s = status.toLowerCase();
  if (s.includes("accept") || s.includes("paid")) return "status status--active";
  if (s.includes("pending") || s.includes("processing")) return "status status--draft";
  if (s.includes("deny") || s.includes("cancel") || s.includes("fail")) return "status status--deleted";
  return "status";
}

export function OrderDetailsView({ orderId, crumbLabel }: { orderId: number; crumbLabel: string }) {
  const { user } = useAdminAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!hasErpPermission(user, "orders.read")) {
    return (
      <AdminShell
        title="تفاصيل الطلب"
        crumbs={[{ label: "الطلبات", href: "/orders" }, { label: "غير مصرح" }]}
        actions={<Link href="/orders" className="btn btn--ghost btn--sm">رجوع للطلبات</Link>}
      >
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى الطلبات." />
      </AdminShell>
    );
  }

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

  const canUpdatePaymentStatus = hasErpPermission(user, "orders.update_payment_status");
  const paymentStatusLocked = order?.paymentStatus === "denied";

  return (
    <AdminShell
      title="تفاصيل الطلب"
      crumbs={[{ label: "الطلبات", href: "/orders" }, { label: order?.orderCode ?? crumbLabel }]}
      actions={<Link href="/orders" className="btn btn--ghost btn--sm">رجوع للطلبات</Link>}
    >
      {loading ? (
        <div className="card state-note state-note--lg state-note--muted">جارٍ تحميل تفاصيل الطلب…</div>
      ) : error ? (
        <div className="card card--pad-lg c-error">{error}</div>
      ) : !order ? (
        <div className="card state-note state-note--lg state-note--muted">لا يمكن العثور على هذا الطلب.</div>
      ) : (
        <div className="order-details">
          {/* Hero card */}
          <div className="card order-hero">
            <div>
              <div className="eyebrow order-hero__eyebrow">كود الطلب</div>
              <div className="order-hero__code">
                {order.orderCode}
              </div>
              <div className="row row--wrap order-hero__meta">
                <span className={statusChip(order.paymentStatus)}>{order.paymentStatus}</span>
                <span className="order-hero__sep">·</span>
                <span className="order-hero__total">
                  الإجمالي:{" "}
                  <span className="order-hero__amount">{order.totalAmount}</span>
                </span>
                <span className="order-hero__sep">·</span>
                <span className="order-hero__date">
                  {new Date(order.createdAt).toLocaleDateString("ar-EG", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
            <div className="order-hero__status">
              <label htmlFor="order-payment-status" className="eyebrow">حاله الدفع</label>
              <select
                id="order-payment-status"
                className="select"
                value={order.paymentStatus}
                disabled={!canUpdatePaymentStatus || paymentStatusLocked}
                onChange={async (e) => {
                  if (!canUpdatePaymentStatus || paymentStatusLocked) {
                    return;
                  }
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
          <div className="order-cards">
            <div className="card card--pad-md">
              <div className="eyebrow order-card__label">العميل</div>
              <div className="order-card__name">{order.fullName}</div>
              <div className="order-card__phone">{order.phone}</div>
            </div>
            <div className="card card--pad-md">
              <div className="eyebrow order-card__label">عنوان التوصيل</div>
              <div className="order-card__address">
                {order.governorate} <span className="order-card__sep">·</span>{" "}
                {order.cityArea}
              </div>
              <div className="order-card__address-line">{order.addressLine}</div>
            </div>
          </div>

          {/* Items */}
          <div className="card">
            <div className="card__head">
              <h3 className="card__title">عناصر الطلب</h3>
              <span className="muted fs-12">{order.items.length} عنصر</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>العنصر</th>
                  <th>النوع</th>
                  <th className="cell-center cell-w-80">الكمية</th>
                  <th className="cell-end cell-w-120">السعر</th>
                  <th className="cell-end cell-w-120">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="fw-600">{item.snapshotNameAr ?? item.snapshotNameEn ?? "—"}</div>
                      {item.snapshotNameEn && item.snapshotNameAr && (
                        <div className="faint cell-subline">{item.snapshotNameEn}</div>
                      )}
                    </td>
                    <td className="muted fs-12-5">{item.itemType}</td>
                    <td className="cell-center">×{item.qty}</td>
                    <td className="cell-end">{item.unitPrice}</td>
                    <td className="cell-end fw-700 c-ink">{item.lineTotal}</td>
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
