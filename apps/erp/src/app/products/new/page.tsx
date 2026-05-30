"use client";

import { AdminShell } from "@/components/shell/admin-shell";
import { ProductForm } from "@/components/forms/product-form";
import { buildRelatedOptions } from "@/components/forms/related-options";
import { useStore } from "@/lib/store";

export default function NewProductPage() {
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const offers = useStore((s) => s.offers);
  return (
    <AdminShell title="منتج جديد" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "منتج جديد" }]}>
      <ProductForm mode="new" categories={categories} relatedOptions={buildRelatedOptions(products, offers)} />
    </AdminShell>
  );
}
