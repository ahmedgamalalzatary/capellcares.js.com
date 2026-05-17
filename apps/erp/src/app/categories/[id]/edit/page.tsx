"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/shell/admin-shell";
import { CategoryForm } from "@/components/forms/category-form";
import { useStore } from "@/lib/store";

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const categories = useStore((s) => s.categories);
  const loaded = useStore((s) => s.loaded);
  const error = useStore((s) => s.error);
  const category = categories.find((c) => c.id === Number(id));

  if (!loaded) {
    return (
      <AdminShell title="تحميل القسم..." crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "تحميل" }]}>
        <div className="card">جاري تحميل بيانات القسم...</div>
      </AdminShell>
    );
  }

  if (error && !category) {
    return (
      <AdminShell title="تعذر تحميل القسم" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "خطأ" }]}>
        <div className="card">{error}</div>
      </AdminShell>
    );
  }

  if (!category) return notFound();
  return (
    <AdminShell title={`تعديل: ${category.name.ar}`} crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "تعديل" }]}>
      <CategoryForm mode="edit" initial={category} categories={categories} />
    </AdminShell>
  );
}
