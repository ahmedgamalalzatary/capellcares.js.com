"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { CategoryForm } from "@/components/forms/category-form";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAdminAuth();
  const { id } = use(params);
  const categories = useStore((s) => s.categories);
  const loaded = useStore((s) => s.loaded);
  const error = useStore((s) => s.error);
  const category = categories.find((c) => c.id === Number(id));

  if (!canReadErpModule(user, "categories")) {
    return (
      <AdminShell title="الأقسام" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى الأقسام." />
      </AdminShell>
    );
  }

  if (!canUpdateErpModule(user, "categories")) {
    return (
      <AdminShell title="تعديل القسم" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية تعديل الأقسام." />
      </AdminShell>
    );
  }

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
