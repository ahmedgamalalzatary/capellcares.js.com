"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { type StaffUser } from "@/features/staff/types";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Button } from "@/components/ui/button";
import { StaffTable } from "@/features/staff/components/staff-table";
import { api } from "@/lib/api/client";
import { SmartPagination } from "@/components/admin/smart-pagination";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import type { ListSchema } from "@/lib/pagination";
import { sortRows } from "@/lib/table-sort";

const staffSortAccessors = {
  name: (staffUser: StaffUser) => staffUser.name,
  email: (staffUser: StaffUser) => staffUser.email,
  status: (staffUser: StaffUser) => (staffUser.isActive ? 0 : 1)
};

const STAFF_LIST = {
  filters: {},
  sortKeys: ["name", "email", "status"]
} satisfies ListSchema<never, keyof typeof staffSortAccessors>;

export default function StaffManagementPage() {
  const { user, hydrated } = useAdminAuth();
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      // A failed delete already shows the API client's error toast; the dialog stays open to try again.
      await api.del(`/api/erp/staff/${pendingDelete.id}`);
      const deletedId = pendingDelete.id;
      setStaffUsers((current) => current.filter((staffUser) => staffUser.id !== deletedId));
      setPendingDelete(null);
    } catch {
      // Handled by the toast above.
    } finally {
      setDeleting(false);
    }
  }

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

  const list = usePaginatedList({ listId: "staff", schema: STAFF_LIST });
  const sortedRows = useMemo(() => sortRows(staffUsers, staffSortAccessors, list.state.sort), [list.state.sort, staffUsers]);

  if (!hydrated || !user) return null;

  if (user.role !== "admin") {
    return (
      <ForbiddenPage title="فريق العمل" crumbs={[{ label: "فريق العمل" }]} message="إدارة فريق العمل متاحة للمسؤول الرئيسي فقط." />
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
      <StaffTable
        loading={loading}
        staffUsers={list.pageOf(sortedRows)}
        sort={list.state.sort}
        onSort={list.toggleSort}
        onDelete={setPendingDelete}
      />
      <SmartPagination {...list.paginationProps(sortedRows.length, loading)} />

      <AdminConfirmModal
        open={pendingDelete != null}
        title="حذف العضو نهائيًا"
        onClose={() => { if (!deleting) setPendingDelete(null); }}
        confirmLabel={deleting ? "جارٍ الحذف…" : "حذف نهائي"}
        tone="danger"
        disableCancel={deleting}
        disableConfirm={deleting}
        onConfirm={confirmDelete}
      >
        <p>
          سيتم حذف حساب <strong className="text-text-strong">{pendingDelete?.name}</strong> وصلاحياته نهائيًا، ولن يتمكن من تسجيل الدخول.
          لا يمكن التراجع عن هذا. للإيقاف المؤقت يمكنك إيقاف الحساب بدلًا من حذفه.
        </p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
