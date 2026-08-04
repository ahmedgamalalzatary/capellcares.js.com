"use client";

import { use, useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { StaffEditorForm, type StaffFormState, type StaffUser } from "@/components/admin/staff-editor-form";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";

function toFormState(staffUser: StaffUser): StaffFormState {
  return {
    name: staffUser.name,
    email: staffUser.email,
    password: "",
    isActive: staffUser.isActive,
    permissionKeys: staffUser.permissionKeys
  };
}

export default function StaffEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, hydrated } = useAdminAuth();
  const router = useRouter();
  const { id } = use(params);
  const staffId = Number(id);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!hydrated || user?.role !== "admin") {
      return;
    }

    if (!Number.isInteger(staffId) || staffId <= 0) {
      setMissing(true);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setMissing(false);

    api.get<{ item: StaffUser }>(`/api/erp/staff/${staffId}`)
      .then((response) => {
        if (active) {
          setStaffUser(response.item);
        }
      })
      .catch((loadError: Error & { status?: number }) => {
        if (!active) {
          return;
        }

        if (loadError.status === 404) {
          setMissing(true);
          return;
        }

        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hydrated, staffId, user?.role]);

  if (!hydrated || !user) {
    return null;
  }

  if (user.role !== "admin") {
    return (
      <AdminShell title="تعديل عضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "غير مصرح" }]}>
        <section className="card card--pad-lg forbidden-state">
          <h2>غير مصرح</h2>
          <p>إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.</p>
        </section>
      </AdminShell>
    );
  }

  if (missing) {
    notFound();
  }

  if (loading) {
    return (
      <AdminShell title="تحميل العضو..." crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "تحميل" }]}>
        <div className="card">جارٍ تحميل بيانات العضو...</div>
      </AdminShell>
    );
  }

  if (error || !staffUser) {
    return (
      <AdminShell title="تعذر تحميل العضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "خطأ" }]}>
        <div className="card">{error ?? "تعذر تحميل بيانات العضو."}</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`تعديل: ${staffUser.name}`} crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "تعديل" }]}>
      <section className="card card--pad">
        <div className="staff-form__head">
          <h2 className="staff-form__heading">تعديل عضو</h2>
          <p className="muted staff-form__sub">
            حددي بيانات العضو وصلاحياته ثم احفظي التعديلات.
          </p>
        </div>
        <StaffEditorForm
          mode="edit"
          staffId={staffUser.id}
          initialValues={toFormState(staffUser)}
          resetLabel="إعادة تعيين"
          onSuccess={() => {
            router.push("/staff");
          }}
        />
      </section>
    </AdminShell>
  );
}
