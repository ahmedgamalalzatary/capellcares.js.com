"use client";

import { AdminShell } from "@/components/shell/admin-shell";
import { AdviceForm } from "@/components/forms/advice-form";

export default function NewAdvicePage() {
  return (
    <AdminShell
      title="نصيحة جديدة"
      crumbs={[{ label: "نصائح كابيلا", href: "/advices" }, { label: "نصيحة جديدة" }]}
    >
      <AdviceForm mode="new" />
    </AdminShell>
  );
}
