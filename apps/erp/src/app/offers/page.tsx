"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore, getStore } from "@/lib/store";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canToggleErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { formatPrice, type Offer } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { showErrorToast } from "@/lib/errors";

export default function OffersListPage() {
  const { user } = useAdminAuth();
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

  if (!canReadErpModule(user, "offers")) {
    return (
      <AdminShell title="العروض" crumbs={[{ label: "العروض" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى العروض." />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="العروض"
      crumbs={[{ label: "العروض" }]}
      actions={canCreateErpModule(user, "offers") ? <Link href="/offers/new" className="btn btn--primary btn--sm"><Icon.Plus /> عرض جديد</Link> : undefined}
    >
      <AdminListToolbar
        searchPlaceholder="ابحثي عن عرض…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={`${filtered.length} عرض`}
      />

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
                   <td><AdminStatusBadge active={o.status === "active"} activeLabel="نشط" inactiveLabel="غير نشط" /></td>
                   <td>
                     <div className="row" style={{ gap: 4 }}>
                       {canToggleErpModule(user, "offers") && (
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
                       )}
                       {canUpdateErpModule(user, "offers") && <Link href={`/offers/${o.id}/edit`} className="btn btn--ghost btn--sm"><Icon.Edit /></Link>}
                       {canSoftDeleteErpModule(user, "offers") && <button className="btn btn--ghost btn--sm" onClick={() => setPendingDelete(o.id)} style={{ color: "var(--danger)" }}>
                         <Icon.Trash />
                       </button>}
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

      <AdminConfirmModal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={() => {
          setPendingToggle(null);
          setToggleError(null);
        }}
        confirmLabel="تأكيد"
        onConfirm={async () => {
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
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذا العرض ولن يظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذا العرض ليظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p style={{ margin: "12px 0 0", color: "var(--danger)" }}>{toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف العرض"
        confirmClassName="btn btn--danger btn--sm"
        onConfirm={onDelete}
      >
        <p style={{ margin: 0 }}>سيتم نقل العرض إلى المحذوفات. يمكنك استعادته لاحقًا.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
