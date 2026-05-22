"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/shell/admin-shell";
import { AdviceForm } from "@/components/forms/advice-form";
import { useStore } from "@/lib/store";

export default function EditAdvicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const advices = useStore((s) => s.advices);
  const loaded = useStore((s) => s.loaded);
  const advice = advices.find((a) => a.id === Number(id));

  if (!loaded) {
    return (
      <AdminShell title="تحميل…" crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "تحميل" }]}>
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>جارٍ تحميل البيانات…</div>
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
