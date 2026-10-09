"use client";

import { use, useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { StaffEditorForm } from "@/features/staff/components/staff-editor-form";
import { toFormState } from "@/features/staff/lib/staff-form-state";
import type { StaffUser } from "@/features/staff/types";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";

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
        if (active) setStaffUser(response.item);
      })
      .catch((loadError: Error & { status?: number }) => {
        if (!active) return;
        if (loadError.status === 404) {
          setMissing(true);
          return;
        }
        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [hydrated, staffId, user?.role]);

  if (!hydrated || !user) {
    return null;
  }

  if (user.role !== "admin") {
    return (
      <ForbiddenPage title="تعديل عضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "غير مصرح" }]} message="إدارة فريق العمل متاحة للمسؤول الرئيسي فقط." />
    );
  }

  if (missing) {
    notFound();
  }

  if (loading) {
    return (
      <AdminShell title="تحميل العضو…" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "تحميل" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }

  if (error || !staffUser) {
    return (
      <AdminShell title="تعذر تحميل العضو" crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "خطأ" }]}>
        <Card>
          <CardBody className="pt-5 sm:pt-6">
            <Alert tone="danger">{error ?? "تعذر تحميل بيانات العضو."}</Alert>
          </CardBody>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`تعديل: ${staffUser.name}`} crumbs={[{ label: "فريق العمل", href: "/staff" }, { label: "تعديل" }]}>
      <Card>
        <CardHeader title="بيانات العضو" description="حدّدي بيانات العضو وصلاحياته ثم احفظي التعديلات." />
        <CardBody>
          <StaffEditorForm
            mode="edit"
            staffId={staffUser.id}
            initialValues={toFormState(staffUser)}
            resetLabel="إعادة تعيين"
            onSuccess={() => {
              router.push("/staff");
            }}
          />
        </CardBody>
      </Card>
    </AdminShell>
  );
}
