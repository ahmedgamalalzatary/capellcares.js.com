"use client";

import { CollectionForm } from "@/components/forms/collection-form";
import { buildRelatedOptions } from "@/components/forms/related-options";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore } from "@/lib/store";

export default function NewCollectionPage() {
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
