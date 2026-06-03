"use client";

import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { ProductForm } from "@/components/forms/product-form";
import { buildRelatedOptions } from "@/components/forms/related-options";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function NewProductPage() {
  const { user } = useAdminAuth();
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const offers = useStore((s) => s.offers);

  if (!canCreateErpModule(user, "products")) {
    return (
      <AdminShell title="منتج جديد" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية إنشاء المنتجات." />
      </AdminShell>
    );
  }
  return (
    <AdminShell title="منتج جديد" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "منتج جديد" }]}>
      <ProductForm mode="new" categories={categories} relatedOptions={buildRelatedOptions(products, offers)} />
    </AdminShell>
  );
}
