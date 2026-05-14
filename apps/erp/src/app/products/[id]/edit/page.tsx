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
  const product = products.find((p) => p.id === Number(id));
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
