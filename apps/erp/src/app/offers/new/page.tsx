"use client";

import { AdminShell } from "@/components/shell/admin-shell";
import { OfferForm } from "@/components/forms/offer-form";
import { useStore } from "@/lib/store";

export default function NewOfferPage() {
  const products = useStore((s) => s.products);
  return (
    <AdminShell title="عرض جديد" crumbs={[{ label: "العروض", href: "/offers" }, { label: "عرض جديد" }]}>
      <OfferForm mode="new" products={products} />
    </AdminShell>
  );
}
