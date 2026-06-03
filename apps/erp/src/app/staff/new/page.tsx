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
        <section className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>غير مصرح</h2>
          <p style={{ marginBottom: 0 }}>إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="إضافة عضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "إضافة عضو" }]}>
      <section className="card" style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>إضافة عضو</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            أنشئي حسابات الموظفين وحددي الصلاحيات المطلوبة لكل عضو.
          </p>
        </div>
        <StaffEditorForm initialValues={createEmptyStaffForm()} mode="create" />
      </section>
    </AdminShell>
  );
}
