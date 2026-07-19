"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { AdviceForm } from "@/components/forms/advice-form";
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
      <AdminShell title="نصائح مينى كشك" crumbs={[{ label: "نصائح مينى كشك", href: "/advices" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملك صلاحية الوصول إلى النصائح." />
      </AdminShell>
    );
  }

  if (!canUpdateErpModule(user, "advices")) {
    return (
      <AdminShell title="تعديل النصيحة" crumbs={[{ label: "نصائح مينى كشك", href: "/advices" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملك صلاحية تعديل النصائح." />
      </AdminShell>
    );
  }

  if (!loaded) {
    return (
      <AdminShell title="تحميل…" crumbs={[{ label: "نصائح مينى كشك", href: "/advices" }, { label: "تحميل" }]}>
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>جارٍ تحميل البيانات…</div>
      </AdminShell>
    );
  }

  if (!advice) return notFound();

  return (
    <AdminShell
      title={`تعديل: ${advice.title.ar}`}
      crumbs={[{ label: "نصائح مينى كشك", href: "/advices" }, { label: "تعديل" }]}
    >
      <AdviceForm mode="edit" initial={advice} />
    </AdminShell>
  );
}
