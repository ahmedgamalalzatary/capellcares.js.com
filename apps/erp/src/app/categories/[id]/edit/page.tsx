"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { CategoryForm } from "@/features/categories/components/category-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { FormSkeleton } from "@/components/ui/skeleton";
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
      <ForbiddenPage title="الأقسام" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية الوصول إلى الأقسام." />
    );
  }

  if (!canUpdateErpModule(user, "categories")) {
    return (
      <ForbiddenPage title="تعديل القسم" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية تعديل الأقسام." />
    );
  }

  if (!loaded) {
    return (
      <AdminShell title="تحميل القسم…" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "تحميل" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }

  if (error && !category) {
    return (
      <AdminShell title="تعذر تحميل القسم" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "خطأ" }]}>
        <Card>
          <div className="p-5 sm:p-6">
            <Alert tone="danger" title="تعذر تحميل بيانات القسم">{error}</Alert>
          </div>
        </Card>
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
