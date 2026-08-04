"use client";

import { createEmptyStaffForm, StaffEditorForm } from "@/components/admin/staff-editor-form";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";

export default function StaffNewPage() {
  const { user, hydrated } = useAdminAuth();

  if (!hydrated || !user) {
    return null;
  }

  if (user.role !== "admin") {
    return (
      <AdminShell title="إضافة عضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "غير مصرح" }]}>
        <section className="card card--pad-lg forbidden-state">
          <h2>غير مصرح</h2>
          <p>إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="إضافة عضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "إضافة عضو" }]}>
      <section className="card card--pad">
        <div className="staff-form__head">
          <h2 className="staff-form__heading">إضافة عضو</h2>
          <p className="muted staff-form__sub">
            أنشئي حسابات الموظفين وحددي الصلاحيات المطلوبة لكل عضو.
          </p>
        </div>
        <StaffEditorForm initialValues={createEmptyStaffForm()} mode="create" />
      </section>
    </AdminShell>
  );
}
