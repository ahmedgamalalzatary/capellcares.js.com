"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu, RowMenuItem } from "@/components/ui/row-menu";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { TrashListRow } from "../../types/trash-page.types";

export function DeletedList({
  rows,
  onRestore,
  onHardDelete,
  empty
}: {
  rows: TrashListRow[];
  onRestore?: (id: number) => void;
  onHardDelete?: (id: number, title: string) => void;
  empty: string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={<Trash2 />} title={empty} className="py-12" />;
  }

  return (
    <Table>
      <THead>
        <tr>
          <TH>العنصر</TH>
          <TH>تاريخ الحذف</TH>
          <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
        </tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <TR key={row.id}>
            <TD data-cell="lead">
              <span className="block font-medium text-text-strong">{row.title}</span>
              <span className="block text-sm text-text-muted">{row.subtitle}</span>
            </TD>
            <TD data-label="تاريخ الحذف" className="whitespace-nowrap text-text-2">{row.meta}</TD>
            <TD data-cell="actions">
              <div className="flex justify-end">
                {onRestore || onHardDelete ? (
                  <RowMenu label={`إجراءات ${row.title}`}>
                    {onRestore ? (
                      <RowMenuItem onClick={() => onRestore(row.id)}>
                        <RotateCcw /> استعادة
                      </RowMenuItem>
                    ) : null}
                    {onHardDelete ? (
                      <RowMenuItem danger onClick={() => onHardDelete(row.id, row.title)}>
                        <Trash2 /> حذف نهائي
                      </RowMenuItem>
                    ) : null}
                  </RowMenu>
                ) : null}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
