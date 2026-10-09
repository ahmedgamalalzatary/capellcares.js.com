"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import type { AdminShipmentListItemDto } from "@capella/shared";
import { TableEmptyRow } from "@/components/admin/list-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { orderPaymentBadge } from "@/lib/payment-status";
import type { SortState } from "@/hooks/use-table-sort";
import { carrierStateLabels, custodyLabels, flagLabels, kindLabels, manualStateLabels, sizeLabels, workItemStatusLabels } from "@/features/shipping/lib/labels";

export type ShippingSortKey =
  | "code" | "kind" | "tracking" | "customer" | "carrier" | "manual"
  | "custody" | "size" | "shipping" | "payment" | "date";

export function ShipmentsTable({
  items,
  totalItems,
  canModify,
  selected,
  selectableIds,
  onToggleRow,
  onSelectAll,
  sort,
  onSort
}: {
  /** Rows already filtered and sorted by the page. */
  items: AdminShipmentListItemDto[];
  /** Unfiltered row count, used for the empty-state wording. */
  totalItems: number;
  canModify: boolean;
  selected: number[];
  selectableIds: number[];
  onToggleRow: (orderId: number) => void;
  onSelectAll: (checked: boolean) => void;
  sort: SortState<ShippingSortKey> | null;
  onSort: (key: ShippingSortKey) => void;
}) {
  return (
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
                  disabled={selectableIds.length === 0}
                  checked={selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id))}
                  onChange={(event) => onSelectAll(event.target.checked)}
                />
              </TH>
            ) : null}
            <SortableTH direction={sort?.key === "code" ? sort.direction : null} onSort={() => onSort("code")}>كود الطلب</SortableTH>
            <SortableTH direction={sort?.key === "kind" ? sort.direction : null} onSort={() => onSort("kind")}>النوع</SortableTH>
            <SortableTH direction={sort?.key === "tracking" ? sort.direction : null} onSort={() => onSort("tracking")}>رقم التتبع</SortableTH>
            <SortableTH direction={sort?.key === "customer" ? sort.direction : null} onSort={() => onSort("customer")}>العميل</SortableTH>
            <SortableTH direction={sort?.key === "carrier" ? sort.direction : null} onSort={() => onSort("carrier")}>حالة بوسطة</SortableTH>
            <SortableTH direction={sort?.key === "manual" ? sort.direction : null} onSort={() => onSort("manual")}>الحالة اليدوية</SortableTH>
            <SortableTH direction={sort?.key === "custody" ? sort.direction : null} onSort={() => onSort("custody")}>الحيازة</SortableTH>
            <SortableTH direction={sort?.key === "size" ? sort.direction : null} onSort={() => onSort("size")}>الحجم</SortableTH>
            <SortableTH direction={sort?.key === "shipping" ? sort.direction : null} onSort={() => onSort("shipping")}>الشحن</SortableTH>
            <SortableTH direction={sort?.key === "payment" ? sort.direction : null} onSort={() => onSort("payment")}>الدفع</SortableTH>
            <TH>العلامات</TH>
            <SortableTH direction={sort?.key === "date" ? sort.direction : null} onSort={() => onSort("date")}>التاريخ</SortableTH>
            <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
          </tr>
        </THead>
        <TBody>
          {items.map((item) => {
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
                        onChange={() => onToggleRow(item.orderId)}
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
                  {formatDate(item.orderCreatedAt)}
                </TD>
                <TD data-cell="actions">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/orders/${item.orderId}`}>التفاصيل</Link>
                  </Button>
                </TD>
              </TR>
            );
          })}
          {items.length === 0 ? (
            <TableEmptyRow
              colSpan={canModify ? 14 : 13}
              icon={<Truck />}
              title={totalItems === 0 ? "لا توجد شحنات بعد" : "لا توجد شحنات تطابق البحث"}
              description={totalItems === 0 ? "ستظهر الشحنات هنا بمجرد إنشائها." : "جرّبي كلمة أخرى أو غيّري عوامل التصفية."}
            />
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
