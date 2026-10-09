"use client";

import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { AdviceForm } from "@/features/advices/components/advice-form";
import { canCreateErpModule } from "@/lib/erp-permissions";

export default function NewAdvicePage() {
  const { user } = useAdminAuth();
  if (!canCreateErpModule(user, "advices")) {
    return (
      <ForbiddenPage title="نصيحة جديدة" crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية إنشاء النصائح." />
    );
  }
  return (
    <AdminShell
      title="نصيحة جديدة"
      crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "نصيحة جديدة" }]}
    >
      <AdviceForm mode="new" />
    </AdminShell>
  );
}
