"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { AdviceForm } from "@/features/advices/components/advice-form";
import { FormSkeleton } from "@/components/ui/skeleton";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function EditAdvicePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAdminAuth();
  const { id } = use(params);
  const advices = useStore((s) => s.advices);
  const loaded = useStore((s) => s.loaded);
  const advice = advices.find((a) => a.id === Number(id));

  if (!canReadErpModule(user, "advices")) {
    return (
      <ForbiddenPage title="نصائح كابيلا" crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية الوصول إلى النصائح." />
    );
  }

  if (!canUpdateErpModule(user, "advices")) {
    return (
      <ForbiddenPage title="تعديل النصيحة" crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية تعديل النصائح." />
    );
  }

  if (!loaded) {
    return (
      <AdminShell title="تحميل…" crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "تحميل" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }

  if (!advice) return notFound();

  return (
    <AdminShell
      title={`تعديل: ${advice.title.ar}`}
      crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "تعديل" }]}
    >
      <AdviceForm mode="edit" initial={advice} />
    </AdminShell>
  );
}
