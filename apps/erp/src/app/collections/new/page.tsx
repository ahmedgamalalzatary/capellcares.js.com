"use client";

import { CollectionForm } from "@/components/forms/collection-form";
import { buildRelatedOptions } from "@/components/forms/related-options";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { useStore } from "@/lib/store";

export default function NewCollectionPage() {
  const { user } = useAdminAuth();

  if (!canCreateErpModule(user, "collections")) {
    return (
      <AdminShell title="مجموعة جديدة" crumbs={[{ label: "المجموعات", href: "/collections" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية إنشاء المجموعات." />
      </AdminShell>
    );
  }

  return <NewCollectionPageContent />;
}

function NewCollectionPageContent() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);
  const collections = useStore((s) => s.collections);

  return (
    <AdminShell title="مجموعة جديدة" crumbs={[{ label: "المجموعات", href: "/collections" }, { label: "مجموعة جديدة" }]}>
      <CollectionForm
        mode="new"
        products={products}
        categories={categories}
        relatedOptions={buildRelatedOptions(products, offers, collections)}
      />
    </AdminShell>
  );
}
