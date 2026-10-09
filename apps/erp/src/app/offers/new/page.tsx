"use client";

import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { OfferForm } from "@/features/offers/components/offer-form";
import { buildRelatedOptions } from "@/lib/related-options";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function NewOfferPage() {
  const { user } = useAdminAuth();
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);
  const collections = useStore((s) => s.collections);
  if (!canCreateErpModule(user, "offers")) {
    return (
      <ForbiddenPage title="عرض جديد" crumbs={[{ label: "العروض", href: "/offers" }, { label: "غير مصرح" }]} message="لا تملكين صلاحية إنشاء العروض." />
    );
  }
  return (
    <AdminShell title="عرض جديد" crumbs={[{ label: "العروض", href: "/offers" }, { label: "عرض جديد" }]}>
      <OfferForm mode="new" products={products} categories={categories} relatedOptions={buildRelatedOptions(products, offers, collections)} />
    </AdminShell>
  );
}
