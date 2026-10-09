"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { RelatedItemRef } from "@capella/shared";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { OfferForm } from "@/features/offers/components/offer-form";
import { buildRelatedOptions } from "@/lib/related-options";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { FormSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAdminAuth();
  const { id } = use(params);
  const offers = useStore((s) => s.offers);
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
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
          setRelatedItemsError(getErrorMessage(error, "تعذر تحميل العناصر المرتبطة."));
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!canReadErpModule(user, "offers")) {
    return (
      <ForbiddenPage title="العروض" crumbs={[{ label: "العروض", href: "/offers" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية الوصول إلى العروض." />
    );
  }

  if (!canUpdateErpModule(user, "offers")) {
    return (
      <ForbiddenPage title="تعديل العرض" crumbs={[{ label: "العروض", href: "/offers" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية تعديل العروض." />
    );
  }

  if (!loaded) {
    return (
      <AdminShell title="تحميل العرض…" crumbs={[{ label: "العروض", href: "/offers" }, { label: "تحميل" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }

  if (error && !offer) {
    return (
      <AdminShell title="تعذر تحميل العرض" crumbs={[{ label: "العروض", href: "/offers" }, { label: "خطأ" }]}>
        <Card>
          <div className="p-5 sm:p-6">
            <Alert tone="danger" title="تعذر تحميل بيانات العرض">{error}</Alert>
          </div>
        </Card>
      </AdminShell>
    );
  }

  if (!offer) return notFound();

  if (relatedItems === null && !relatedItemsError) {
    return (
      <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
      {relatedItemsError ? (
        <div className="mb-5">
          <Alert tone="warning">
            تعذر تحميل العناصر المرتبطة الحالية. يمكنك تعديل باقي بيانات العرض، لكن تم تعطيل هذا القسم لتجنب حذف العلاقات الحالية. {relatedItemsError}
          </Alert>
        </div>
      ) : null}
      <OfferForm
        mode="edit"
        initial={relatedItems === null ? offer : { ...offer, relatedItems }}
        products={products}
        categories={categories}
        relatedOptions={buildRelatedOptions(products, offers, collections)}
        relatedItemsAvailable={!relatedItemsError}
      />
    </AdminShell>
  );
}
