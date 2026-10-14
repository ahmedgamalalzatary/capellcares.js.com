"use client";

import { useEffect, useState } from "react";
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
import { SmartPagination } from "@/components/admin/smart-pagination";
import { ShipmentsTable, type ShippingSortKey } from "@/features/shipping/components/shipments-table";
import { carrierStateLabels } from "@/features/shipping/lib/labels";
import { usePaginatedList, useServerPage } from "@/hooks/use-paginated-list";
import { hasErpPermission } from "@/lib/erp-permissions";
import { formatNumber, isDateKey, localDayEnd, localDayStart } from "@/lib/format";
import type { ListSchema } from "@/lib/pagination";

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

const SHIPPING_SORT_KEYS: ShippingSortKey[] = ["code", "kind", "tracking", "customer", "carrier", "manual", "custody", "size", "shipping", "payment", "date"];

const SHIPPING_LIST = {
  filters: {
    section: { default: "all", values: SECTIONS.map((item) => item.key) },
    status: { default: "all", values: ["all", ...Object.keys(carrierStateLabels)] },
    payment: { default: "all", values: ["all", "cod", "paymob"] },
    from: { default: "", accepts: isDateKey },
    to: { default: "", accepts: isDateKey }
  },
  sortKeys: SHIPPING_SORT_KEYS
} satisfies ListSchema<"section" | "status" | "payment" | "from" | "to", ShippingSortKey>;

// "all" means no filter; calendar days go to the server as the viewer's own day bounds.
const shippingRequest = (filters: Record<"section" | "status" | "payment" | "from" | "to", string>) => ({
  section: filters.section === "all" ? undefined : filters.section,
  status: filters.status === "all" ? undefined : filters.status,
  payment: filters.payment === "all" ? undefined : filters.payment,
  from: filters.from ? localDayStart(filters.from) : undefined,
  to: filters.to ? localDayEnd(filters.to) : undefined
});

function ShippingPageContent({ canModify }: { canModify: boolean }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [refreshError, setRefreshError] = useState(false);
  const list = usePaginatedList({ listId: "shipping", schema: SHIPPING_LIST, searchDelay: 300, toRequest: shippingRequest });
  const server = useServerPage<AdminShipmentListItemDto>(list.ready ? `/api/erp/shipping?${list.requestQuery}` : null);
  const { section, status, payment, from, to } = list.state.filters;
  const narrowed = Boolean(list.state.q) || section !== "all" || status !== "all" || payment !== "all" || Boolean(from) || Boolean(to);
  const firstLoad = server.loading && server.items.length === 0;

  // A selection only makes sense for rows on screen; a different page or filter starts a fresh one.
  useEffect(() => {
    setSelected([]);
  }, [list.requestQuery]);

  const selectable = server.items.filter((item) => item.kind === "outgoing").map((item) => item.orderId);
  function toggle(orderId: number) {
    setSelected((prev) => prev.includes(orderId) ? prev.filter((id) => id !== orderId) : prev.length < 50 ? [...prev, orderId] : prev);
  }
  async function refresh() {
    setRefreshError(!(await server.reload()));
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
            onClick={() => list.setFilter("section", item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {server.error && server.items.length === 0 ? (
        <Card><div className="p-5 sm:p-6"><p role="alert" className="text-sm text-danger">تعذر تحميل الشحنات. حدّثي الصفحة للمحاولة مرة أخرى.</p></div></Card>
      ) : firstLoad ? (
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
            searchValue={list.searchInput}
            onSearchChange={list.setSearch}
            countLabel={`${formatNumber(server.total)} شحنة`}
            filters={[
              {
                key: "status",
                label: "حالة الناقل",
                value: status,
                onChange: (value) => list.setFilter("status", value),
                options: [
                  { value: "all", label: "كل حالات الناقل" },
                  ...Object.entries(carrierStateLabels).map(([value, label]) => ({ value, label }))
                ]
              },
              {
                key: "payment",
                label: "طريقة الدفع",
                value: payment,
                onChange: (value) => list.setFilter("payment", value),
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
                  <Input aria-label="من تاريخ" type="date" value={from} onChange={(event) => list.setFilter("from", event.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-text-2">إلى تاريخ</span>
                  <Input aria-label="إلى تاريخ" type="date" value={to} onChange={(event) => list.setFilter("to", event.target.value)} />
                </label>
              </>
            }
          />

          {canModify && selected.length > 0 ? (
            <ShippingActions
              orderIds={selected}
              orderCodes={Object.fromEntries(server.items.map((item) => [item.orderId, item.orderCode]))}
              onComplete={() => { void refresh(); }}
            />
          ) : null}
          {refreshError ? <AlertLine>تم إرسال الإجراء؛ تعذر تحديث القائمة. حدّثي الصفحة للتحقق من النتائج.</AlertLine> : null}

          <ShipmentsTable
            items={server.items}
            narrowed={narrowed}
            canModify={canModify}
            selected={selected}
            selectableIds={selectable}
            onToggleRow={toggle}
            onSelectAll={(checked) => setSelected(checked ? selectable.slice(0, 50) : [])}
            sort={list.state.sort}
            onSort={list.toggleSort}
          />

          <SmartPagination {...list.paginationProps(server.total, server.loading)} />
        </>
      )}
    </AdminShell>
  );
}

function AlertLine({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="mb-4 text-sm text-danger">{children}</p>;
}
