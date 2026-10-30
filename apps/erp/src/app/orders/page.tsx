"use client";

import Link from "next/link";
import { } from "lucide-react";
import type { OrderSummary } from "@capella/shared";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { canReadErpModule } from "@/lib/erp-permissions";
import { formatNumber, isDateKey, localDayEnd, localDayStart } from "@/lib/format";
import { paymentStatusFilterOptions, paymentStatusLabel } from "@/lib/payment-status";
import { SmartPagination } from "@/components/admin/smart-pagination";
import { usePaginatedList, useServerPage } from "@/hooks/use-paginated-list";
import type { ListSchema } from "@/lib/pagination";
import { ORDER_SORT_KEYS, type OrderSortKey } from "@/features/orders/components/orders-table";

export default function OrdersPage() {
  const { user } = useAdminAuth();

  if (!canReadErpModule(user, "orders")) {
    return (
      <ForbiddenPage title="الطلبات" crumbs={[{ label: "الطلبات" }]} message="لا تملكين صلاحية الوصول إلى الطلبات." />
    );
  }

  return <OrdersPageContent />;
}

const ORDERS_LIST = {
  filters: {
    payment: { default: "all", values: ["all", ...Object.keys(paymentStatusLabel)] },
    from: { default: "", accepts: isDateKey },
    to: { default: "", accepts: isDateKey }
  },
  sortKeys: ORDER_SORT_KEYS
} satisfies ListSchema<"payment" | "from" | "to", OrderSortKey>;

// The address keeps calendar days; the server compares exact instants, so send the viewer's own day bounds.
const ordersRequest = (filters: Record<"payment" | "from" | "to", string>) => ({
  payment: filters.payment === "all" ? undefined : filters.payment,
  from: filters.from ? localDayStart(filters.from) : undefined,
  to: filters.to ? localDayEnd(filters.to) : undefined
});

function OrdersPageContent() {
  const list = usePaginatedList({ listId: "orders", schema: ORDERS_LIST, searchDelay: 300, toRequest: ordersRequest });
  const server = useServerPage<OrderSummary>(list.ready ? `/api/erp/orders?${list.requestQuery}` : null);
  const { payment, from, to } = list.state.filters;
  const narrowed = Boolean(list.state.q) || payment !== "all" || Boolean(from) || Boolean(to);

  return (
    <AdminShell
      title="الطلبات"
      crumbs={[{ label: "الطلبات" }]}
      description="كل طلبات المتجر وحالة دفعها وتفاصيلها."
    >
      <AdminListHeader
        searchPlaceholder="ابحثي بكود الطلب، الاسم، البريد، أو الهاتف…"
        searchValue={list.searchInput}
        onSearchChange={list.setSearch}
        countLabel={server.loading ? "جارٍ التحميل…" : `${formatNumber(server.total)} طلب`}
        filters={[
          {
            key: "paymentStatus",
            label: "حالة الدفع",
            value: payment,
            onChange: (value) => list.setFilter("payment", value),
            options: paymentStatusFilterOptions
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

      <OrdersTable
        loading={server.loading && server.items.length === 0}
        error={server.error}
        onRetry={() => { void server.reload(); }}
        orders={server.items}
        sort={list.state.sort}
        onSort={list.toggleSort}
        emptyTitle={narrowed ? "لا توجد طلبات تطابق البحث" : "لا توجد طلبات بعد"}
        emptyDescription={narrowed ? "جرّبي كلمة أخرى أو غيّري فلتر الدفع أو التاريخ." : "ستظهر الطلبات هنا بمجرد وصولها من المتجر."}
      />

      <SmartPagination {...list.paginationProps(server.total, server.loading)} />
    </AdminShell>
  );
}
