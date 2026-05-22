"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore, getStore } from "@/lib/store";
import { formatPrice, type Offer } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { showErrorToast } from "@/lib/errors";

export default function OffersListPage() {
  const offers = useStore((s) => s.offers);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Offer | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const visibleOffers = useMemo(() => offers.filter((o) => !o.deletedAt), [offers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return visibleOffers;
    const s = search.trim().toLowerCase();
    return visibleOffers.filter((o) =>
      o.name.ar.toLowerCase().includes(s) ||
      o.name.en.toLowerCase().includes(s)
    );
  }, [visibleOffers, search]);

  const onDelete = () => {
    if (pendingDelete == null) return;
    getStore().softDeleteOffer(pendingDelete);
    setPendingDelete(null);
  };

  return (
    <AdminShell
      title="العروض"
      crumbs={[{ label: "العروض" }]}
      actions={<Link href="/offers/new" className="btn btn--primary btn--sm"><Icon.Plus /> عرض جديد</Link>}
    >
      <div className="toolbar">
        <div className="search">
          <Icon.Search />
          <input placeholder="ابحثي عن عرض…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ marginInlineStart: "auto" }} className="muted">{filtered.length} عرض</div>
      </div>

      <div className="card">
        <div className="table-outer"><table className="table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>الاسم</th>
              <th>عدد المنتجات</th>
              <th>سعر الباقة</th>
              <th>السعر الأصلي</th>
              <th>التوفير</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const savings = o.originalTotal - o.price;
              return (
                <tr key={o.id}>
                  <td>
                    <div className="avatar-tile avatar-tile--wide">
                      {o.name.en[0]}
                    </div>
                  </td>
                  <td>
                    <Link href={`/offers/${o.id}/edit`} className="table-title">{o.name.ar}</Link>
                    <div className="table-subtitle">{o.name.en}</div>
                  </td>
                  <td>{o.items.reduce((acc, it) => acc + it.qty, 0)} عنصر</td>
                   <td>{formatPrice(o.price, "ar")}</td>
                   <td className="faint" style={{ textDecoration: "line-through" }}>{formatPrice(o.originalTotal, "ar")}</td>
                   <td><span className="status status--active">{formatPrice(savings, "ar")}</span></td>
                   <td>
                     {o.status === "active"
                       ? <span className="status status--active">نشط</span>
                       : <span className="status status--inactive">غير نشط</span>}
                   </td>
                   <td>
                     <div className="row" style={{ gap: 4 }}>
                       <button
                         className="btn btn--ghost btn--sm"
                         onClick={() => {
                           setToggleError(null);
                           setPendingToggle(o);
                         }}
                         title={o.status === "active" ? "إيقاف" : "تفعيل"}
                       >
                         {o.status === "active" ? <Icon.X /> : <Icon.Check />}
                       </button>
                       <Link href={`/offers/${o.id}/edit`} className="btn btn--ghost btn--sm"><Icon.Edit /></Link>
                       <button className="btn btn--ghost btn--sm" onClick={() => setPendingDelete(o.id)} style={{ color: "var(--danger)" }}>
                         <Icon.Trash />
                       </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>لا توجد عروض.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Modal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={() => {
          setPendingToggle(null);
          setToggleError(null);
        }}
        footer={<>
          <button className="btn btn--ghost btn--sm" onClick={() => { setPendingToggle(null); setToggleError(null); }}>إلغاء</button>
          <button
            className="btn btn--primary btn--sm"
            onClick={async () => {
              if (!pendingToggle) return;
              try {
                setToggleError(null);
                await getStore().toggleOfferStatus(pendingToggle.id);
                setPendingToggle(null);
              } catch (error) {
                showErrorToast(error, "تعذر تحديث حالة العرض. حاولي مرة أخرى.");
                setToggleError("تعذر تحديث حالة العرض. حاولي مرة أخرى.");
              }
            }}
          >
            تأكيد
          </button>
        </>}
      >
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذا العرض ولن يظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذا العرض ليظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p style={{ margin: "12px 0 0", color: "var(--danger)" }}>{toggleError}</p> : null}
      </Modal>

      <Modal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        footer={<>
          <button className="btn btn--ghost btn--sm" onClick={() => setPendingDelete(null)}>إلغاء</button>
          <button className="btn btn--danger btn--sm" onClick={onDelete}>حذف العرض</button>
        </>}
      >
        <p style={{ margin: 0 }}>سيتم نقل العرض إلى المحذوفات. يمكنك استعادته لاحقًا.</p>
      </Modal>
    </AdminShell>
  );
}
