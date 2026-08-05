"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { EntityAvatar } from "@/components/admin/entity-avatar";
import { RowMenu } from "@/components/ui/row-menu";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore, getStore } from "@/lib/store";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canToggleErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { formatPrice, type Category, type Offer } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { showErrorToast } from "@/lib/errors";
import { buildCategoryTreeOptions } from "@/lib/category-tree";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";

function isInCategoryTree(categories: Category[], categoryId: number | null, selectedCategoryId: number) {
  if (categoryId == null) return false;
  let current = categories.find((category) => category.id === categoryId);
  const visited = new Set<number>();
  while (current) {
    if (visited.has(current.id)) return false;
    if (current.id === selectedCategoryId) return true;
    visited.add(current.id);
    current = current.parentId != null
      ? categories.find((category) => category.id === current!.parentId)
      : undefined;
  }
  return false;
}

export default function OffersListPage() {
  const { user } = useAdminAuth();
  const offers = useStore((s) => s.offers);
  const categories = useStore((s) => s.categories);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Offer | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const visibleOffers = useMemo(() => offers.filter((o) => !o.deletedAt), [offers]);
  const reorder = useListReorder({
    persistedIds: useMemo(() => visibleOffers.map((o) => o.id), [visibleOffers]),
    save: (ids) => getStore().reorderOffers({ ids }),
    successMessage: "تم حفظ ترتيب العروض.",
    errorMessage: "تعذر حفظ ترتيب العروض. حاولي مرة أخرى."
  });
  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);
  // Reordering needs the complete list, so it is hidden while a filter hides part of it.
  const canReorder = !search.trim() && statusFilter === "all" && categoryFilter === "" && canUpdateErpModule(user, "offers");

  const filtered = useMemo(() => {
    const ordered = sortByIdOrder(visibleOffers, reorder.orderedIds)
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => categoryFilter === "" || isInCategoryTree(categories, o.categoryId, categoryFilter));
    if (!search.trim()) return ordered;
    const s = search.trim().toLowerCase();
    return ordered.filter((o) =>
      o.name.ar.toLowerCase().includes(s) ||
      o.name.en.toLowerCase().includes(s)
    );
  }, [visibleOffers, search, statusFilter, categories, categoryFilter, reorder.orderedIds]);

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
      actions={
        <>
          {reorder.isDirty && canUpdateErpModule(user, "offers") && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                void reorder.saveOrder();
              }}
              disabled={reorder.saving}
            >
              <Icon.Check /> حفظ ترتيب العروض
            </button>
          )}
          {canCreateErpModule(user, "offers") ? <Link href="/offers/new" className="btn btn--primary btn--sm"><Icon.Plus /> عرض جديد</Link> : undefined}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي عن عرض…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={`${filtered.length} عرض`}
        filters={[
          {
            key: "status",
            label: "حالة العرض",
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as "all" | "active" | "inactive"),
            options: ACTIVE_STATUS_FILTER_OPTIONS
          },
          {
            key: "category",
            label: "قسم العرض",
            value: String(categoryFilter),
            onChange: (value) => setCategoryFilter(value ? Number(value) : ""),
            options: [
              { value: "", label: "كل الأقسام" },
              ...categoryOptions.map((option) => ({
                value: String(option.id),
                label: `${"— ".repeat(option.depth)}${option.label}`
              }))
            ]
          }
        ]}
      />

      <div className="card">
        <div className="table-outer"><table className="table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>الاسم</th>
              <th>القسم</th>
              <th>عدد المنتجات</th>
              <th>سعر الباقة</th>
              <th>السعر الأصلي</th>
              <th>التوفير</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, index) => {
              const savings = o.originalTotal - o.price;
              const category = categories.find((item) => item.id === o.categoryId);
              return (
                <tr key={o.id} data-testid={`offer-row-${o.id}`}>
                  <td>
                    <EntityAvatar src={o.imagePath} fallback={o.name.en[0] ?? "?"} wide />
                  </td>
                  <td>
                    <Link href={`/offers/${o.id}/edit`} className="table-title">{o.name.ar}</Link>
                    <div className="table-subtitle">{o.name.en}</div>
                  </td>
                  <td>{category ? category.name.ar : "—"}</td>
                  <td>{o.items.reduce((acc, it) => acc + it.qty, 0)} عنصر</td>
                   <td>{formatPrice(o.price, "ar")}</td>
                   <td className="faint cell-strike">{formatPrice(o.originalTotal, "ar")}</td>
                   <td><span className="status status--active">{formatPrice(savings, "ar")}</span></td>
                   <td><AdminStatusBadge active={o.status === "active"} activeLabel="نشط" inactiveLabel="غير نشط" /></td>
                   <td>
                     <div className="row row--actions">
                     {canReorder && filtered.length > 1 && (
                       <>
                         <button
                           type="button"
                           className="btn btn--ghost btn--sm"
                           onClick={() => reorder.moveItem(o.id, -1)}
                           aria-label="تحريك لأعلى"
                           disabled={index === 0}
                         >
                           <Icon.Chevron size={14} className="rotate-180" />
                         </button>
                         <button
                           type="button"
                           className="btn btn--ghost btn--sm"
                           onClick={() => reorder.moveItem(o.id, 1)}
                           aria-label="تحريك لأسفل"
                           disabled={index === filtered.length - 1}
                         >
                           <Icon.Chevron size={14} />
                         </button>
                       </>
                     )}
                     {(canToggleErpModule(user, "offers") || canUpdateErpModule(user, "offers") || canSoftDeleteErpModule(user, "offers")) && (
                       <RowMenu>
                         {canToggleErpModule(user, "offers") && (
                           // An offer with no category predates classification and has to be
                           // completed in the editor before it can go live. The API rejects the
                           // activation anyway, so the action is not offered here at all.
                           o.status !== "active" && o.categoryId == null ? (
                             <span className="row-menu__item row-menu__item--disabled">
                               اختاري قسمًا للعرض قبل تفعيله
                             </span>
                           ) : (
                             <button
                               type="button"
                               className="row-menu__item"
                               onClick={() => {
                                 setToggleError(null);
                                 setPendingToggle(o);
                               }}
                               title={o.status === "active" ? "إيقاف" : "تفعيل"}
                             >
                               {o.status === "active" ? <><Icon.X /> إيقاف</> : <><Icon.Check /> تفعيل</>}
                             </button>
                           )
                         )}
                         {canUpdateErpModule(user, "offers") && (
                           <Link href={`/offers/${o.id}/edit`} className="row-menu__item"><Icon.Edit /> تعديل</Link>
                         )}
                         {canSoftDeleteErpModule(user, "offers") && (
                           <button type="button" className="row-menu__item row-menu__item--danger" onClick={() => setPendingDelete(o.id)}>
                             <Icon.Trash /> حذف
                           </button>
                         )}
                       </RowMenu>
                     )}
                     </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="state-note state-note--muted">لا توجد عروض.</td></tr>
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
        <p className="modal-note">
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذا العرض ولن يظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذا العرض ليظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p className="modal-note modal-note--error">{toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف العرض"
        confirmClassName="btn btn--danger btn--sm"
        onConfirm={onDelete}
      >
        <p className="modal-note">سيتم نقل العرض إلى المحذوفات. يمكنك استعادته لاحقًا.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
