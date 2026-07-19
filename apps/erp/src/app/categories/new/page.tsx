"use client";

import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { CategoryForm } from "@/components/forms/category-form";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function NewCategoryPage() {
  const { user } = useAdminAuth();
  const categories = useStore((s) => s.categories);
  if (!canCreateErpModule(user, "categories")) {
    return (
      <AdminShell title="قسم جديد" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملك صلاحية إنشاء الأقسام." />
      </AdminShell>
    );
  }
  return (
    <AdminShell title="قسم جديد" crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "قسم جديد" }]}>
      <CategoryForm mode="new" categories={categories} />
    </AdminShell>
  );
}
