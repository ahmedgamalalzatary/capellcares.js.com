"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/shell/admin-shell";
import { ProductForm } from "@/components/forms/product-form";
import { useStore } from "@/lib/store";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const loaded = useStore((s) => s.loaded);
  const error = useStore((s) => s.error);
  const product = products.find((p) => p.id === Number(id));

  if (!loaded) {
    return (
      <AdminShell title="تحميل المنتج..." crumbs={[{ label: "المنتجات", href: "/products" }, { label: "تحميل" }]}>
        <div className="card">جاري تحميل بيانات المنتج...</div>
      </AdminShell>
    );
  }

  if (error && !product) {
    return (
      <AdminShell title="تعذر تحميل المنتج" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "خطأ" }]}>
        <div className="card">{error}</div>
      </AdminShell>
    );
  }

  if (!product) return notFound();

  return (
    <AdminShell
      title={`تعديل: ${product.name.ar}`}
      crumbs={[{ label: "المنتجات", href: "/products" }, { label: "تعديل" }]}
    >
      <ProductForm mode="edit" initial={product} categories={categories} />
    </AdminShell>
  );
}
