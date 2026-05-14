"use client";

import { AdminShell } from "@/components/shell/admin-shell";
import { ProductForm } from "@/components/forms/product-form";
import { useStore } from "@/lib/store";

export default function NewProductPage() {
  const categories = useStore((s) => s.categories);
  return (
    <AdminShell title="منتج جديد" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "منتج جديد" }]}>
      <ProductForm mode="new" categories={categories} />
    </AdminShell>
  );
}
