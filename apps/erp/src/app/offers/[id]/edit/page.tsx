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
  const loaded = useStore((s) => s.loaded);
  const error = useStore((s) => s.error);
  const offer = offers.find((o) => o.id === Number(id));

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

  return (
    <AdminShell title={`تعديل: ${offer.name.ar}`} crumbs={[{ label: "العروض", href: "/offers" }, { label: "تعديل" }]}>
      <OfferForm mode="edit" initial={offer} products={products} />
    </AdminShell>
  );
}
