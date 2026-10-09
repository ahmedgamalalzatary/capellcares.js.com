"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import type { AdminShipmentListItemDto } from "@capella/shared";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { hasErpPermission } from "@/lib/erp-permissions";
import { formatMoney } from "@/lib/format";
import { orderPaymentBadge } from "@/lib/payment-status";
import { ShippingActions } from "@/components/orders/shipping-actions";
import { getStore } from "@/lib/store";
import { useTableSort } from "@/hooks/use-table-sort";
import { cn } from "@/lib/utils";

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
        <Card className="overflow-hidden">
          <div className="grid gap-2 p-4">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-11 rounded-control" />)}
          </div>
        </Card>
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

  return <ShippingPageContent canModify={hasErpPermission(user, "shipping.update_state")} />;
}

function ShippingPageContent({ canModify }: { canModify: boolean }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [refreshError, setRefreshError] = useState(false);
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

  const { sort, toggleSort, sortedRows } = useTableSort(filtered, {
    code: (item) => item.orderCode,
    kind: (item) => kindLabels[item.kind],
    tracking: (item) => item.trackingNumber ?? "",
    customer: (item) => item.customerName,
    carrier: (item) => (item.carrierState ? carrierStateLabels[item.carrierState] : ""),
    manual: (item) => (item.manualState ? manualStateLabels[item.manualState] : ""),
    custody: (item) => custodyLabels[item.custodyState],
    size: (item) => (item.size ? sizeLabels[item.size] : ""),
    shipping: (item) => item.shippingAmountCents ?? 0,
    payment: (item) => item.paymentMethod,
    date: (item) => item.orderCreatedAt
  });

  const selectable = filtered.filter((item) => item.kind === "outgoing").map((item) => item.orderId);
  function toggle(orderId: number) {
    setSelected((prev) => prev.includes(orderId) ? prev.filter((id) => id !== orderId) : prev.length < 50 ? [...prev, orderId] : prev);
  }
  async function refresh() {
    try {
      const updated: AdminShipmentListItemDto[] = [];
      let cursor: string | undefined;
      let next: string | null;
      do {
        const page = await getStore().fetchShippingOverview(cursor);
        updated.push(...page.items);
        next = page.nextCursor;
        cursor = next ?? undefined;
      } while (next && updated.length < items.length);
      setItems(updated);
      setNextCursor(next);
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    }
  }

  return (
    <AdminShell
      title="الشحن"
      crumbs={[{ label: "الشحن" }]}
      description="متابعة شحنات بوسطة، المرتجعات، والاستبدالات."
    >
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="أقسام الشحن">
        {SECTIONS.map((item) => (
          <Button
            key={item.key}
            variant={section === item.key ? "primary" : "secondary"}
            size="sm"
            role="tab"
            aria-selected={section === item.key}
            onClick={() => setSection(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <Card><div className="p-5 sm:p-6"><p role="alert" className="text-sm text-danger">تعذر تحميل الشحنات. حدّثي الصفحة للمحاولة مرة أخرى.</p></div></Card>
      ) : loading ? (
        <Card className="overflow-hidden">
          <div className="grid gap-2 p-4" aria-hidden>
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-11 rounded-control" />)}
          </div>
        </Card>
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
            customFilters={
              <>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-text-2">من تاريخ</span>
                  <Input aria-label="من تاريخ" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-text-2">إلى تاريخ</span>
                  <Input aria-label="إلى تاريخ" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </label>
              </>
            }
          />

          {canModify && selected.length > 0 ? (
            <ShippingActions
              orderIds={selected}
              orderCodes={Object.fromEntries(items.map((item) => [item.orderId, item.orderCode]))}
              onComplete={() => { void refresh(); }}
            />
          ) : null}
          {refreshError ? <AlertLine>تم إرسال الإجراء؛ تعذر تحديث القائمة. حدّثي الصفحة للتحقق من النتائج.</AlertLine> : null}

          <Card className="overflow-hidden">
            <Table>
              <THead>
                <tr>
                  {canModify ? (
                    <TH className="w-px">
                      <input
                        type="checkbox"
                        className="size-4"
                        aria-label="تحديد الطلبات الظاهرة"
                        disabled={selectable.length === 0}
                        checked={selectable.length > 0 && selectable.every((id) => selected.includes(id))}
                        onChange={(event) => setSelected(event.target.checked ? selectable.slice(0, 50) : [])}
                      />
                    </TH>
                  ) : null}
                  <SortableTH direction={sort?.key === "code" ? sort.direction : null} onSort={() => toggleSort("code")}>كود الطلب</SortableTH>
                  <SortableTH direction={sort?.key === "kind" ? sort.direction : null} onSort={() => toggleSort("kind")}>النوع</SortableTH>
                  <SortableTH direction={sort?.key === "tracking" ? sort.direction : null} onSort={() => toggleSort("tracking")}>رقم التتبع</SortableTH>
                  <SortableTH direction={sort?.key === "customer" ? sort.direction : null} onSort={() => toggleSort("customer")}>العميل</SortableTH>
                  <SortableTH direction={sort?.key === "carrier" ? sort.direction : null} onSort={() => toggleSort("carrier")}>حالة بوسطة</SortableTH>
                  <SortableTH direction={sort?.key === "manual" ? sort.direction : null} onSort={() => toggleSort("manual")}>الحالة اليدوية</SortableTH>
                  <SortableTH direction={sort?.key === "custody" ? sort.direction : null} onSort={() => toggleSort("custody")}>الحيازة</SortableTH>
                  <SortableTH direction={sort?.key === "size" ? sort.direction : null} onSort={() => toggleSort("size")}>الحجم</SortableTH>
                  <SortableTH direction={sort?.key === "shipping" ? sort.direction : null} onSort={() => toggleSort("shipping")}>الشحن</SortableTH>
                  <SortableTH direction={sort?.key === "payment" ? sort.direction : null} onSort={() => toggleSort("payment")}>الدفع</SortableTH>
                  <TH>العلامات</TH>
                  <SortableTH direction={sort?.key === "date" ? sort.direction : null} onSort={() => toggleSort("date")}>التاريخ</SortableTH>
                  <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
                </tr>
              </THead>
              <TBody>
                {sortedRows.map((item) => {
                  const payment = orderPaymentBadge(item);
                  return (
                    <TR key={`${item.orderId}-${item.kind}-${item.shipmentId ?? "none"}`}>
                      {canModify ? (
                        <TD className="max-md:!col-span-2">
                          {item.kind === "outgoing" ? (
                            <input
                              type="checkbox"
                              className="size-4"
                              aria-label={`تحديد ${item.orderCode}`}
                              checked={selected.includes(item.orderId)}
                              disabled={selected.length >= 50 && !selected.includes(item.orderId)}
                              onChange={() => toggle(item.orderId)}
                            />
                          ) : null}
                        </TD>
                      ) : null}
                      <TD data-cell="lead">
                        <Link href={`/orders/${item.orderId}`} className="font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">
                          <code className="mono text-sm">{item.orderCode}</code>
                        </Link>
                      </TD>
                      <TD data-label="النوع" className="whitespace-nowrap text-text-2">{kindLabels[item.kind]}</TD>
                      <TD data-label="رقم التتبع" className="whitespace-nowrap text-text-2"><bdi>{item.trackingNumber ?? "—"}</bdi></TD>
                      <TD data-label="العميل">
                        <span className="block text-text-strong">{item.customerName}</span>
                        <span dir="ltr" className="block text-end text-sm text-text-muted">{item.customerPhone}</span>
                      </TD>
                      <TD data-label="حالة بوسطة" className="grid gap-0.5">
                        {item.carrierState
                          ? <Badge tone={item.carrierState === "exception" ? "warning" : "success"}>{carrierStateLabels[item.carrierState]}</Badge>
                          : <span className="text-text-muted">بانتظار الإنشاء</span>}
                        {item.cancellationStatus === "cancelled" ? <span className="text-xs text-text-muted">تم الإلغاء</span> : null}
                        {item.cancellationStatus === "pending" ? <span className="text-xs text-text-muted">الإلغاء قيد التأكيد</span> : null}
                        {item.workItem && item.workItem.status !== "succeeded" ? <span className="text-xs text-text-muted">{workItemStatusLabels[item.workItem.status]}</span> : null}
                        {item.workItem?.lastError ? <span className="text-xs text-text-muted">{item.workItem.lastError}</span> : null}
                      </TD>
                      <TD data-label="الحالة اليدوية" className="whitespace-nowrap text-text-2">{item.manualState ? manualStateLabels[item.manualState] : "—"}</TD>
                      <TD data-label="الحيازة" className="text-text-muted">{custodyLabels[item.custodyState]}</TD>
                      <TD data-label="الحجم" className="whitespace-nowrap text-text-2">
                        {item.size ? sizeLabels[item.size] : "—"}
                        {item.carrierSize ? <span dir="ltr" className="block text-xs text-text-muted">بوسطة: {item.carrierSize}</span> : null}
                      </TD>
                      <TD data-label="الشحن" className="num whitespace-nowrap font-medium text-text-strong">{formatMoney((item.shippingAmountCents ?? 0) / 100)}</TD>
                      <TD data-label="الدفع"><Badge tone={payment.tone}>{payment.label}</Badge></TD>
                      <TD data-label="العلامات">
                        {item.openFlagTypes.length === 0 ? <span className="text-text-muted">—</span> : (
                          <span className="flex flex-wrap gap-1">
                            {item.openFlagTypes.map((flagType) => <Badge key={flagType} tone="warning">{flagLabels[flagType]}</Badge>)}
                          </span>
                        )}
                      </TD>
                      <TD data-label="التاريخ" className="whitespace-nowrap text-text-muted">
                        {new Date(item.orderCreatedAt).toLocaleDateString("ar-EG-u-nu-latn", { day: "2-digit", month: "short", year: "numeric" })}
                      </TD>
                      <TD data-cell="actions">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/orders/${item.orderId}`}>التفاصيل</Link>
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
                {sortedRows.length === 0 ? (
                  <TableState colSpan={canModify ? 14 : 13}>
                    <EmptyState
                      icon={<Truck />}
                      title={items.length === 0 ? "لا توجد شحنات بعد" : "لا توجد شحنات تطابق البحث"}
                      description={items.length === 0 ? "ستظهر الشحنات هنا بمجرد إنشائها." : "جرّبي كلمة أخرى أو غيّري عوامل التصفية."}
                    />
                  </TableState>
                ) : null}
              </TBody>
            </Table>
          </Card>

          {nextCursor && !loading && !error ? (
            <div className="mt-4">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "جارٍ التحميل…" : "تحميل المزيد"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}

function AlertLine({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="mb-4 text-sm text-danger">{children}</p>;
}
