"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { RelatedItemRef } from "@capella/shared";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { CollectionForm } from "@/components/forms/collection-form";
import { buildRelatedOptions } from "@/components/forms/related-options";
import { AdminShell } from "@/components/shell/admin-shell";
import { api } from "@/lib/api/client";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAdminAuth();
  const { id } = use(params);
  const collections = useStore((s) => s.collections);
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);
  const loaded = useStore((s) => s.loaded);
  const error = useStore((s) => s.error);
  const collection = collections.find((item) => item.id === Number(id));

  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | null>(null);
  const [relatedItemsError, setRelatedItemsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRelatedItems(null);
    setRelatedItemsError(null);
    api
      .get<{ relatedItems?: RelatedItemRef[] }>(`/api/erp/collections/${id}`)
      .then((detail) => {
        if (active) setRelatedItems(detail.relatedItems ?? []);
      })
      .catch((fetchError) => {
        if (active) {
          setRelatedItemsError(fetchError instanceof Error ? fetchError.message : "تعذر تحميل العناصر المرتبطة.");
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!canReadErpModule(user, "collections")) {
    return (
      <AdminShell title="المجموعات" crumbs={[{ label: "المجموعات", href: "/collections" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى المجموعات." />
      </AdminShell>
    );
  }

  if (!canUpdateErpModule(user, "collections")) {
    return (
      <AdminShell title="تعديل المجموعة" crumbs={[{ label: "المجموعات", href: "/collections" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية تعديل المجموعات." />
      </AdminShell>
    );
  }

  if (!loaded) {
    return (
      <AdminShell title="تحميل المجموعة..." crumbs={[{ label: "المجموعات", href: "/collections" }, { label: "تحميل" }]}>
        <div className="card">جاري تحميل بيانات المجموعة...</div>
      </AdminShell>
    );
  }

  if (error && !collection) {
    return (
      <AdminShell title="تعذر تحميل المجموعة" crumbs={[{ label: "المجموعات", href: "/collections" }, { label: "خطأ" }]}>
        <div className="card">{error}</div>
      </AdminShell>
    );
  }

  if (!collection) return notFound();

  if (relatedItems === null && !relatedItemsError) {
    return (
      <AdminShell title={`تعديل: ${collection.name.ar}`} crumbs={[{ label: "المجموعات", href: "/collections" }, { label: "تعديل" }]}>
        <div className="card">جاري تحميل بيانات المجموعة...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`تعديل: ${collection.name.ar}`} crumbs={[{ label: "المجموعات", href: "/collections" }, { label: "تعديل" }]}>
      {relatedItemsError && (
        <div className="card card--spaced-bottom">
          تعذر تحميل العناصر المرتبطة الحالية. يمكنك تعديل باقي بيانات المجموعة، لكن تم تعطيل هذا القسم لتجنب حذف العلاقات الحالية. {relatedItemsError}
        </div>
      )}
      <CollectionForm
        mode="edit"
        initial={relatedItems === null ? collection : { ...collection, relatedItems }}
        products={products}
        categories={categories}
        relatedOptions={buildRelatedOptions(products, offers, collections)}
        relatedItemsAvailable={!relatedItemsError}
      />
    </AdminShell>
  );
}
