"use client";

import { AdminShell } from "@/components/shell/admin-shell";
import { CategoryForm } from "@/components/forms/category-form";
import { useStore } from "@/lib/store";

export default function NewCategoryPage() {
  const categories = useStore((s) => s.categories);
  return (
    <AdminShell title="قسم جديد" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "قسم جديد" }]}>
      <CategoryForm mode="new" categories={categories} />
    </AdminShell>
  );
}
