"use client";

import Link from "next/link";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { ReorderButtons } from "@/components/admin/reorder-buttons";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card } from "@/components/ui/card";
import { RowMenu, RowMenuItem, RowMenuLink, RowMenuSeparator } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableEmptyRow, TableSkeletonRows } from "@/components/admin/list-table";
import { Thumb } from "@/components/ui/thumb";
import type { SortState } from "@/hooks/use-table-sort";
import { formatMoney, formatNumber } from "@/lib/format";
import type { BundleConfig } from "@/features/bundles/bundle-config";
import type { BundleEntity } from "@/features/bundles/types";

interface Props<TBundle extends BundleEntity> {
  config: BundleConfig;
  loading?: boolean;
  /** Rows already filtered and sorted by the page. */
  rows: TBundle[];
  sort: SortState<string> | null;
  onSort: (key: string) => void;
  categories: Array<{ id: number; name: { ar: string } }>;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReorder?: boolean;
  onToggle: (bundle: TBundle) => void;
  onDelete: (id: number) => void;
  onMove?: (id: number, direction: -1 | 1) => void;
}

const itemCount = (bundle: BundleEntity) => bundle.items.reduce((sum, item) => sum + item.qty, 0);

/** The one offer/collection list table; columns, icon and the savings column come from the config. */
export function BundlesTable<TBundle extends BundleEntity>({
  config,
  loading = false,
  rows,
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
}: Props<TBundle>) {
  const { list } = config;
  const kind = config.kind;
  const EmptyIcon = list.icon;
  const hasMenu = canToggle || canEdit || canDelete;
  const label = (key: string) => list.columns.find((column) => column.key === key)?.label ?? "";
  const categoryName = (bundle: BundleEntity) => categories.find((category) => category.id === bundle.categoryId)?.name.ar;
  const showReorder = canReorder && Boolean(onMove) && rows.length > 1 && !sort;

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            {list.columns.map((column) => (
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
                ...(list.showSavings ? [<TD key="savings"><Skeleton className="h-3.5 w-16" /></TD>] : []),
                <TD key="status"><Skeleton className="h-6 w-14 rounded-full" /></TD>,
                <TD key="actions" data-cell="actions" />
              ]}
            />
          ) : null}
          {!loading && rows.map((bundle, index) => {
            const active = bundle.status === "active";
            const savings = bundle.originalTotal - bundle.price;
            const initial = bundle.name.en?.trim().charAt(0) || bundle.name.ar?.trim().charAt(0) || "?";
            const editHref = `/${kind}s/${bundle.id}/edit`;

            return (
              <TR key={bundle.id} data-testid={`${kind}-row-${bundle.id}`}>
                <TD data-cell="lead">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <Thumb src={bundle.imagePath} fallback={initial} size="md" />
                    <div className="min-w-0">
                      <Link
                        href={editHref}
                        className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline"
                      >
                        {bundle.name.ar}
                      </Link>
                      {bundle.name.en ? <p dir="ltr" className="mt-0.5 truncate text-end text-sm text-text-muted">{bundle.name.en}</p> : null}
                    </div>
                  </div>
                </TD>
                <TD data-label={label("category")} className="text-text-2">{categoryName(bundle) ?? "—"}</TD>
                <TD data-label={label("items")} className="whitespace-nowrap text-text-2">
                  <span className="num">{formatNumber(itemCount(bundle))}</span>
                </TD>
                <TD data-label={label("price")} className="whitespace-nowrap">
                  <span className="num font-medium text-text-strong">{formatMoney(bundle.price)}</span>
                </TD>
                <TD data-label={label("original")} className="whitespace-nowrap">
                  <span className="num text-text-muted line-through">{formatMoney(bundle.originalTotal)}</span>
                </TD>
                {list.showSavings ? (
                  <TD data-label={label("savings")} className="whitespace-nowrap">
                    {savings > 0 ? (
                      <span className="num font-medium text-success">{formatMoney(savings)}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </TD>
                ) : null}
                <TD data-label={label("status")}>
                  <StatusBadge active={active} />
                </TD>
                <TD data-cell="actions">
                  <div className="flex items-center justify-end gap-0.5">
                    {showReorder ? (
                      <ReorderButtons index={index} count={rows.length} className="gap-0.5" onMove={(_i, delta) => onMove?.(bundle.id, delta)} />
                    ) : null}
                    {hasMenu ? (
                      <RowMenu label={`إجراءات ${bundle.name.ar}`}>
                        {canEdit ? (
                          <RowMenuLink href={editHref} aria-label={`تعديل ${bundle.name.ar}`}>
                            <Pencil /> تعديل
                          </RowMenuLink>
                        ) : null}
                        {canToggle ? (
                          list.requireCategoryToToggle && !active && bundle.categoryId == null ? (
                            // A legacy offer with no category must be completed in the editor before it can go live.
                            <RowMenuItem disabled title={list.copy.activateNeedsCategory}>
                              <Power /> {list.copy.activateNeedsCategory}
                            </RowMenuItem>
                          ) : (
                            <RowMenuItem onClick={() => onToggle(bundle)}>
                              {active ? <><PowerOff /> إيقاف</> : <><Power /> تفعيل</>}
                            </RowMenuItem>
                          )
                        ) : null}
                        {canDelete ? (
                          <>
                            <RowMenuSeparator />
                            <RowMenuItem danger onClick={() => onDelete(bundle.id)} aria-label={`حذف ${bundle.name.ar}`}>
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
          {!loading && rows.length === 0 ? (
            <TableEmptyRow
              colSpan={list.columns.length + 1}
              icon={<EmptyIcon />}
              title={list.copy.emptyTitle}
              description="جرّبي كلمة أخرى أو غيّري فلتر الحالة أو القسم."
            />
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
