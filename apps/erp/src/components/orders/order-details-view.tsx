"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import type { AdminOrderDto, AdminOrderShippingStateDto, AdminRelatedShipmentDto, PaymentStatus } from "@capella/shared";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { FormSkeleton } from "@/components/ui/skeleton";
import { Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { hasErpPermission } from "@/lib/erp-permissions";
import { formatMoney } from "@/lib/format";
import { orderPaymentBadge, paymentStatusLabel } from "@/lib/payment-status";
import { getStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ShippingActions } from "./shipping-actions";

const manualStateLabels = { preparing: "جارٍ التجهيز", ready_for_pickup: "جاهز للاستلام", printed: "تمت الطباعة", delivered: "تم التسليم", returned: "تم الإرجاع" };
const carrierStateLabels = { created: "تم الإنشاء", picked_up: "تم الاستلام", in_transit: "في الطريق", delivered: "تم التسليم", returned: "تم الإرجاع", cancelled: "تم الإلغاء", exception: "تحتاج متابعة" };
const custodyLabels = { unknown: "الحيازة غير مؤكدة", carrier: "مع شركة الشحن", recipient: "تم التسليم للمستلم", warehouse_uninspected: "راجع للمخزن؛ بانتظار الفحص" };
const itemTypeLabels = { product_variant: "منتج", offer: "عرض", collection: "مجموعة" } as const;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="min-w-0 text-base text-text-strong">{children ?? "غير متوفر"}</dd>
    </div>
  );
}

function DetailGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid gap-x-4 gap-y-4 sm:grid-cols-2", className)}>{children}</dl>;
}

function OrderDate({ value }: { value?: string | null }) {
  if (!value || Number.isNaN(new Date(value).getTime())) return <>غير متوفر</>;
  return (
    <time dateTime={value}>
      {new Date(value).toLocaleString("ar-EG-u-nu-latn", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo"
      })}
    </time>
  );
}

function ShippingStateDetails({ shipping }: { shipping: AdminOrderShippingStateDto }) {
  const collectionConfirmed = shipping.collection.confirmed && shipping.collection.amountCents !== null;
  const carrier = shipping.carrierSnapshot;
  const recipient = carrier?.recipient as Record<string, unknown> | undefined;
  const address = carrier?.address as Record<string, unknown> | undefined;
  const carrierText = (value: unknown) => (typeof value === "string" ? value : "غير متوفر");

  return (
    <Card>
      <CardHeader title="حالات الشحن" />
      <CardBody className="grid gap-5 pt-0 sm:pt-0">
        <DetailGrid>
          <Detail label="حالة الموظفة">{shipping.manualState ? `${manualStateLabels[shipping.manualState]} (الموظفة)` : "لا توجد حالة يدوية"}</Detail>
          <Detail label="حالة بوسطة">
            {shipping.carrierState ? `${carrierStateLabels[shipping.carrierState]} (بوسطة)` : shipping.cancellation ? "لا توجد شحنة مرتبطة ببوسطة" : "بانتظار إنشاء الشحنة"}
          </Detail>
          <Detail label="حيازة الشحنة">{custodyLabels[shipping.custodyState]}</Detail>
          {shipping.cancellation ? (
            <>
              <Detail label="إلغاء الطلب">{shipping.cancellation.status === "pending" ? "الإلغاء قيد التأكيد" : "تم إلغاء الطلب"}</Detail>
              <Detail label="المخزون">{shipping.cancellation.stockRestoredAtMs !== null ? "تمت استعادة المخزون" : "المخزون محجوز لحين تأكيد الإلغاء والحيازة"}</Detail>
            </>
          ) : null}
          <Detail label="إثبات التحصيل">{collectionConfirmed ? "التحصيل مؤكد" : "التحصيل غير مؤكد"}</Detail>
          <Detail label="المبلغ المحصل">{shipping.collection.amountCents !== null ? formatMoney(shipping.collection.amountCents / 100) : "غير متوفر"}</Detail>
          {shipping.processing.startedAtMs !== null ? (
            <Detail label="بدء المعالجة"><OrderDate value={new Date(shipping.processing.startedAtMs).toISOString()} /></Detail>
          ) : null}
        </DetailGrid>

        {carrier ? (
          <div className="grid gap-4">
            <h4 className="text-base font-bold text-text-strong">بيانات بوسطة الحالية</h4>
            <DetailGrid>
              <Detail label="المستلم لدى بوسطة">{carrierText(recipient?.fullName)}</Detail>
              <Detail label="الهاتف لدى بوسطة">{carrierText(recipient?.phone)}</Detail>
              <Detail label="العنوان لدى بوسطة">{carrierText(address?.firstLine)}</Detail>
              <Detail label="الحجم لدى بوسطة">{carrierText(carrier.size)}</Detail>
              <Detail label="الملاحظات لدى بوسطة">{carrierText(carrier.notes)}</Detail>
            </DetailGrid>
          </div>
        ) : null}

        {shipping.flags?.length ? (
          <div className="grid gap-1.5">
            {shipping.flags.map((flag) => <p key={flag.id} className="text-sm text-warning">{flag.reason}</p>)}
          </div>
        ) : null}
        {shipping.workItem && ["failed", "review_required", "processing"].includes(shipping.workItem.status) ? (
          <p className="text-sm text-text-muted">متابعة الإرسال: {shipping.workItem.lastError ?? "قيد التنفيذ"}</p>
        ) : null}
        {shipping.processing.addressBlockedAtMs !== null ? <p className="text-sm text-warning">مشكلة عنوان قبل الاستلام؛ المهلة الأصلية قائمة</p> : null}
        {shipping.cancellation?.status === "pending" ? (
          <p className="text-sm text-text-muted">الإرسال محظور حتى تأكيد الإلغاء؛ تعذر الاتصال ببوسطة لا يعيد المخزون تلقائيًا.</p>
        ) : null}
        {(shipping.cancellation?.refundRequiredCents ?? 0) > 0 ? (
          <Alert tone="warning">استرداد كامل يدوي عبر باي موب مطلوب: {formatMoney(shipping.cancellation!.refundRequiredCents / 100)}. بانتظار تأكيد باي موب.</Alert>
        ) : null}
        <p className="text-sm text-text-muted">الحالة اليدوية لا تؤكد الدفع أو استعادة المخزون. الإرجاع يحتاج فحصًا وموافقة قبل إعادة البيع.</p>

        {shipping.history.length > 0 ? (
          <ol className="grid gap-2 border-t border-line pt-4">
            {shipping.history.map((event) => (
              <li key={event.id} className="grid gap-0.5 text-sm text-text-2">
                <span className="font-medium text-text-strong">{manualStateLabels[event.state]}</span>
                <span className="text-text-muted">
                  <OrderDate value={new Date(event.atMs).toISOString()} /> — {event.actorType === "staff" ? `الموظفة #${event.actorId ?? "—"}` : "النظام"}
                </span>
                {event.reason ? <span>{event.reason}</span> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </CardBody>
    </Card>
  );
}

function RelatedShipments({ parcels }: { parcels: AdminRelatedShipmentDto[] }) {
  if (parcels.length === 0) return null;
  return (
    <Card>
      <CardHeader title="المرتجعات والاستبدالات" />
      <CardBody className="grid gap-5 pt-0 sm:pt-0">
        {parcels.map((parcel) => (
          <section key={parcel.id} className="grid gap-4 border-b border-line pb-5 last:border-b-0 last:pb-0">
            <h4 className="text-base font-bold text-text-strong">
              {parcel.kind === "return" ? "مرتجع" : "استبدال"} — <bdi>{parcel.trackingNumber}</bdi>
            </h4>
            <DetailGrid>
              <Detail label="حالة بوسطة">{carrierStateLabels[parcel.carrierState]} (بوسطة)</Detail>
              <Detail label="وصف بوسطة"><span dir="auto">{parcel.rawProviderState}</span></Detail>
              <Detail label="رمز الحالة لدى بوسطة">{parcel.rawProviderCode?.toString() ?? "غير متوفر"}</Detail>
              <Detail label="نوع الشحنة لدى بوسطة"><bdi>{parcel.rawProviderType ?? "غير متوفر"}</bdi></Detail>
              <Detail label="حالة الموظفة">{parcel.manualState ? `${manualStateLabels[parcel.manualState]} (الموظفة)` : "لا توجد حالة يدوية"}</Detail>
              <Detail label="حيازة الشحنة">{custodyLabels[parcel.custodyState]}</Detail>
              <Detail label="آخر حالة مؤكدة من بوسطة">
                <OrderDate value={parcel.providerEventAtMs === null ? null : new Date(parcel.providerEventAtMs).toISOString()} />
              </Detail>
            </DetailGrid>
            {parcel.workItem && ["failed", "review_required", "processing"].includes(parcel.workItem.status) ? (
              <p className="text-sm text-text-muted" dir="auto">متابعة الشحنة: {parcel.workItem.lastError ?? "قيد التنفيذ"}</p>
            ) : null}
          </section>
        ))}
        <p className="text-sm text-text-muted">حالة الإرجاع أو الاستبدال لا تؤكد استرداد الدفع أو إعادة المخزون. تُحدّث استردادات باي موب من تأكيداته، وإعادة المخزون تتم يدويًا بعد الفحص.</p>
      </CardBody>
    </Card>
  );
}

export function OrderDetailsView({ orderId, crumbLabel }: { orderId: number; crumbLabel: string }) {
  const { user, hydrated } = useAdminAuth();
  if (!hydrated) {
    return (
      <AdminShell title="تفاصيل الطلب" crumbs={[{ label: "الطلبات", href: "/orders" }, { label: "تحميل" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }
  if (!hasErpPermission(user, "orders.read")) {
    return (
      <AdminShell
        title="تفاصيل الطلب"
        crumbs={[{ label: "الطلبات", href: "/orders" }, { label: "غير مصرح" }]}
        actions={<Button asChild variant="secondary"><Link href="/orders">رجوع للطلبات</Link></Button>}
      >
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى الطلبات." />
      </AdminShell>
    );
  }
  return (
    <OrderDetailsContent
      key={orderId}
      orderId={orderId}
      crumbLabel={crumbLabel}
      canUpdatePaymentStatus={hasErpPermission(user, "orders.update_payment_status")}
      canUpdateShipping={hasErpPermission(user, "shipping.update_state")}
    />
  );
}

function OrderDetailsContent({ orderId, crumbLabel, canUpdatePaymentStatus, canUpdateShipping }: {
  orderId: number;
  crumbLabel: string;
  canUpdatePaymentStatus: boolean;
  canUpdateShipping: boolean;
}) {
  const [order, setOrder] = useState<AdminOrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shippingRefreshError, setShippingRefreshError] = useState<string | null>(null);
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
      order.paymentStatus === "denied" || order.shipping?.cancellation || savingRef.current || paymentStatus === order.paymentStatus) return;
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

  const paymentDisplay = order ? orderPaymentBadge(order) : null;
  const shippingPaymentManaged = Boolean(order?.shipping || order?.shippingQuoteId || (order?.shippingAmountCents ?? 0) > 0);
  const refunded = order?.paymentMethod === "paymob" ? (order.refundedAmountCents ?? 0) : 0;
  const savings = order?.items.reduce((sum, item) => sum + Math.max(0,
    Math.round((item.snapshotBaseUnitPrice ?? item.unitPrice) * 100) - Math.round(item.unitPrice * 100)) * item.qty, 0) ?? 0;

  return (
    <AdminShell
      title="تفاصيل الطلب"
      crumbs={[{ label: "الطلبات", href: "/orders" }, { label: order?.orderCode ?? crumbLabel }]}
      actions={<Button asChild variant="secondary"><Link href="/orders">رجوع للطلبات</Link></Button>}
    >
      {loading ? (
        <FormSkeleton />
      ) : error ? (
        <Card>
          <CardBody className="grid justify-items-start gap-3 pt-5 sm:pt-6">
            <Alert tone="danger">{error}</Alert>
            <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>إعادة المحاولة</Button>
          </CardBody>
        </Card>
      ) : !order ? (
        <Card>
          <EmptyState icon={<PackageOpen />} title="لا يمكن العثور على هذا الطلب" />
        </Card>
      ) : (
        <div className="grid gap-5">
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5 sm:pt-6">
              <div className="grid gap-1">
                <span className="text-sm text-text-muted">كود الطلب</span>
                <span className="num text-xl font-bold text-text-strong" dir="ltr">{order.orderCode}</span>
                <span className="text-sm text-text-muted"><OrderDate value={order.createdAt} /></span>
              </div>
              <div className="grid justify-items-end gap-1.5">
                <Badge tone={paymentDisplay?.tone}>{paymentDisplay?.label}</Badge>
                <span className="text-sm text-text-muted">{order.paymentMethod === "paymob" ? "دفع إلكتروني عبر باي موب" : "الدفع عند الاستلام"}</span>
              </div>
            </CardBody>
          </Card>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="grid gap-5">
              <Card className="overflow-hidden">
                <CardHeader
                  title="عناصر الطلب"
                  description={`${order.items.length} عنصر / ${order.items.reduce((sum, item) => sum + item.qty, 0)} إجمالي الكميات`}
                />
                <Table>
                  <THead>
                    <tr>
                      <TH>العنصر</TH>
                      <TH>الكمية</TH>
                      <TH>سعر الوحدة</TH>
                      <TH>الإجمالي</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {order.items.map((item) => (
                      <TR key={item.id}>
                        <TD data-cell="lead">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Badge tone="nude" swatch={false}>{itemTypeLabels[item.itemType]}</Badge>
                            <span className="text-text-strong">{item.snapshotNameAr || item.snapshotNameEn || "عنصر غير مسمى"}</span>
                          </div>
                          {item.snapshotNameEn && item.snapshotNameAr ? <p dir="auto" className="mt-0.5 text-sm text-text-muted">{item.snapshotNameEn}</p> : null}
                          {item.snapshotSizeLabel ? <p dir="auto" className="text-sm text-text-muted">{item.snapshotSizeLabel}</p> : null}
                        </TD>
                        <TD data-label="الكمية" className="num whitespace-nowrap text-text-2">{item.qty}</TD>
                        <TD data-label="سعر الوحدة" className="whitespace-nowrap">
                          {item.snapshotBaseUnitPrice != null && item.snapshotBaseUnitPrice > item.unitPrice ? (
                            <del className="num me-2 text-text-muted">{formatMoney(item.snapshotBaseUnitPrice)}</del>
                          ) : null}
                          <span className="num text-text-strong">{formatMoney(item.unitPrice)}</span>
                        </TD>
                        <TD data-label="الإجمالي" className="num whitespace-nowrap font-bold text-text-strong">{formatMoney(item.lineTotal)}</TD>
                      </TR>
                    ))}
                    {order.items.length === 0 ? <TableState colSpan={4}><p className="py-6 text-center text-sm text-text-muted">لا توجد عناصر مسجلة لهذا الطلب.</p></TableState> : null}
                  </TBody>
                </Table>
                <div className="border-t border-line px-5 py-4 sm:px-6">
                  <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    {savings > 0 ? <Detail label="التوفير على المنتجات"><span className="num">{formatMoney(savings / 100)}</span></Detail> : null}
                    <Detail label="إجمالي الطلب"><strong className="num">{formatMoney(order.totalAmount)}</strong></Detail>
                    {refunded > 0 ? (
                      <>
                        <Detail label="المبلغ المسترد"><span className="num">{formatMoney(refunded / 100)}</span></Detail>
                        <Detail label="الصافي بعد الاسترداد"><strong className="num">{formatMoney((Math.round(order.totalAmount * 100) - refunded) / 100)}</strong></Detail>
                      </>
                    ) : null}
                  </dl>
                </div>
              </Card>

              {order.shipping ? <ShippingStateDetails shipping={order.shipping} /> : null}
              {order.shipping ? <RelatedShipments parcels={order.shipping.relatedShipments ?? []} /> : null}
              {order.shipping && canUpdateShipping ? (
                <ShippingActions
                  orderIds={[order.id]}
                  order={order}
                  onComplete={() => {
                    setShippingRefreshError(null);
                    void getStore().fetchOrder(orderId).then(setOrder).catch(() => setShippingRefreshError("تعذر تحميل البيانات المحدثة. أعيدي تحميل الطلب."));
                  }}
                />
              ) : null}
              {shippingRefreshError ? <Alert tone="danger">{shippingRefreshError}</Alert> : null}

              <Card>
                <CardHeader title="تفاصيل الدفع" />
                <CardBody className="grid gap-4 pt-0 sm:pt-0">
                  {order.paymentMethod === "paymob" ? (
                    <>
                      <Alert tone="info">تُحدّث حالة الدفع تلقائيًا من باي موب. تتم عمليات الاسترداد من لوحة باي موب.</Alert>
                      {order.payment ? (
                        <DetailGrid>
                          <Detail label="وسيلة الدفع">{order.payment.paymentMethod === "card" ? "بطاقة بنكية" : order.payment.paymentMethod === "wallet" ? "محفظة إلكترونية" : "غير متوفر"}</Detail>
                          <Detail label="بيئة الدفع"><Badge tone={order.payment.environment === "test" ? "warning" : "success"}>{order.payment.environment === "test" ? "تجريبي" : "فعلي"}</Badge></Detail>
                          <Detail label="رقم المعاملة في باي موب"><bdi>{order.payment.paymobTransactionId ?? "غير متوفر"}</bdi></Detail>
                          <Detail label="رقم الطلب في باي موب"><bdi>{order.payment.paymobOrderId ?? "غير متوفر"}</bdi></Detail>
                          <Detail label="مرجع الدفع"><bdi>{order.payment.merchantReference}</bdi></Detail>
                          <Detail label="رقم تكامل الدفع"><bdi>{order.payment.integrationId ?? "غير متوفر"}</bdi></Detail>
                          <Detail label="رقم محاولة الدفع">{order.payment.attemptNumber}</Detail>
                          <Detail label="بدء محاولة الدفع"><OrderDate value={order.payment.createdAt} /></Detail>
                        </DetailGrid>
                      ) : <p className="text-sm text-text-muted">تفاصيل معاملة باي موب غير متوفرة لهذا الطلب.</p>}
                    </>
                  ) : (
                    <>
                      <div className="max-w-md">
                        <Field label="حالة الدفع عند الاستلام" htmlFor="order-payment-status">
                          <Select
                            id="order-payment-status"
                            value={order.paymentStatus}
                            disabled={!canUpdatePaymentStatus || order.paymentStatus === "denied" || !!order.shipping?.cancellation || saving}
                            onChange={(event) => { void updatePaymentStatus(event.target.value as PaymentStatus); }}
                          >
                            {(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((status) => (
                              <option key={status} value={status} disabled={shippingPaymentManaged && status !== "denied"}>{paymentStatusLabel[status]}</option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <p className="text-sm text-text-muted">
                        {order.paymentStatus === "denied" ? "الطلب مرفوض؛ لا يمكن تغيير حالة الدفع بعد الرفض."
                          : !canUpdatePaymentStatus ? "لديكِ صلاحية عرض الطلب فقط."
                            : shippingPaymentManaged ? "تُحدّث حالة الدفع من تحصيل بوسطة. الرفض يحتاج تأكيد الإلغاء وحيازة المخزون."
                              : "رفض الطلب يعيد الكميات إلى المخزون ويمنع تغيير حالته لاحقًا."}
                      </p>
                    </>
                  )}
                  <div aria-live="polite" className="text-sm text-text-muted">
                    {saving ? "جارٍ حفظ حالة الدفع…" : saved ? "تم تحديث حالة الدفع." : null}
                  </div>
                  {saveError ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <p role="alert" className="text-sm text-danger">{saveError}</p>
                      <Button variant="secondary" size="sm" onClick={() => { setSaveError(null); setSaved(false); setReload((value) => value + 1); }}>إعادة تحميل الطلب</Button>
                    </div>
                  ) : null}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="بيانات الطلب" description="التوقيت المحلي للقاهرة" />
                <CardBody className="pt-0 sm:pt-0">
                  <DetailGrid>
                    <Detail label="رقم الطلب الداخلي"><bdi>#{order.id}</bdi></Detail>
                    <Detail label="آخر تحديث"><OrderDate value={order.updatedAt} /></Detail>
                    {order.paymentMethod !== "paymob" && order.paymentStatus === "pending" && order.codExpiresAt && (!order.shipping || order.shipping.processing.untouchedExpiryApplies) ? (
                      <Detail label="مهلة مراجعة الدفع عند الاستلام"><OrderDate value={order.codExpiresAt} /></Detail>
                    ) : null}
                  </DetailGrid>
                </CardBody>
              </Card>
            </div>

            <aside className="grid gap-5">
              <Card>
                <CardHeader
                  title="بيانات العميل"
                  actions={<Badge tone="neutral" swatch={false}>{order.customerType === "registered" ? "عميل مسجل" : "ضيف"}</Badge>}
                />
                <CardBody className="grid gap-4 pt-0 sm:pt-0">
                  <p className="text-base font-medium text-text-strong">{order.fullName}</p>
                  <dl className="grid gap-4">
                    <Detail label="رقم الهاتف"><a className="text-text-strong decoration-line-strong underline-offset-4 hover:underline" dir="ltr" href={`tel:${order.phone}`}>{order.phone}</a></Detail>
                    <Detail label="البريد الإلكتروني عند الطلب">
                      {order.email ? <a className="text-text-strong decoration-line-strong underline-offset-4 hover:underline" dir="ltr" href={`mailto:${order.email}`}>{order.email}</a> : "غير متوفر"}
                    </Detail>
                    {order.customerId != null ? <Detail label="رقم حساب العميل"><bdi>#{order.customerId}</bdi></Detail> : null}
                  </dl>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="عنوان التوصيل" />
                <CardBody className="pt-0 sm:pt-0">
                  <dl className="grid gap-4">
                    <Detail label="المحافظة">{order.governorate}</Detail>
                    <Detail label="المدينة / المنطقة">{order.cityArea}</Detail>
                    <Detail label="العنوان">{order.addressLine}</Detail>
                    <Detail label="المبنى / الشقة">{order.buildingApartment}</Detail>
                  </dl>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="ملاحظات العميل" />
                <CardBody className="pt-0 sm:pt-0">
                  <p className="text-base text-text-2">{order.notes?.trim() ? order.notes : "لا توجد ملاحظات من العميل."}</p>
                </CardBody>
              </Card>
            </aside>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
