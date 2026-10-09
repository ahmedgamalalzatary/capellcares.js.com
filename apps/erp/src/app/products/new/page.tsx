"use client";

import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { ProductForm } from "@/features/products/components/product-form";
import { buildRelatedOptions } from "@/lib/related-options";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function NewProductPage() {
  const { user } = useAdminAuth();
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const offers = useStore((s) => s.offers);
  const collections = useStore((s) => s.collections);

  if (!canCreateErpModule(user, "products")) {
    return (
      <ForbiddenPage title="منتج جديد" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية إنشاء المنتجات." />
    );
  }
  return (
    <AdminShell title="إضافة منتج جديد" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "منتج جديد" }]}>
      <ProductForm mode="new" categories={categories} relatedOptions={buildRelatedOptions(products, offers, collections)} />
    </AdminShell>
  );
}
