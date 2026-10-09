"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminShipmentListItemDto } from "@capella/shared";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShippingActions } from "@/components/admin/shipping-actions";
import { ShipmentsTable } from "@/features/shipping/components/shipments-table";
import { carrierStateLabels, custodyLabels, kindLabels, manualStateLabels, sizeLabels } from "@/features/shipping/lib/labels";
import { hasErpPermission } from "@/lib/erp-permissions";
import { localDateKey } from "@/lib/format";
import { getStore } from "@/lib/store";
import { useTableSort } from "@/hooks/use-table-sort";

const SECTIONS = [
  { key: "all", label: "كل الشحنات" },
  { key: "needs_attention", label: "تحتاج انتباه" },
  { key: "returns", label: "المرتجعات والاستبدالات" }
] as const;

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
      <ForbiddenPage title="الشحن" crumbs={[{ label: "الشحن" }]} message="لا تملك صلاحية الوصول إلى الشحن." />
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
            variant={section === item.key ? "primary" : "ghost"}
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

          <ShipmentsTable
            items={sortedRows}
            totalItems={items.length}
            canModify={canModify}
            selected={selected}
            selectableIds={selectable}
            onToggleRow={toggle}
            onSelectAll={(checked) => setSelected(checked ? selectable.slice(0, 50) : [])}
            sort={sort}
            onSort={toggleSort}
          />

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
