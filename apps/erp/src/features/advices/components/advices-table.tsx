"use client";

import Link from "next/link";
import { Lightbulb, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import type { Advice } from "@capella/shared";
import { TableEmptyRow, TableSkeletonRows } from "@/components/admin/list-table";
import { ReorderButtons } from "@/components/admin/reorder-buttons";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card } from "@/components/ui/card";
import { RowMenu, RowMenuItem, RowMenuLink, RowMenuSeparator } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { SortState } from "@/hooks/use-table-sort";

export type AdviceSortKey = "title" | "video" | "status";

export const ADVICE_SORT_COLUMNS: Array<{ key: AdviceSortKey; label: string }> = [
  { key: "title", label: "العنوان" },
  { key: "video", label: "الفيديو" },
  { key: "status", label: "الحالة" }
];

export function AdvicesTable({
  loading,
  advices,
  sort,
  onSort,
  showReorder,
  canToggle,
  canEdit,
  canDelete,
  onMove,
  onToggle,
  onDelete,
  emptyTitle,
  emptyDescription
}: {
  loading: boolean;
  /** Rows already filtered and sorted by the page. */
  advices: Advice[];
  sort: SortState<AdviceSortKey> | null;
  onSort: (key: AdviceSortKey) => void;
  showReorder: boolean;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onMove: (id: number, direction: -1 | 1) => void;
  onToggle: (advice: Advice) => void;
  onDelete: (advice: Advice) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            {ADVICE_SORT_COLUMNS.map((column) => (
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
                <TD key="lead" data-cell="lead"><div className="grid gap-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div></TD>,
                <TD key="video"><Skeleton className="h-3.5 w-48" /></TD>,
                <TD key="status"><Skeleton className="h-6 w-14 rounded-full" /></TD>,
                <TD key="actions" data-cell="actions" />
              ]}
            />
          ) : null}
          {!loading && advices.map((advice, index) => {
            const active = advice.status === "active";
            return (
              <TR key={advice.id}>
                <TD data-cell="lead">
                  <div className="min-w-0">
                    <Link href={`/advices/${advice.id}/edit`} className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">
                      {advice.title.ar}
                    </Link>
                    {advice.title.en ? <p dir="ltr" className="mt-0.5 truncate text-end text-sm text-text-muted">{advice.title.en}</p> : null}
                  </div>
                </TD>
                <TD data-label="الفيديو" className="max-w-md">
                  <bdi className="block truncate text-sm text-text-2">{advice.videoUrl}</bdi>
                </TD>
                <TD data-label="الحالة"><StatusBadge active={active} /></TD>
                <TD data-cell="actions">
                  <div className="flex items-center justify-end gap-0.5">
                    {showReorder ? (
                      <ReorderButtons index={index} count={advices.length} className="gap-0.5" onMove={(_i, delta) => onMove(advice.id, delta)} />
                    ) : null}
                    {canToggle || canEdit || canDelete ? (
                      <RowMenu label={`إجراءات ${advice.title.ar}`}>
                        {canToggle ? (
                          <RowMenuItem onClick={() => onToggle(advice)}>
                            {active ? <><PowerOff /> إيقاف</> : <><Power /> تفعيل</>}
                          </RowMenuItem>
                        ) : null}
                        {canEdit ? (
                          <RowMenuLink href={`/advices/${advice.id}/edit`}><Pencil /> تعديل</RowMenuLink>
                        ) : null}
                        {canDelete ? (
                          <>
                            <RowMenuSeparator />
                            <RowMenuItem danger onClick={() => onDelete(advice)}><Trash2 /> حذف</RowMenuItem>
                          </>
                        ) : null}
                      </RowMenu>
                    ) : null}
                  </div>
                </TD>
              </TR>
            );
          })}
          {!loading && advices.length === 0 ? (
            <TableEmptyRow colSpan={4} icon={<Lightbulb />} title={emptyTitle} description={emptyDescription} />
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
