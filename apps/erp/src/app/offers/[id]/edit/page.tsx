"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { RelatedItemRef } from "@capella/shared";
import { AdminShell } from "@/components/shell/admin-shell";
import { OfferForm } from "@/components/forms/offer-form";
import { buildRelatedOptions } from "@/components/forms/related-options";
import { api } from "@/lib/api/client";
import { useStore } from "@/lib/store";

export default function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const offers = useStore((s) => s.offers);
  const products = useStore((s) => s.products);
  const loaded = useStore((s) => s.loaded);
  const error = useStore((s) => s.error);
  const offer = offers.find((o) => o.id === Number(id));

  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | null>(null);
  const [relatedItemsError, setRelatedItemsError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setRelatedItems(null);
    setRelatedItemsError(null);
    api
      .get<{ relatedItems?: RelatedItemRef[] }>(`/api/erp/offers/${id}`)
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
      <AdminShell title="تحميل العرض..." crumbs={[{ label: "العروض", href: "/offers" }, { label: "تحميل" }]}>
        <div className="card">جاري تحميل بيانات العرض...</div>
      </AdminShell>
    );
  }

  if (error && !offer) {
    return (
      <AdminShell title="تعذر تحميل العرض" crumbs={[{ label: "العروض", href: "/offers" }, { label: "خطأ" }]}>
        <div className="card">{error}</div>
      </AdminShell>
    );
  }

  if (!offer) return notFound();

  if (relatedItemsError) {
    return (
      <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
        <div className="card">تعذر تحميل العناصر المرتبطة. لم يتم فتح نموذج الحفظ لتجنب حذف العلاقات الحالية. {relatedItemsError}</div>
      </AdminShell>
    );
  }

  if (relatedItems === null) {
    return (
      <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
        <div className="card">جاري تحميل بيانات العرض...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
      <OfferForm
        mode="edit"
        initial={{ ...offer, relatedItems }}
        products={products}
        relatedOptions={buildRelatedOptions(products, offers)}
      />
    </AdminShell>
  );
}
