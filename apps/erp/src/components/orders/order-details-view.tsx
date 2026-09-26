"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { AdminOrderDto, AdminOrderShippingStateDto, PaymentStatus } from "@capella/shared";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { hasErpPermission } from "@/lib/erp-permissions";
import { orderPaymentDisplay, paymentStatusLabel } from "@/lib/payment-status";
import { getStore } from "@/lib/store";
import { formatOrderAmount } from "@/lib/order-format";
import "./order-details.css";

const manualStateLabels = { preparing: "جارٍ التجهيز", ready_for_pickup: "جاهز للاستلام", printed: "تمت الطباعة", delivered: "تم التسليم", returned: "تم الإرجاع" };
const carrierStateLabels = { created: "تم الإنشاء", picked_up: "تم الاستلام", in_transit: "في الطريق", delivered: "تم التسليم", returned: "تم الإرجاع", cancelled: "تم الإلغاء", exception: "تحتاج متابعة" };
const custodyLabels = { unknown: "الحيازة غير مؤكدة", carrier: "مع شركة الشحن", recipient: "تم التسليم للمستلم", warehouse_uninspected: "راجع للمخزن؛ بانتظار الفحص" };

function ShippingStateDetails({ shipping }: { shipping: AdminOrderShippingStateDto }) {
  const collectionConfirmed = shipping.collection.confirmed && shipping.collection.amountCents !== null;
  return <section className="card" aria-labelledby="order-shipping-state-heading">
    <div className="card__head"><h3 id="order-shipping-state-heading" className="card__title">حالات الشحن</h3></div>
    <div className="order-section-body">
      <dl className="order-fields order-fields--two">
        <Detail label="حالة الموظفة">{shipping.manualState ? `${manualStateLabels[shipping.manualState]} (الموظفة)` : "لا توجد حالة يدوية"}</Detail>
        <Detail label="حالة بوسطة">{shipping.carrierState ? `${carrierStateLabels[shipping.carrierState]} (بوسطة)` : "بانتظار إنشاء الشحنة"}</Detail>
        <Detail label="حيازة الشحنة">{custodyLabels[shipping.custodyState]}</Detail>
        <Detail label="إثبات التحصيل">{collectionConfirmed ? "التحصيل مؤكد" : "التحصيل غير مؤكد"}</Detail>
        <Detail label="المبلغ المحصل">{shipping.collection.amountCents !== null ? formatOrderAmount(shipping.collection.amountCents / 100) : "غير متوفر"}</Detail>
        {shipping.processing.startedAtMs !== null && <Detail label="بدء المعالجة"><OrderDate value={new Date(shipping.processing.startedAtMs).toISOString()} /></Detail>}
      </dl>
      {shipping.processing.addressBlockedAtMs !== null && <p className="order-note">مشكلة عنوان قبل الاستلام؛ المهلة الأصلية قائمة</p>}
      <p className="order-note">الحالة اليدوية لا تؤكد الدفع أو استعادة المخزون. الإرجاع يحتاج فحصًا وموافقة قبل إعادة البيع.</p>
      {shipping.history.length > 0 && <div aria-label="سجل حالات الموظفة">
        {shipping.history.map(event => <div key={event.id} className="order-note">
          <strong>{manualStateLabels[event.state]}</strong>{" — "}
          <OrderDate value={new Date(event.atMs).toISOString()} />{" — "}
          {event.actorType === "staff" ? `الموظفة #${event.actorId ?? "—"}` : "النظام"}
          {event.reason && <p>{event.reason}</p>}
        </div>)}
      </div>}
    </div>
  </section>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="order-detail-field"><dt>{label}</dt><dd>{children ?? "غير متوفر"}</dd></div>;
}

function OrderDate({ value }: { value?: string | null }) {
  if (!value || Number.isNaN(new Date(value).getTime())) return <>غير متوفر</>;
  return <time dateTime={value}>{new Date(value).toLocaleString("ar-EG", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo"
  })}</time>;
}

export function OrderDetailsView({ orderId, crumbLabel }: { orderId: number; crumbLabel: string }) {
  const { user } = useAdminAuth();
  if (!hasErpPermission(user, "orders.read")) {
    return (
      <AdminShell title="تفاصيل الطلب"
        crumbs={[{ label: "الطلبات", href: "/orders" }, { label: "غير مصرح" }]}
        actions={<Link href="/orders" className="btn btn--ghost btn--sm">رجوع للطلبات</Link>}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى الطلبات." />
      </AdminShell>
    );
  }
  return <OrderDetailsContent key={orderId} orderId={orderId} crumbLabel={crumbLabel}
    canUpdatePaymentStatus={hasErpPermission(user, "orders.update_payment_status")} />;
}

function OrderDetailsContent({ orderId, crumbLabel, canUpdatePaymentStatus }: {
  orderId: number; crumbLabel: string; canUpdatePaymentStatus: boolean;
}) {
  const [order, setOrder] = useState<AdminOrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getStore().fetchOrder(orderId).then((value) => {
      if (!cancelled) setOrder(value);
    }).catch(() => {
      if (!cancelled) setError("تعذر تحميل تفاصيل الطلب. حاولي مرة أخرى.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [orderId, reload]);

  async function updatePaymentStatus(paymentStatus: PaymentStatus) {
    if (!order || order.paymentMethod === "paymob" || !canUpdatePaymentStatus ||
      order.paymentStatus === "denied" || savingRef.current || paymentStatus === order.paymentStatus) return;
    if ((order.shipping || order.shippingQuoteId || (order.shippingAmountCents ?? 0) > 0) && paymentStatus !== "denied") return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await getStore().updateOrderPaymentStatus(orderId, paymentStatus);
      setOrder((previous) => previous ? { ...previous, paymentStatus } : previous);
      setSaved(true);
      setReload((value) => value + 1);
    } catch {
      setSaveError("تعذر تحديث حالة الدفع. أعيدي تحميل الطلب للتحقق من حالته قبل المحاولة مرة أخرى.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const paymentDisplay = order ? orderPaymentDisplay(order) : null;
  const shippingPaymentManaged = Boolean(order?.shipping || order?.shippingQuoteId || (order?.shippingAmountCents ?? 0) > 0);
  const refunded = order?.paymentMethod === "paymob" ? (order.refundedAmountCents ?? 0) : 0;
  const savings = order?.items.reduce((sum, item) => sum + Math.max(0,
    Math.round((item.snapshotBaseUnitPrice ?? item.unitPrice) * 100) - Math.round(item.unitPrice * 100)) * item.qty, 0) ?? 0;

  return (
    <AdminShell title="تفاصيل الطلب"
      crumbs={[{ label: "الطلبات", href: "/orders" }, { label: order?.orderCode ?? crumbLabel }]}
      actions={<Link href="/orders" className="btn btn--ghost btn--sm">رجوع للطلبات</Link>}>
      {loading ? (
        <div className="card state-note state-note--lg state-note--muted" role="status">جارٍ تحميل تفاصيل الطلب…</div>
      ) : error ? (
        <div className="card card--pad-lg stack">
          <p className="c-error" role="alert">{error}</p>
          <button className="btn" onClick={() => setReload((value) => value + 1)}>إعادة المحاولة</button>
        </div>
      ) : !order ? (
        <div className="card state-note state-note--lg state-note--muted">لا يمكن العثور على هذا الطلب.</div>
      ) : (
        <div className="order-details">
          <header className="order-overview">
            <div>
              <p className="order-overview__label">كود الطلب</p>
              <h2 className="order-overview__code" dir="ltr">{order.orderCode}</h2>
              <p className="order-overview__date"><OrderDate value={order.createdAt} /></p>
            </div>
            <div className="order-overview__status">
              <span className={paymentDisplay?.chip}>{paymentDisplay?.label}</span>
              <span className="muted">{order.paymentMethod === "paymob" ? "دفع إلكتروني عبر باي موب" : "الدفع عند الاستلام"}</span>
            </div>
          </header>

          <div className="order-detail-layout">
            <div className="order-detail-main">
              <section className="card" aria-labelledby="order-items-heading">
                <div className="card__head">
                  <h3 id="order-items-heading" className="card__title">عناصر الطلب</h3>
                  <span className="muted">{order.items.length} عنصر / {order.items.reduce((sum, item) => sum + item.qty, 0)} إجمالي الكميات</span>
                </div>
                <div className="table-outer">
                  <table className="table order-items-table">
                    <thead><tr>
                      <th scope="col">العنصر</th>
                      <th scope="col">الكمية</th>
                      <th scope="col">سعر الوحدة</th>
                      <th scope="col">الإجمالي</th>
                    </tr></thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className="order-item__type">{item.itemType === "offer" ? "عرض" : item.itemType === "collection" ? "مجموعة" : "منتج"}</span>
                            <div className="order-item__name">{item.snapshotNameAr || item.snapshotNameEn || "عنصر غير مسمى"}</div>
                            {item.snapshotNameEn && item.snapshotNameAr && <div className="muted cell-subline" dir="auto">{item.snapshotNameEn}</div>}
                            {item.snapshotSizeLabel && <div className="order-item__size" dir="auto">{item.snapshotSizeLabel}</div>}
                          </td>
                          <td><span className="order-item__quantity">{item.qty}</span></td>
                          <td className="order-money">
                            {item.snapshotBaseUnitPrice != null && item.snapshotBaseUnitPrice > item.unitPrice && (
                              <del className="order-item__base-price" aria-label="سعر الوحدة قبل الخصم">{formatOrderAmount(item.snapshotBaseUnitPrice)}</del>
                            )}
                            {formatOrderAmount(item.unitPrice)}
                          </td>
                          <td className="order-money fw-700">{formatOrderAmount(item.lineTotal)}</td>
                        </tr>
                      ))}
                      {order.items.length === 0 && <tr><td colSpan={4} className="state-note">لا توجد عناصر مسجلة لهذا الطلب.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <section className="order-amounts" aria-label="ملخص المبالغ">
                  <dl>
                    {savings > 0 && <Detail label="التوفير على المنتجات"><span className="order-money">{formatOrderAmount(savings / 100)}</span></Detail>}
                    <Detail label="إجمالي الطلب"><strong className="order-money">{formatOrderAmount(order.totalAmount)}</strong></Detail>
                    {refunded > 0 && <>
                      <Detail label="المبلغ المسترد"><span className="order-money">{formatOrderAmount(refunded / 100)}</span></Detail>
                      <Detail label="الصافي بعد الاسترداد"><strong className="order-money">{formatOrderAmount((Math.round(order.totalAmount * 100) - refunded) / 100)}</strong></Detail>
                    </>}
                  </dl>
                </section>
              </section>

              {order.shipping && <ShippingStateDetails shipping={order.shipping} />}

              <section className="card" aria-labelledby="order-payment-heading">
                <div className="card__head"><h3 id="order-payment-heading" className="card__title">تفاصيل الدفع</h3></div>
                <div className="order-section-body">
                  {order.paymentMethod === "paymob" ? <>
                    <p className="order-note">تُحدّث حالة الدفع تلقائيًا من باي موب. تتم عمليات الاسترداد من لوحة باي موب.</p>
                    {order.payment ? <dl className="order-fields order-fields--two">
                      <Detail label="وسيلة الدفع">{order.payment.paymentMethod === "card" ? "بطاقة بنكية" : order.payment.paymentMethod === "wallet" ? "محفظة إلكترونية" : "غير متوفر"}</Detail>
                      <Detail label="بيئة الدفع"><span className={order.payment.environment === "test" ? "status status--draft" : "status status--active"}>{order.payment.environment === "test" ? "تجريبي" : "فعلي"}</span></Detail>
                      <Detail label="رقم المعاملة في باي موب"><bdi>{order.payment.paymobTransactionId ?? "غير متوفر"}</bdi></Detail>
                      <Detail label="رقم الطلب في باي موب"><bdi>{order.payment.paymobOrderId ?? "غير متوفر"}</bdi></Detail>
                      <Detail label="مرجع الدفع"><bdi>{order.payment.merchantReference}</bdi></Detail>
                      <Detail label="رقم تكامل الدفع"><bdi>{order.payment.integrationId ?? "غير متوفر"}</bdi></Detail>
                      <Detail label="رقم محاولة الدفع">{order.payment.attemptNumber}</Detail>
                      <Detail label="بدء محاولة الدفع"><OrderDate value={order.payment.createdAt} /></Detail>
                    </dl> : <p className="muted">تفاصيل معاملة باي موب غير متوفرة لهذا الطلب.</p>}
                  </> : <>
                    <div className="order-payment-control">
                      <div className="field">
                        <label htmlFor="order-payment-status">حالة الدفع عند الاستلام</label>
                        <select id="order-payment-status" className="select" value={order.paymentStatus}
                          disabled={!canUpdatePaymentStatus || order.paymentStatus === "denied" || saving}
                          onChange={(event) => { void updatePaymentStatus(event.target.value as PaymentStatus); }}>
                          {(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((status) => (
                            <option key={status} value={status} disabled={shippingPaymentManaged && status !== "denied"}>{paymentStatusLabel[status]}</option>
                          ))}
                        </select>
                      </div>
                      <p className="order-note">{order.paymentStatus === "denied" ? "الطلب مرفوض؛ لا يمكن تغيير حالة الدفع بعد الرفض."
                        : !canUpdatePaymentStatus ? "لديكِ صلاحية عرض الطلب فقط."
                          : shippingPaymentManaged ? "تُحدّث حالة الدفع من تحصيل بوسطة. الرفض يحتاج تأكيد الإلغاء وحيازة المخزون."
                            : "رفض الطلب يعيد الكميات إلى المخزون ويمنع تغيير حالته لاحقًا."}</p>
                    </div>
                    <div aria-live="polite">{saving ? <p className="order-note">جارٍ حفظ حالة الدفع…</p> : saved ? <p className="order-note">تم تحديث حالة الدفع.</p> : null}</div>
                    {saveError && <div className="order-save-error">
                      <p role="alert">{saveError}</p>
                      <button className="btn btn--sm" onClick={() => { setSaveError(null); setSaved(false); setReload((value) => value + 1); }}>إعادة تحميل الطلب</button>
                    </div>}
                  </>}
                </div>
              </section>

              <section className="order-record" aria-labelledby="order-record-heading">
                <div className="order-record__heading"><h3 id="order-record-heading">بيانات الطلب</h3><span>التوقيت المحلي للقاهرة</span></div>
                <dl className="order-fields order-fields--two">
                  <Detail label="رقم الطلب الداخلي"><bdi>#{order.id}</bdi></Detail>
                  <Detail label="آخر تحديث"><OrderDate value={order.updatedAt} /></Detail>
                  {order.paymentMethod !== "paymob" && order.paymentStatus === "pending" && order.codExpiresAt && (!order.shipping || order.shipping.processing.untouchedExpiryApplies) && (
                    <Detail label="مهلة مراجعة الدفع عند الاستلام"><OrderDate value={order.codExpiresAt} /></Detail>
                  )}
                </dl>
              </section>
            </div>

            <aside className="order-detail-side" aria-label="بيانات العميل والتوصيل">
              <section className="card" aria-labelledby="order-customer-heading">
                <div className="card__head"><h3 id="order-customer-heading" className="card__title">بيانات العميل</h3>
                  <span className="order-customer-type">{order.customerType === "registered" ? "عميل مسجل" : "ضيف"}</span></div>
                <div className="order-section-body">
                  <p className="order-customer-name">{order.fullName}</p>
                  <dl className="order-fields">
                    <Detail label="رقم الهاتف"><a className="order-contact" dir="ltr" href={`tel:${order.phone}`}>{order.phone}</a></Detail>
                    <Detail label="البريد الإلكتروني عند الطلب">{order.email ? <a className="order-contact" dir="ltr" href={`mailto:${order.email}`}>{order.email}</a> : "غير متوفر"}</Detail>
                    {order.customerId != null && <Detail label="رقم حساب العميل"><bdi>#{order.customerId}</bdi></Detail>}
                  </dl>
                </div>
              </section>
              <section className="card" aria-labelledby="order-delivery-heading">
                <div className="card__head"><h3 id="order-delivery-heading" className="card__title">عنوان التوصيل</h3></div>
                <dl className="order-fields order-section-body">
                  <Detail label="المحافظة">{order.governorate}</Detail>
                  <Detail label="المدينة / المنطقة">{order.cityArea}</Detail>
                  <Detail label="العنوان">{order.addressLine}</Detail>
                  <Detail label="المبنى / الشقة">{order.buildingApartment}</Detail>
                </dl>
              </section>
              <section className="order-customer-notes" aria-labelledby="order-notes-heading">
                <h3 id="order-notes-heading">ملاحظات العميل</h3>
                <p>{order.notes?.trim() ? order.notes : "لا توجد ملاحظات من العميل."}</p>
              </section>
            </aside>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
