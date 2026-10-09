"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Layers, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import type { Collection } from "@capella/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu, RowMenuItem, RowMenuLink, RowMenuSeparator } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import type { SortState } from "@/hooks/use-table-sort";
import { formatMoney, formatNumber } from "@/lib/format";

export type CollectionSortKey = "name" | "category" | "items" | "price" | "original" | "status";

export const COLLECTION_SORT_COLUMNS: Array<{ key: CollectionSortKey; label: string }> = [
  { key: "name", label: "المجموعة" },
  { key: "category", label: "القسم" },
  { key: "items", label: "عدد العناصر" },
  { key: "price", label: "السعر" },
  { key: "original", label: "السعر الأصلي" },
  { key: "status", label: "الحالة" }
];

const itemCount = (collection: Collection) => collection.items.reduce((sum, item) => sum + item.qty, 0);

export function collectionSortAccessors(categories: Array<{ id: number; name: { ar: string } }>) {
  return {
    name: (collection: Collection) => collection.name.ar,
    category: (collection: Collection) => categories.find((category) => category.id === collection.categoryId)?.name.ar,
    items: itemCount,
    price: (collection: Collection) => collection.price,
    original: (collection: Collection) => collection.originalTotal,
    status: (collection: Collection) => (collection.status === "active" ? 0 : 1)
  } satisfies Record<CollectionSortKey, (collection: Collection) => string | number | null | undefined>;
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, index) => (
    <TR key={index} aria-hidden>
      <TD data-cell="lead">
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-11 rounded-thumb" />
          <div className="grid gap-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div>
        </div>
      </TD>
      <TD><Skeleton className="h-3.5 w-20" /></TD>
      <TD><Skeleton className="h-3.5 w-14" /></TD>
      <TD><Skeleton className="h-3.5 w-16" /></TD>
      <TD><Skeleton className="h-3.5 w-16" /></TD>
      <TD><Skeleton className="h-6 w-14 rounded-full" /></TD>
      <TD data-cell="actions" />
    </TR>
  ));
}

export function CollectionsTable({
  loading = false,
  collections,
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
  collections: Collection[];
  sort: SortState<CollectionSortKey> | null;
  onSort: (key: CollectionSortKey) => void;
  categories: Array<{ id: number; name: { ar: string } }>;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReorder?: boolean;
  onToggle: (collection: Collection) => void;
  onDelete: (id: number) => void;
  onMove?: (id: number, direction: -1 | 1) => void;
}) {
  const hasMenu = canToggle || canEdit || canDelete;
  const categoryName = (collection: Collection) => categories.find((category) => category.id === collection.categoryId)?.name.ar;
  const showReorder = canReorder && Boolean(onMove) && collections.length > 1 && !sort;

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            {COLLECTION_SORT_COLUMNS.map((column) => (
              <SortableTH key={column.key} direction={sort?.key === column.key ? sort.direction : null} onSort={() => onSort(column.key)}>
                {column.label}
              </SortableTH>
            ))}
            <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
          </tr>
        </THead>
        <TBody aria-busy={loading}>
          {loading ? <SkeletonRows /> : null}
          {!loading && collections.map((collection, index) => {
            const active = collection.status === "active";
            const initial = collection.name.en?.trim().charAt(0) || collection.name.ar?.trim().charAt(0) || "?";

            return (
              <TR key={collection.id} data-testid={`collection-row-${collection.id}`}>
                <TD data-cell="lead">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <Thumb src={collection.imagePath} fallback={initial} size="md" />
                    <div className="min-w-0">
                      <Link
                        href={`/collections/${collection.id}/edit`}
                        className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline"
                      >
                        {collection.name.ar}
                      </Link>
                      {collection.name.en ? <p dir="ltr" className="mt-0.5 truncate text-end text-sm text-text-muted">{collection.name.en}</p> : null}
                    </div>
                  </div>
                </TD>
                <TD data-label="القسم" className="text-text-2">{categoryName(collection) ?? "—"}</TD>
                <TD data-label="عدد العناصر" className="whitespace-nowrap text-text-2">
                  <span className="num">{formatNumber(itemCount(collection))}</span>
                </TD>
                <TD data-label="السعر" className="whitespace-nowrap">
                  <span className="num font-medium text-text-strong">{formatMoney(collection.price)}</span>
                </TD>
                <TD data-label="السعر الأصلي" className="whitespace-nowrap">
                  <span className="num text-text-muted line-through">{formatMoney(collection.originalTotal)}</span>
                </TD>
                <TD data-label="الحالة">
                  <Badge tone={active ? "success" : "neutral"}>{active ? "نشط" : "غير نشط"}</Badge>
                </TD>
                <TD data-cell="actions">
                  <div className="flex items-center justify-end gap-0.5">
                    {showReorder ? (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label="تحريك لأعلى" title="تحريك لأعلى" disabled={index === 0} onClick={() => onMove?.(collection.id, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="تحريك لأسفل" title="تحريك لأسفل" disabled={index === collections.length - 1} onClick={() => onMove?.(collection.id, 1)}>
                          <ArrowDown />
                        </Button>
                      </>
                    ) : null}
                    {hasMenu ? (
                      <RowMenu label={`إجراءات ${collection.name.ar}`}>
                        {canEdit ? (
                          <RowMenuLink href={`/collections/${collection.id}/edit`} aria-label={`تعديل ${collection.name.ar}`}>
                            <Pencil /> تعديل
                          </RowMenuLink>
                        ) : null}
                        {canToggle ? (
                          <RowMenuItem onClick={() => onToggle(collection)}>
                            {active ? <><PowerOff /> إيقاف</> : <><Power /> تفعيل</>}
                          </RowMenuItem>
                        ) : null}
                        {canDelete ? (
                          <>
                            <RowMenuSeparator />
                            <RowMenuItem danger onClick={() => onDelete(collection.id)} aria-label={`حذف ${collection.name.ar}`}>
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
          {!loading && collections.length === 0 ? (
            <TableState colSpan={7}>
              <EmptyState
                icon={<Layers />}
                title="لا توجد مجموعات تطابق البحث"
                description="جرّبي كلمة أخرى أو غيّري فلتر الحالة أو القسم."
              />
            </TableState>
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
