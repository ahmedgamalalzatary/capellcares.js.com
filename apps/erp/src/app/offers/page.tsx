"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CircleDot, FolderTree, Plus } from "lucide-react";
import type { Offer } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { OFFER_SORT_COLUMNS, OffersTable, offerSortAccessors, type OfferSortKey } from "@/components/offers-table";
import { buildCategoryTreeOptions, isInCategoryTree } from "@/lib/category-tree";
import { showErrorToast } from "@/lib/errors";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canToggleErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { getStore, useStore } from "@/lib/store";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";
import { useTableSort } from "@/hooks/use-table-sort";

export default function OffersListPage() {
  const { user } = useAdminAuth();
  const offers = useStore((s) => s.offers);
  const categories = useStore((s) => s.categories);
  const loaded = useStore((s) => s.loaded);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Offer | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const visibleOffers = useMemo(() => offers.filter((offer) => !offer.deletedAt), [offers]);
  const reorder = useListReorder({
    persistedIds: useMemo(() => visibleOffers.map((offer) => offer.id), [visibleOffers]),
    save: (ids) => getStore().reorderOffers({ ids }),
    successMessage: "تم حفظ ترتيب العروض.",
    errorMessage: "تعذر حفظ ترتيب العروض. حاولي مرة أخرى."
  });
  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);

  const filteredOffers = useMemo(() => {
    const ordered = sortByIdOrder(visibleOffers, reorder.orderedIds)
      .filter((offer) => statusFilter === "all" || offer.status === statusFilter)
      .filter((offer) => categoryFilter === "" || isInCategoryTree(categories, offer.categoryId, categoryFilter));
    if (!search.trim()) return ordered;
    const needle = search.trim().toLowerCase();
    return ordered.filter((offer) =>
      offer.name.ar.toLowerCase().includes(needle) ||
      offer.name.en.toLowerCase().includes(needle) ||
      offer.slug.toLowerCase().includes(needle)
    );
  }, [visibleOffers, search, statusFilter, categories, categoryFilter, reorder.orderedIds]);

  const { sort, setSort, toggleSort, sortedRows } = useTableSort(filteredOffers, offerSortAccessors(categories));
  const reorderEnabled = canUpdateErpModule(user, "offers") && !search.trim() && statusFilter === "all" && categoryFilter === "";

  const closeToggleModal = () => {
    if (isToggling) return;
    setPendingToggle(null);
    setToggleError(null);
  };

  const confirmDelete = async () => {
    if (pendingDelete == null) return;
    try {
      await getStore().softDeleteOffer(pendingDelete);
      setPendingDelete(null);
    } catch (error) {
      showErrorToast(error, "تعذر حذف العرض. حاولي مرة أخرى.");
    }
  };

  const confirmToggle = async () => {
    if (!pendingToggle) return;
    try {
      setIsToggling(true);
      setToggleError(null);
      await getStore().toggleOfferStatus(pendingToggle.id);
      setPendingToggle(null);
    } catch (error) {
      showErrorToast(error, "تعذر تحديث حالة العرض. حاولي مرة أخرى.");
      setToggleError("تعذر تحديث حالة العرض. حاولي مرة أخرى.");
    } finally {
      setIsToggling(false);
    }
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
      description="باقات المنتجات التي تظهر للعملاء بسعر مخفّض."
      actions={
        <>
          {reorder.isDirty && canUpdateErpModule(user, "offers") ? (
            <Button variant="secondary" onClick={() => { void reorder.saveOrder(); }} disabled={reorder.saving}>
              <Check /> حفظ ترتيب العروض
            </Button>
          ) : null}
          {canCreateErpModule(user, "offers") ? (
            <Button asChild variant="primary">
              <Link href="/offers/new"><Plus /> عرض جديد</Link>
            </Button>
          ) : undefined}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي باسم العرض…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={loaded ? `${formatNumber(filteredOffers.length)} عرض` : "جارٍ التحميل…"}
        sort={{
          value: sort ? `${sort.key}:${sort.direction}` : "",
          onChange: (value) => {
            const [key, direction] = value.split(":");
            setSort(key ? { key: key as OfferSortKey, direction: direction as "asc" | "desc" } : null);
          },
          options: [
            { value: "", label: "ترتيب المتجر" },
            ...OFFER_SORT_COLUMNS.flatMap((column) => [
              { value: `${column.key}:asc`, label: `${column.label} — تصاعدي` },
              { value: `${column.key}:desc`, label: `${column.label} — تنازلي` }
            ])
          ]
        }}
        filters={[
          {
            key: "status",
            label: "الحالة",
            icon: CircleDot,
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as "all" | "active" | "inactive"),
            options: ACTIVE_STATUS_FILTER_OPTIONS
          },
          {
            key: "category",
            label: "القسم",
            icon: FolderTree,
            testId: "offers-category-filter",
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

      <OffersTable
        loading={!loaded}
        offers={sortedRows}
        sort={sort}
        onSort={toggleSort}
        categories={categories}
        canToggle={canToggleErpModule(user, "offers")}
        canEdit={canUpdateErpModule(user, "offers")}
        canDelete={canSoftDeleteErpModule(user, "offers")}
        canReorder={reorderEnabled}
        onMove={reorder.moveItem}
        onToggle={setPendingToggle}
        onDelete={setPendingDelete}
      />

      <AdminConfirmModal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={closeToggleModal}
        confirmLabel={isToggling ? "جارٍ التحديث…" : "تأكيد"}
        disableCancel={isToggling}
        disableConfirm={isToggling}
        onConfirm={confirmToggle}
      >
        <p>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذا العرض ولن يظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذا العرض ليظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف العرض"
        tone="danger"
        onConfirm={confirmDelete}
      >
        <p>سيُنقل العرض إلى المحذوفات. يمكنك استعادته لاحقًا من قسم المحذوفات.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
