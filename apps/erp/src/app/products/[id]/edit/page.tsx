"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { RelatedItemRef } from "@capella/shared";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Alert } from "@/components/ui/alert";
import { FormSkeleton } from "@/components/ui/skeleton";
import { ProductForm } from "@/components/forms/product-form";
import { buildRelatedOptions } from "@/lib/related-options";
import { api } from "@/lib/api/client";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAdminAuth();
  if (!canReadErpModule(user, "products")) {
    return (
      <AdminShell title="المنتجات" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى المنتجات." />
      </AdminShell>
    );
  }

  if (!canUpdateErpModule(user, "products")) {
    return (
      <AdminShell title="تعديل المنتج" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية تعديل المنتجات." />
      </AdminShell>
    );
  }

  return <EditProductPageContent params={params} />;
}

function EditProductPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const products = useStore((s) => s.products);
  const offers = useStore((s) => s.offers);
  const collections = useStore((s) => s.collections);
  const categories = useStore((s) => s.categories);
  const loaded = useStore((s) => s.loaded);
  const error = useStore((s) => s.error);
  const product = products.find((p) => p.id === Number(id));
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | null>(null);
  const [relatedItemsError, setRelatedItemsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRelatedItems(null);
    setRelatedItemsError(null);
    api
      .get<{ relatedItems?: RelatedItemRef[] }>(`/api/erp/products/${id}`)
      .then((detail) => {
        if (active) setRelatedItems(detail.relatedItems ?? []);
      })
      .catch((error) => {
        if (active) {
          setRelatedItemsError(error instanceof Error ? error.message : "تعذر تحميل العناصر المرتبطة.");
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!loaded) {
    return (
      <AdminShell title="تعديل المنتج" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "تعديل" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }

  if (error && !product) {
    return (
      <AdminShell title="تعذر تحميل المنتج" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "خطأ" }]}>
        <Alert tone="danger" title="تعذر تحميل بيانات المنتج">{error}</Alert>
      </AdminShell>
    );
  }

  if (!product) return notFound();

  if (relatedItems === null && !relatedItemsError) {
    return (
      <AdminShell title={`تعديل: ${product.name.ar}`} crumbs={[{ label: "المنتجات", href: "/products" }, { label: "تعديل" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={`تعديل: ${product.name.ar}`}
      crumbs={[{ label: "المنتجات", href: "/products" }, { label: "تعديل" }]}
    >
      <ProductForm
        mode="edit"
        initial={relatedItems === null ? product : { ...product, relatedItems }}
        categories={categories}
        relatedOptions={buildRelatedOptions(products, offers, collections)}
        relatedItemsAvailable={!relatedItemsError}
      />
    </AdminShell>
  );
}
