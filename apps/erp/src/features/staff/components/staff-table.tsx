"use client";

import Link from "next/link";
import { Pencil, Plus, Users } from "lucide-react";
import type { StaffUser } from "@/features/staff/types";
import { TableEmptyRow, TableSkeletonRows } from "@/components/admin/list-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { SortState } from "@/hooks/use-table-sort";
import { formatNumber } from "@/lib/format";

export type StaffSortKey = "name" | "email" | "status";

export const STAFF_SORT_COLUMNS: Array<{ key: StaffSortKey; label: string }> = [
  { key: "name", label: "الاسم" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "status", label: "الحالة" }
];

export function StaffTable({
  loading,
  staffUsers,
  sort,
  onSort
}: {
  loading: boolean;
  /** Rows already sorted by the page. */
  staffUsers: StaffUser[];
  sort: SortState<StaffSortKey> | null;
  onSort: (key: StaffSortKey) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            {STAFF_SORT_COLUMNS.map((column) => (
              <SortableTH key={column.key} direction={sort?.key === column.key ? sort.direction : null} onSort={() => onSort(column.key)}>
                {column.label}
              </SortableTH>
            ))}
            <TH>الصلاحيات</TH>
            <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
          </tr>
        </THead>
        <TBody aria-busy={loading}>
          {loading ? (
            <TableSkeletonRows
              rows={4}
              cells={[
                <TD key="lead" data-cell="lead"><Skeleton className="h-3.5 w-32" /></TD>,
                <TD key="email"><Skeleton className="h-3.5 w-44" /></TD>,
                <TD key="status"><Skeleton className="h-6 w-16 rounded-full" /></TD>,
                <TD key="permissions"><Skeleton className="h-3.5 w-20" /></TD>,
                <TD key="actions" data-cell="actions" />
              ]}
            />
          ) : null}
          {!loading && staffUsers.map((staffUser) => (
            <TR key={staffUser.id}>
              <TD data-cell="lead" className="font-medium text-text-strong">{staffUser.name}</TD>
              <TD data-label="البريد الإلكتروني" className="text-text-2"><span dir="ltr">{staffUser.email}</span></TD>
              <TD data-label="الحالة"><StatusBadge active={staffUser.isActive} /></TD>
              <TD data-label="الصلاحيات" className="text-text-2">
                {staffUser.permissionKeys.length === 0
                  ? <span className="text-text-muted">بدون صلاحيات</span>
                  : `${formatNumber(staffUser.permissionKeys.length)} صلاحية`}
              </TD>
              <TD data-cell="actions">
                <div className="flex justify-end">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/staff/${staffUser.id}/edit`}><Pencil /> تعديل</Link>
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
          {!loading && staffUsers.length === 0 ? (
            <TableEmptyRow
              colSpan={5}
              icon={<Users />}
              title="لا يوجد أعضاء فريق بعد"
              description="أضيفي أول عضو وحدّدي صلاحياته."
              action={
                <Button asChild variant="primary">
                  <Link href="/staff/new"><Plus /> إضافة عضو</Link>
                </Button>
              }
            />
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
