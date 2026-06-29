"use client";

import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { OfferForm } from "@/components/forms/offer-form";
import { buildRelatedOptions } from "@/components/forms/related-options";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function NewOfferPage() {
  const { user } = useAdminAuth();
  const products = useStore((s) => s.products);
  const offers = useStore((s) => s.offers);
  const collections = useStore((s) => s.collections);
  if (!canCreateErpModule(user, "offers")) {
    return (
      <AdminShell title="عرض جديد" crumbs={[{ label: "العروض", href: "/offers" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية إنشاء العروض." />
      </AdminShell>
    );
  }
  return (
    <AdminShell title="عرض جديد" crumbs={[{ label: "العروض", href: "/offers" }, { label: "عرض جديد" }]}>
      <OfferForm mode="new" products={products} relatedOptions={buildRelatedOptions(products, offers, collections)} />
    </AdminShell>
  );
}
