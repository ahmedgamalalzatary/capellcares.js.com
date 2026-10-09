"use client";

import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { CategoryForm } from "@/features/categories/components/category-form";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function NewCategoryPage() {
  const { user } = useAdminAuth();
  const categories = useStore((s) => s.categories);
  if (!canCreateErpModule(user, "categories")) {
    return (
      <ForbiddenPage title="قسم جديد" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية إنشاء الأقسام." />
    );
  }
  return (
    <AdminShell title="قسم جديد" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "قسم جديد" }]}>
      <CategoryForm mode="new" categories={categories} />
    </AdminShell>
  );
}
