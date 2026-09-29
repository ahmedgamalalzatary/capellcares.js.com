"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AdminShipmentListItemDto } from "@capella/shared";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { hasErpPermission } from "@/lib/erp-permissions";
import { paymentStatusFilterOptions, orderPaymentDisplay } from "@/lib/payment-status";
import { getStore } from "@/lib/store";
import { formatOrderAmount } from "@/lib/order-format";

const carrierStateLabels: Record<string, string> = {
  created: "تم الإنشاء", picked_up: "تم الاستلام", in_transit: "في الطريق",
  delivered: "تم التسليم", returned: "تم الإرجاع", cancelled: "تم الإلغاء", exception: "تحتاج متابعة"
};
const manualStateLabels: Record<string, string> = {
  preparing: "جارٍ التجهيز", ready_for_pickup: "جاهز للاستلام", printed: "تمت الطباعة",
  delivered: "تم التسليم", returned: "تم الإرجاع"
};
const custodyLabels: Record<string, string> = {
  unknown: "الحيازة غير مؤكدة", carrier: "مع شركة الشحن",
  recipient: "تم التسليم للمستلم", warehouse_uninspected: "راجع للمخزن؛ بانتظار الفحص"
};
const kindLabels: Record<string, string> = { outgoing: "صادرة", return: "مرتجع", exchange: "استبدال" };
const sizeLabels: Record<string, string> = { small: "صغير", medium: "وسط", large: "كبير" };
const flagLabels: Record<string, string> = {
  address_review: "مراجعة عنوان", expiry_review: "مراجعة المهلة", refund_review: "مراجعة استرداد",
  amount_mismatch: "اختلاف المبلغ", custody_review: "مراجعة الحيازة",
  cancellation_pending: "إلغاء قيد التأكيد", untouched_paid: "طلب مدفوع دون تجهيز"
};
const workItemStatusLabels: Record<string, string> = {
  pending: "قيد الانتظار", processing: "قيد التنفيذ", succeeded: "تم", failed: "فشل", review_required: "يحتاج مراجعة"
};

const SECTIONS = [
  { key: "all", label: "كل الشحنات" },
  { key: "needs_attention", label: "تحتاج انتباه" },
  { key: "returns", label: "المرتجعات والاستبدالات" }
] as const;

function localDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function ShippingPage() {
  const { user, hydrated } = useAdminAuth();

  if (!hydrated) {
    return (
      <AdminShell title="الشحن" crumbs={[{ label: "الشحن" }]}>
        <p className="muted">جارٍ تحميل الشحنات…</p>
      </AdminShell>
    );
  }

  if (!hasErpPermission(user, "shipping.read")) {
    return (
      <AdminShell title="الشحن" crumbs={[{ label: "الشحن" }]}>
        <ErpForbiddenState message="لا تملك صلاحية الوصول إلى الشحن." />
      </AdminShell>
    );
  }

  return <ShippingPageContent />;
}

function ShippingPageContent() {
  const [items, setItems] = useState<AdminShipmentListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [section, setSection] = useState<(typeof SECTIONS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getStore().fetchShippingOverview()
      .then((page) => { if (!cancelled) { setItems(page.items); setNextCursor(page.nextCursor); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    void getStore().fetchShippingOverview(nextCursor)
      .then((page) => {
        setItems((prev) => [...prev, ...page.items]);
        setNextCursor(page.nextCursor);
      })
      .catch(() => { /* keep loaded rows; the button stays for retry */ })
      .finally(() => setLoadingMore(false));
  };

  const filtered = useMemo(() => {
    let rows = section === "needs_attention"
      ? items.filter((item) => item.needsAttention)
      : section === "returns"
        ? items.filter((item) => item.kind !== "outgoing")
        : items;
    rows = rows.filter((item) => statusFilter === "all" ||
      item.carrierState === statusFilter ||
      (statusFilter === "cancelled" && item.carrierState === null && item.cancellationStatus === "cancelled"));
    rows = rows.filter((item) => paymentFilter === "all" || item.paymentMethod === paymentFilter);
    rows = rows.filter((item) => {
      const dateKey = localDateKey(item.orderCreatedAt);
      return (!fromDate || dateKey >= fromDate) && (!toDate || dateKey <= toDate);
    });
    if (!search.trim()) return rows;
    const term = search.trim().toLowerCase();
    return rows.filter((item) =>
      item.orderCode.toLowerCase().includes(term) ||
      item.customerName.toLowerCase().includes(term) ||
      item.customerPhone.includes(term) ||
      (item.trackingNumber ?? "").toLowerCase().includes(term)
    );
  }, [fromDate, items, paymentFilter, search, section, statusFilter, toDate]);

  return (
    <AdminShell title="الشحن" crumbs={[{ label: "الشحن" }]}>
      <div className="row row--wrap" role="tablist" aria-label="أقسام الشحن" style={{ marginBottom: 16 }}>
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={section === item.key}
            className={section === item.key ? "btn btn--sm" : "btn btn--ghost btn--sm"}
            onClick={() => setSection(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p role="alert">تعذر تحميل الشحنات. حدّثي الصفحة للمحاولة مرة أخرى.</p> : loading ? (
        <p className="muted">جارٍ تحميل الشحنات…</p>
      ) : (
        <>
          <AdminListHeader
            searchPlaceholder="ابحثي بكود الطلب، العميل، أو رقم التتبع…"
            searchLabel="بحث في الشحنات"
            searchValue={search}
            onSearchChange={setSearch}
            countLabel={`${filtered.length} شحنة`}
            filters={[
              {
                key: "status",
                label: "حالة الناقل",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "كل حالات الناقل" },
                  ...Object.entries(carrierStateLabels).map(([value, label]) => ({ value, label }))
                ]
              },
              {
                key: "payment",
                label: "طريقة الدفع",
                value: paymentFilter,
                onChange: setPaymentFilter,
                options: [
                  { value: "all", label: "كل الطرق" },
                  { value: "cod", label: "دفع عند الاستلام" },
                  { value: "paymob", label: "باي موب" }
                ]
              }
            ]}
            customFilters={(
              <>
                <label className="list-date-filter">
                  <span aria-hidden="true">من</span>
                  <input aria-label="من تاريخ" className="input" type="date" value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)} />
                </label>
                <label className="list-date-filter">
                  <span aria-hidden="true">إلى</span>
                  <input aria-label="إلى تاريخ" className="input" type="date" value={toDate}
                    onChange={(event) => setToDate(event.target.value)} />
                </label>
              </>
            )}
          />

          <div className="card">
            <div className="table-outer">
              <table className="table">
                <thead>
                  <tr>
                    <th>كود الطلب</th>
                    <th>النوع</th>
                    <th>رقم التتبع</th>
                    <th>العميل</th>
                    <th>حالة بوسطة</th>
                    <th>الحالة اليدوية</th>
                    <th>الحيازة</th>
                    <th>الحجم</th>
                    <th>الشحن</th>
                    <th>الدفع</th>
                    <th>العلامات</th>
                    <th>التاريخ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={`${item.orderId}-${item.kind}-${item.shipmentId ?? "none"}`}>
                      <td>
                        <Link href={`/orders/${item.orderId}`} className="table-title">
                          <code className="mono fs-12-5">{item.orderCode}</code>
                        </Link>
                      </td>
                      <td>{kindLabels[item.kind]}</td>
                      <td><code className="mono fs-12-5" dir="ltr">{item.trackingNumber ?? "—"}</code></td>
                      <td>
                        <div>{item.customerName}</div>
                        <div className="faint cell-subline" dir="ltr">{item.customerPhone}</div>
                      </td>
                      <td>
                        {item.carrierState
                          ? <span className={item.carrierState === "exception" ? "status status--draft" : "status status--active"}>{carrierStateLabels[item.carrierState]}</span>
                          : <span className="muted">بانتظار الإنشاء</span>}
                        {item.cancellationStatus === "cancelled" && <div className="faint cell-subline">تم الإلغاء</div>}
                        {item.cancellationStatus === "pending" && <div className="faint cell-subline">الإلغاء قيد التأكيد</div>}
                        {item.workItem && item.workItem.status !== "succeeded" &&
                          <div className="faint cell-subline">{workItemStatusLabels[item.workItem.status]}</div>}
                        {item.workItem?.lastError && <div className="faint cell-subline">{item.workItem.lastError}</div>}
                      </td>
                      <td>{item.manualState ? manualStateLabels[item.manualState] : "—"}</td>
                      <td className="muted">{custodyLabels[item.custodyState]}</td>
                      <td>
                        {item.size ? sizeLabels[item.size] : "—"}
                        {item.carrierSize && <div className="faint cell-subline" dir="ltr">بوسطة: {item.carrierSize}</div>}
                      </td>
                      <td className="fw-600">{formatOrderAmount((item.shippingAmountCents ?? 0) / 100)}</td>
                      <td>{(() => { const display = orderPaymentDisplay(item); return <span className={display.chip}>{display.label}</span>; })()}</td>
                      <td>
                        {item.openFlagTypes.length === 0 ? <span className="muted">—</span> :
                          item.openFlagTypes.map((flagType) => <span key={flagType} className="status status--draft">{flagLabels[flagType]}</span>)}
                      </td>
                      <td className="muted">{new Date(item.orderCreatedAt).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td>
                        <Link href={`/orders/${item.orderId}`} className="btn btn--ghost btn--sm">التفاصيل</Link>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={13} className="state-note state-note--lg state-note--muted">
                      {items.length === 0 ? "لا توجد شحنات بعد." : "لا توجد شحنات تطابق البحث أو عوامل التصفية."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {nextCursor && !loading && !error && (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn--ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "جارٍ التحميل…" : "تحميل المزيد"}
              </button>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
