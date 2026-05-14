"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/shell/admin-shell";
import { OfferForm } from "@/components/forms/offer-form";
import { useStore } from "@/lib/store";

export default function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const offers = useStore((s) => s.offers);
  const products = useStore((s) => s.products);
  const offer = offers.find((o) => o.id === Number(id));
  if (!offer) return notFound();

  return (
    <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
      <OfferForm mode="edit" initial={offer} products={products} />
    </AdminShell>
  );
}
