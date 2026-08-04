"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type StaffUser } from "@/components/admin/staff-editor-form";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { api } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";

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
    if (!hydrated || user?.role !== "admin") {
      return;
    }
    void loadStaffManagement();
  }, [hydrated, user?.role]);

  if (!hydrated || !user) {
    return null;
  }

  if (user.role !== "admin") {
    return (
      <AdminShell title="فريق العمل" crumbs={[{ label: "فريق العمل" }]}>
        <section className="card card--pad-lg forbidden-state">
          <h2>غير مصرح</h2>
          <p>إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="فريق العمل"
      crumbs={[{ label: "فريق العمل" }]}
      actions={<Link href="/staff/new" className="btn btn--primary btn--sm"><Icon.Plus /> إضافة عضو</Link>}
    >
      <div className="staff-page staff-page__stack">
        <section className="card card--pad">
          <div className="row row--between staff-section__head">
            <h2 className="staff-form__heading">أعضاء الفريق</h2>
            <span className="muted">{staffUsers.length} عضو</span>
          </div>

          {loading ? <p className="muted">جارٍ تحميل أعضاء الفريق...</p> : null}

          {!loading && staffUsers.length === 0 ? <p className="muted">لا يوجد أعضاء فريق حتى الآن.</p> : null}

          {!loading && staffUsers.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الحالة</th>
                  <th>الصلاحيات</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((staffUser) => (
                  <tr key={staffUser.id}>
                    <td className="fw-700 c-ink">{staffUser.name}</td>
                    <td className="mono">{staffUser.email}</td>
                    <td>
                      <span className={`status ${staffUser.isActive ? "status--active" : "status--inactive"}`}>
                        {staffUser.isActive ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                    <td>
                      {staffUser.permissionKeys.length === 0 ? (
                        <span className="muted">بدون صلاحيات</span>
                      ) : (
                        <span className="tag" title={staffUser.permissionKeys.join(", ")}>
                          {staffUser.permissionKeys.length} صلاحية
                        </span>
                      )}
                    </td>
                    <td>
                      <Link href={`/staff/${staffUser.id}/edit`} className="btn btn--ghost btn--sm">
                        تعديل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
