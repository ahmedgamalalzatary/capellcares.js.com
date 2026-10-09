"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pencil, Plus, Users } from "lucide-react";
import { type StaffUser } from "@/components/admin/staff-editor-form";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { useTableSort } from "@/hooks/use-table-sort";

type StaffSortKey = "name" | "email" | "status";

const STAFF_SORT_COLUMNS: Array<{ key: StaffSortKey; label: string }> = [
  { key: "name", label: "الاسم" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "status", label: "الحالة" }
];

export default function StaffManagementPage() {
  const { user, hydrated } = useAdminAuth();
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadStaffManagement() {
    setLoading(true);
    try {
      const staffResponse = await api.get<{ items: StaffUser[] }>("/api/erp/staff");
      setStaffUsers(staffResponse.items);
    } catch {
      setStaffUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated || user?.role !== "admin") return;
    void loadStaffManagement();
  }, [hydrated, user?.role]);

  const { sort, toggleSort, sortedRows } = useTableSort(staffUsers, {
    name: (staffUser) => staffUser.name,
    email: (staffUser) => staffUser.email,
    status: (staffUser) => (staffUser.isActive ? 0 : 1)
  });

  if (!hydrated || !user) return null;

  if (user.role !== "admin") {
    return (
      <AdminShell title="فريق العمل" crumbs={[{ label: "فريق العمل" }]}>
        <ErpForbiddenState message="إدارة فريق العمل متاحة للمسؤول الرئيسي فقط." />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="فريق العمل"
      crumbs={[{ label: "فريق العمل" }]}
      description="حسابات الموظفين وصلاحياتهم."
      actions={
        <Button asChild variant="primary">
          <Link href="/staff/new"><Plus /> إضافة عضو</Link>
        </Button>
      }
    >
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              {STAFF_SORT_COLUMNS.map((column) => (
                <SortableTH key={column.key} direction={sort?.key === column.key ? sort.direction : null} onSort={() => toggleSort(column.key)}>
                  {column.label}
                </SortableTH>
              ))}
              <TH>الصلاحيات</TH>
              <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
            </tr>
          </THead>
          <TBody aria-busy={loading}>
            {loading ? Array.from({ length: 4 }, (_, index) => (
              <TR key={index} aria-hidden>
                <TD data-cell="lead"><Skeleton className="h-3.5 w-32" /></TD>
                <TD><Skeleton className="h-3.5 w-44" /></TD>
                <TD><Skeleton className="h-6 w-16 rounded-full" /></TD>
                <TD><Skeleton className="h-3.5 w-20" /></TD>
                <TD data-cell="actions" />
              </TR>
            )) : null}
            {!loading && sortedRows.map((staffUser) => (
              <TR key={staffUser.id}>
                <TD data-cell="lead" className="font-medium text-text-strong">{staffUser.name}</TD>
                <TD data-label="البريد الإلكتروني" className="text-text-2"><span dir="ltr">{staffUser.email}</span></TD>
                <TD data-label="الحالة"><Badge tone={staffUser.isActive ? "success" : "neutral"}>{staffUser.isActive ? "نشط" : "غير نشط"}</Badge></TD>
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
            {!loading && sortedRows.length === 0 ? (
              <TableState colSpan={5}>
                <EmptyState
                  icon={<Users />}
                  title="لا يوجد أعضاء فريق بعد"
                  description="أضيفي أول عضو وحدّدي صلاحياته."
                  action={
                    <Button asChild variant="primary">
                      <Link href="/staff/new"><Plus /> إضافة عضو</Link>
                    </Button>
                  }
                />
              </TableState>
            ) : null}
          </TBody>
        </Table>
      </Card>
    </AdminShell>
  );
}
