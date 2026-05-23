"use client";

import { useState } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore, getStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { showErrorToast } from "@/lib/errors";

type Tab = "products" | "categories" | "offers";

export default function TrashPage() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);
  const [tab, setTab] = useState<Tab>("products");
  const [pendingHardDelete, setPendingHardDelete] = useState<{ id: number; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeHardDeleteModal = () => {
    if (isDeleting) return;
    setPendingHardDelete(null);
    setDeleteError(null);
  };

  const deletedProducts = products.filter((p) => p.deletedAt);
  const deletedCategories = categories.filter((c) => c.deletedAt);
  const deletedOffers = offers.filter((o) => o.deletedAt);

  const counts = { products: deletedProducts.length, categories: deletedCategories.length, offers: deletedOffers.length };

  return (
    <AdminShell title="المحذوفات" crumbs={[{ label: "المحذوفات" }]}>
      <div className="card">
        <div className="card__head" style={{ padding: 0, borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex" }}>
            {(["products", "categories", "offers"] as Tab[]).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-3)",
                    border: 0,
                    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    padding: "16px 22px",
                    fontWeight: active ? 700 : 600,
                    fontSize: 13.5,
                    transition: "color 140ms, background 140ms",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  {t === "products" ? "المنتجات" : t === "categories" ? "الأقسام" : "العروض"}
                  <span className="tag" style={{ background: active ? "var(--accent-soft)" : "var(--warm-soft)", color: active ? "var(--accent)" : "var(--ink-3)", fontWeight: 700 }}>{counts[t]}</span>
                </button>
              );
            })}
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
            onHardDelete={(id, title) => setPendingHardDelete({ id, title })}
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

      <Modal
        open={pendingHardDelete != null}
        title="تأكيد الحذف النهائي"
        onClose={closeHardDeleteModal}
        footer={
          <>
            <button className="btn btn--ghost btn--sm" disabled={isDeleting} onClick={closeHardDeleteModal}>إلغاء</button>
            <button
              className="btn btn--danger btn--sm"
              disabled={isDeleting}
              onClick={async () => {
                if (!pendingHardDelete) return;
                try {
                  setIsDeleting(true);
                  setDeleteError(null);
                  await getStore().hardDeleteProduct(pendingHardDelete.id);
                  setPendingHardDelete(null);
                } catch (error) {
                  console.error(error);
                  const message = "تعذر حذف المنتج نهائياً. حاولي مرة أخرى.";
                  showErrorToast(error, message);
                  setDeleteError(message);
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "جارٍ الحذف..." : "حذف نهائي"}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          سيتم حذف "{pendingHardDelete?.title}" نهائياً مع كل بياناته. لا يمكن التراجع عن هذا الإجراء.
        </p>
        {deleteError ? <p style={{ margin: "12px 0 0", color: "var(--danger)" }}>{deleteError}</p> : null}
      </Modal>
    </AdminShell>
  );
}

function DeletedList({
  rows, onRestore, onHardDelete, empty
}: {
  rows: { id: number; title: string; subtitle: string; meta: string }[];
  onRestore: (id: number) => void;
  onHardDelete?: (id: number, title: string) => void;
  empty: string;
}) {
  if (rows.length === 0) {
    return <div style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>{empty}</div>;
  }
  return (
    <div className="table-outer">
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
              <div style={{ display: "inline-flex", gap: 8 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => onRestore(r.id)}>
                  <Icon.Check /> استعادة
                </button>
                {onHardDelete && (
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ color: "var(--danger, #c0392b)" }}
                    onClick={() => onHardDelete(r.id, r.title)}
                  >
                    <Icon.Trash /> حذف نهائي
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
