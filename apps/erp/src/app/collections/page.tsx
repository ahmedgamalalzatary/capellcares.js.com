"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CircleDot, FolderTree, Plus } from "lucide-react";
import type { Collection } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { tableSortSelect } from "@/components/admin/list-table";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { COLLECTION_SORT_COLUMNS, CollectionsTable, collectionSortAccessors } from "@/features/collections/components/collections-table";
import { buildCategoryTreeOptions, isInCategoryTree } from "@/lib/category-tree";
import { showErrorToast } from "@/lib/errors";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canToggleErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { getStore, useStore } from "@/lib/store";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";
import { useTableSort } from "@/hooks/use-table-sort";

export default function CollectionsListPage() {
  const { user } = useAdminAuth();
  const collections = useStore((s) => s.collections);
  const categories = useStore((s) => s.categories);
  const loaded = useStore((s) => s.loaded);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [pendingDelete, setPendingDelete] = useState<Collection | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Collection | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const visibleCollections = useMemo(() => collections.filter((collection) => !collection.deletedAt), [collections]);
  const reorder = useListReorder({
    persistedIds: useMemo(() => visibleCollections.map((collection) => collection.id), [visibleCollections]),
    save: (ids) => getStore().reorderCollections({ ids }),
    successMessage: "تم حفظ ترتيب المجموعات.",
    errorMessage: "تعذر حفظ ترتيب المجموعات. حاولي مرة أخرى."
  });
  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);

  const filteredCollections = useMemo(() => {
    const ordered = sortByIdOrder(visibleCollections, reorder.orderedIds)
      .filter((collection) => statusFilter === "all" || collection.status === statusFilter)
      .filter((collection) => categoryFilter === "" || isInCategoryTree(categories, collection.categoryId, categoryFilter));
    if (!search.trim()) return ordered;
    const needle = search.trim().toLowerCase();
    return ordered.filter((collection) =>
      collection.name.ar.toLowerCase().includes(needle) ||
      collection.name.en.toLowerCase().includes(needle) ||
      collection.slug.toLowerCase().includes(needle)
    );
  }, [visibleCollections, search, statusFilter, categories, categoryFilter, reorder.orderedIds]);

  const { sort, setSort, toggleSort, sortedRows } = useTableSort(filteredCollections, collectionSortAccessors(categories));
  const reorderEnabled = canUpdateErpModule(user, "collections") && !search.trim() && statusFilter === "all" && categoryFilter === "";

  const closeToggleModal = () => {
    if (isToggling) return;
    setPendingToggle(null);
    setToggleError(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await getStore().softDeleteCollection(pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      showErrorToast(error, "تعذر حذف المجموعة. حاولي مرة أخرى.");
    }
  };

  const confirmToggle = async () => {
    if (!pendingToggle) return;
    try {
      setIsToggling(true);
      setToggleError(null);
      await getStore().toggleCollectionStatus(pendingToggle.id);
      setPendingToggle(null);
    } catch (error) {
      showErrorToast(error, "تعذر تحديث حالة المجموعة. حاولي مرة أخرى.");
      setToggleError("تعذر تحديث حالة المجموعة. حاولي مرة أخرى.");
    } finally {
      setIsToggling(false);
    }
  };

  if (!canReadErpModule(user, "collections")) {
    return (
      <ForbiddenPage title="المجموعات" crumbs={[{ label: "المجموعات" }]} message="لا تملكين صلاحية الوصول إلى المجموعات." />
    );
  }

  return (
    <AdminShell
      title="المجموعات"
      crumbs={[{ label: "المجموعات" }]}
      description="تشكيلات من المنتجات تُعرض مع بعضها بسعر موحّد."
      actions={
        <>
          {reorder.isDirty && canUpdateErpModule(user, "collections") ? (
            <Button variant="secondary" onClick={() => { void reorder.saveOrder(); }} disabled={reorder.saving}>
              <Check /> حفظ ترتيب المجموعات
            </Button>
          ) : null}
          {canCreateErpModule(user, "collections") ? (
            <Button asChild variant="primary">
              <Link href="/collections/new"><Plus /> مجموعة جديدة</Link>
            </Button>
          ) : undefined}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي باسم المجموعة…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={loaded ? `${formatNumber(filteredCollections.length)} مجموعة` : "جارٍ التحميل…"}
        sort={tableSortSelect(COLLECTION_SORT_COLUMNS, sort, setSort)}
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
            testId: "collections-category-filter",
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

      <CollectionsTable
        loading={!loaded}
        collections={sortedRows}
        sort={sort}
        onSort={toggleSort}
        categories={categories}
        canToggle={canToggleErpModule(user, "collections")}
        canEdit={canUpdateErpModule(user, "collections")}
        canDelete={canSoftDeleteErpModule(user, "collections")}
        canReorder={reorderEnabled}
        onMove={reorder.moveItem}
        onToggle={setPendingToggle}
        onDelete={(id) => setPendingDelete(visibleCollections.find((collection) => collection.id === id) ?? null)}
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
            ? "سيتم إيقاف هذه المجموعة ولن تظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذه المجموعة لتظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف المجموعة"
        tone="danger"
        onConfirm={confirmDelete}
      >
        <p>ستُنقل المجموعة إلى المحذوفات. يمكنك استعادتها لاحقًا من قسم المحذوفات.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
