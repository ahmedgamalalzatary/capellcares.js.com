"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { RelatedItemRef } from "@capella/shared";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { OfferForm } from "@/components/forms/offer-form";
import { buildRelatedOptions } from "@/components/forms/related-options";
import { api } from "@/lib/api/client";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAdminAuth();
  const { id } = use(params);
  const offers = useStore((s) => s.offers);
  const products = useStore((s) => s.products);
  const collections = useStore((s) => s.collections);
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

  if (!canReadErpModule(user, "offers")) {
    return (
      <AdminShell title="العروض" crumbs={[{ label: "العروض", href: "/offers" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى العروض." />
      </AdminShell>
    );
  }

  if (!canUpdateErpModule(user, "offers")) {
    return (
      <AdminShell title="تعديل العرض" crumbs={[{ label: "العروض", href: "/offers" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية تعديل العروض." />
      </AdminShell>
    );
  }

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

  if (relatedItems === null && !relatedItemsError) {
    return (
      <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
        <div className="card">جاري تحميل بيانات العرض...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
      {relatedItemsError && (
        <div className="card card--spaced-bottom">
          تعذر تحميل العناصر المرتبطة الحالية. يمكنك تعديل باقي بيانات العرض، لكن تم تعطيل هذا القسم لتجنب حذف العلاقات الحالية. {relatedItemsError}
        </div>
      )}
      <OfferForm
        mode="edit"
        initial={relatedItems === null ? offer : { ...offer, relatedItems }}
        products={products}
        relatedOptions={buildRelatedOptions(products, offers, collections)}
        relatedItemsAvailable={!relatedItemsError}
      />
    </AdminShell>
  );
}
