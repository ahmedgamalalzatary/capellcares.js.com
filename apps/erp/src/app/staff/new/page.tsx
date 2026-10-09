"use client";

import { StaffEditorForm } from "@/features/staff/components/staff-editor-form";
import { createEmptyStaffForm } from "@/features/staff/lib/staff-form-state";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function StaffNewPage() {
  const { user, hydrated } = useAdminAuth();

  if (!hydrated || !user) {
    return null;
  }

  if (user.role !== "admin") {
    return (
      <AdminShell title="إضافة عضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="إدارة فريق العمل متاحة للمسؤول الرئيسي فقط." />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="إضافة عضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "إضافة عضو" }]}>
      <Card>
        <CardHeader title="بيانات العضو" description="أنشئي حساب الموظف وحدّدي الصلاحيات المطلوبة له." />
        <CardBody>
          <StaffEditorForm initialValues={createEmptyStaffForm()} mode="create" />
        </CardBody>
      </Card>
    </AdminShell>
  );
}
