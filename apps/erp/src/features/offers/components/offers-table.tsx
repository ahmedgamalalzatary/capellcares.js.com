"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Gift, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import type { Offer } from "@capella/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RowMenu, RowMenuItem, RowMenuLink, RowMenuSeparator } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableEmptyRow, TableSkeletonRows } from "@/components/admin/list-table";
import { Thumb } from "@/components/ui/thumb";
import type { SortState } from "@/hooks/use-table-sort";
import { formatMoney, formatNumber } from "@/lib/format";

export type OfferSortKey = "name" | "category" | "items" | "price" | "original" | "savings" | "status";

export const OFFER_SORT_COLUMNS: Array<{ key: OfferSortKey; label: string }> = [
  { key: "name", label: "العرض" },
  { key: "category", label: "القسم" },
  { key: "items", label: "عدد المنتجات" },
  { key: "price", label: "سعر الباقة" },
  { key: "original", label: "السعر الأصلي" },
  { key: "savings", label: "التوفير" },
  { key: "status", label: "الحالة" }
];

const itemCount = (offer: Offer) => offer.items.reduce((sum, item) => sum + item.qty, 0);
const savingsOf = (offer: Offer) => offer.originalTotal - offer.price;

export function offerSortAccessors(categories: Array<{ id: number; name: { ar: string } }>) {
  return {
    name: (offer: Offer) => offer.name.ar,
    category: (offer: Offer) => categories.find((category) => category.id === offer.categoryId)?.name.ar,
    items: itemCount,
    price: (offer: Offer) => offer.price,
    original: (offer: Offer) => offer.originalTotal,
    savings: savingsOf,
    status: (offer: Offer) => (offer.status === "active" ? 0 : 1)
  } satisfies Record<OfferSortKey, (offer: Offer) => string | number | null | undefined>;
}

export function OffersTable({
  loading = false,
  offers,
  sort,
  onSort,
  categories,
  canToggle,
  canEdit,
  canDelete,
  canReorder = false,
  onToggle,
  onDelete,
  onMove
}: {
  loading?: boolean;
  /** Rows already filtered and sorted by the page. */
  offers: Offer[];
  sort: SortState<OfferSortKey> | null;
  onSort: (key: OfferSortKey) => void;
  categories: Array<{ id: number; name: { ar: string } }>;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReorder?: boolean;
  onToggle: (offer: Offer) => void;
  onDelete: (id: number) => void;
  onMove?: (id: number, direction: -1 | 1) => void;
}) {
  const hasMenu = canToggle || canEdit || canDelete;
  const categoryName = (offer: Offer) => categories.find((category) => category.id === offer.categoryId)?.name.ar;
  const showReorder = canReorder && Boolean(onMove) && offers.length > 1 && !sort;

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            {OFFER_SORT_COLUMNS.map((column) => (
              <SortableTH key={column.key} direction={sort?.key === column.key ? sort.direction : null} onSort={() => onSort(column.key)}>
                {column.label}
              </SortableTH>
            ))}
            <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
          </tr>
        </THead>
        <TBody aria-busy={loading}>
          {loading ? (
            <TableSkeletonRows
              cells={[
                <TD key="lead" data-cell="lead">
                  <div className="flex items-center gap-3.5">
                    <Skeleton className="size-11 rounded-thumb" />
                    <div className="grid gap-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div>
                  </div>
                </TD>,
                <TD key="category"><Skeleton className="h-3.5 w-20" /></TD>,
                <TD key="items"><Skeleton className="h-3.5 w-14" /></TD>,
                <TD key="price"><Skeleton className="h-3.5 w-16" /></TD>,
                <TD key="original"><Skeleton className="h-3.5 w-16" /></TD>,
                <TD key="savings"><Skeleton className="h-3.5 w-16" /></TD>,
                <TD key="status"><Skeleton className="h-6 w-14 rounded-full" /></TD>,
                <TD key="actions" data-cell="actions" />
              ]}
            />
          ) : null}
          {!loading && offers.map((offer, index) => {
            const active = offer.status === "active";
            const savings = savingsOf(offer);
            const initial = offer.name.en?.trim().charAt(0) || offer.name.ar?.trim().charAt(0) || "?";

            return (
              <TR key={offer.id} data-testid={`offer-row-${offer.id}`}>
                <TD data-cell="lead">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <Thumb src={offer.imagePath} fallback={initial} size="md" />
                    <div className="min-w-0">
                      <Link
                        href={`/offers/${offer.id}/edit`}
                        className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline"
                      >
                        {offer.name.ar}
                      </Link>
                      {offer.name.en ? <p dir="ltr" className="mt-0.5 truncate text-end text-sm text-text-muted">{offer.name.en}</p> : null}
                    </div>
                  </div>
                </TD>
                <TD data-label="القسم" className="text-text-2">{categoryName(offer) ?? "—"}</TD>
                <TD data-label="عدد المنتجات" className="whitespace-nowrap text-text-2">
                  <span className="num">{formatNumber(itemCount(offer))}</span>
                </TD>
                <TD data-label="سعر الباقة" className="whitespace-nowrap">
                  <span className="num font-medium text-text-strong">{formatMoney(offer.price)}</span>
                </TD>
                <TD data-label="السعر الأصلي" className="whitespace-nowrap">
                  <span className="num text-text-muted line-through">{formatMoney(offer.originalTotal)}</span>
                </TD>
                <TD data-label="التوفير" className="whitespace-nowrap">
                  {savings > 0 ? (
                    <span className="num font-medium text-success">{formatMoney(savings)}</span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </TD>
                <TD data-label="الحالة">
                  <Badge tone={active ? "success" : "neutral"}>{active ? "نشط" : "غير نشط"}</Badge>
                </TD>
                <TD data-cell="actions">
                  <div className="flex items-center justify-end gap-0.5">
                    {showReorder ? (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label="تحريك لأعلى" title="تحريك لأعلى" disabled={index === 0} onClick={() => onMove?.(offer.id, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="تحريك لأسفل" title="تحريك لأسفل" disabled={index === offers.length - 1} onClick={() => onMove?.(offer.id, 1)}>
                          <ArrowDown />
                        </Button>
                      </>
                    ) : null}
                    {hasMenu ? (
                      <RowMenu label={`إجراءات ${offer.name.ar}`}>
                        {canEdit ? (
                          <RowMenuLink href={`/offers/${offer.id}/edit`} aria-label={`تعديل ${offer.name.ar}`}>
                            <Pencil /> تعديل
                          </RowMenuLink>
                        ) : null}
                        {canToggle ? (
                          active || offer.categoryId != null ? (
                            <RowMenuItem onClick={() => onToggle(offer)}>
                              {active ? <><PowerOff /> إيقاف</> : <><Power /> تفعيل</>}
                            </RowMenuItem>
                          ) : (
                            // A legacy offer with no category must be completed in the editor before it can go live.
                            <RowMenuItem disabled title="اختاري قسمًا للعرض قبل تفعيله">
                              <Power /> اختاري قسمًا للعرض قبل تفعيله
                            </RowMenuItem>
                          )
                        ) : null}
                        {canDelete ? (
                          <>
                            <RowMenuSeparator />
                            <RowMenuItem danger onClick={() => onDelete(offer.id)} aria-label={`حذف ${offer.name.ar}`}>
                              <Trash2 /> حذف
                            </RowMenuItem>
                          </>
                        ) : null}
                      </RowMenu>
                    ) : null}
                  </div>
                </TD>
              </TR>
            );
          })}
          {!loading && offers.length === 0 ? (
            <TableEmptyRow
              colSpan={8}
              icon={<Gift />}
              title="لا توجد عروض تطابق البحث"
              description="جرّبي كلمة أخرى أو غيّري فلتر الحالة أو القسم."
            />
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
