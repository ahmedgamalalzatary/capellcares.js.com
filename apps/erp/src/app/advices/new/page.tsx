"use client";

import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { AdviceForm } from "@/components/forms/advice-form";
import { canCreateErpModule } from "@/lib/erp-permissions";

export default function NewAdvicePage() {
  const { user } = useAdminAuth();
  if (!canCreateErpModule(user, "advices")) {
    return (
      <AdminShell title="نصيحة جديدة" crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية إنشاء النصائح." />
      </AdminShell>
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
