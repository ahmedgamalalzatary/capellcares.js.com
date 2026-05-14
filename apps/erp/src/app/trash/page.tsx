"use client";

import { useState } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore, getStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";

type Tab = "products" | "categories" | "offers";

export default function TrashPage() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);
  const [tab, setTab] = useState<Tab>("products");

  const deletedProducts = products.filter((p) => p.deletedAt);
  const deletedCategories = categories.filter((c) => c.deletedAt);
  const deletedOffers = offers.filter((o) => o.deletedAt);

  const counts = { products: deletedProducts.length, categories: deletedCategories.length, offers: deletedOffers.length };

  return (
    <AdminShell title="المحذوفات" crumbs={[{ label: "المحذوفات" }]}>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card__head" style={{ padding: 0 }}>
          <div style={{ display: "flex" }}>
            {(["products", "categories", "offers"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: tab === t ? "var(--bg-elev)" : "transparent",
                  color: tab === t ? "var(--ink)" : "var(--ink-2)",
                  border: 0,
                  borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
                  padding: "14px 20px",
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                {t === "products" ? "المنتجات" : t === "categories" ? "الأقسام" : "العروض"}
                <span className="tag" style={{ marginInlineStart: 8 }}>{counts[t]}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === "products" && (
          <DeletedList
            empty="لا توجد منتجات محذوفة."
            rows={deletedProducts.map((p) => ({
              id: p.id,
              title: p.name.ar,
              subtitle: p.sku,
              meta: new Date(p.deletedAt!).toLocaleDateString("ar-EG")
            }))}
            onRestore={(id) => getStore().restoreProduct(id)}
          />
        )}
        {tab === "categories" && (
          <DeletedList
            empty="لا توجد أقسام محذوفة."
            rows={deletedCategories.map((c) => ({
              id: c.id,
              title: c.name.ar,
              subtitle: c.name.en,
              meta: new Date(c.deletedAt!).toLocaleDateString("ar-EG")
            }))}
            onRestore={(id) => getStore().restoreCategory(id)}
          />
        )}
        {tab === "offers" && (
          <DeletedList
            empty="لا توجد عروض محذوفة."
            rows={deletedOffers.map((o) => ({
              id: o.id,
              title: o.name.ar,
              subtitle: o.name.en,
              meta: new Date(o.deletedAt!).toLocaleDateString("ar-EG")
            }))}
            onRestore={(id) => getStore().restoreOffer(id)}
          />
        )}
      </div>
    </AdminShell>
  );
}

function DeletedList({
  rows, onRestore, empty
}: {
  rows: { id: number; title: string; subtitle: string; meta: string }[];
  onRestore: (id: number) => void;
  empty: string;
}) {
  if (rows.length === 0) {
    return <div style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>{empty}</div>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>العنصر</th>
          <th>تاريخ الحذف</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div className="faint" style={{ fontSize: 11 }}>{r.subtitle}</div>
            </td>
            <td className="muted">{r.meta}</td>
            <td>
              <button className="btn btn--ghost btn--sm" onClick={() => onRestore(r.id)}>
                <Icon.Check /> استعادة
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
