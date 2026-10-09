"use client";

import Link from "next/link";
import { Check, CircleDot, FolderTree, Plus } from "lucide-react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { tableSortSelect } from "@/components/admin/list-table";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { BundlesTable } from "@/features/bundles/components/bundles-table";
import { useBundlesList } from "@/features/bundles/hooks/use-bundles-list";
import { collectionConfig } from "@/features/collections/collection-config";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canToggleErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function CollectionsListPage() {
  const { user } = useAdminAuth();
  const rows = useStore((state) => state.collections);
  const categories = useStore((state) => state.categories);
  const loaded = useStore((state) => state.loaded);
  const list = useBundlesList(collectionConfig, user, rows, categories);
  const copy = collectionConfig.list.copy;

  if (!canReadErpModule(user, "collections")) {
    return <ForbiddenPage title={copy.title} crumbs={[{ label: copy.title }]} message={copy.forbiddenMessage} />;
  }

  return (
    <AdminShell
      title={copy.title}
      crumbs={[{ label: copy.title }]}
      description={copy.description}
      actions={
        <>
          {list.reorder.isDirty && canUpdateErpModule(user, "collections") ? (
            <Button variant="secondary" onClick={() => { void list.reorder.saveOrder(); }} disabled={list.reorder.saving}>
              <Check /> {copy.saveOrderLabel}
            </Button>
          ) : null}
          {canCreateErpModule(user, "collections") ? (
            <Button asChild variant="primary">
              <Link href="/collections/new"><Plus /> {copy.newLabel}</Link>
            </Button>
          ) : undefined}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder={copy.searchPlaceholder}
        searchValue={list.search}
        onSearchChange={list.setSearch}
        countLabel={loaded ? `${formatNumber(list.filtered.length)} ${copy.countNoun}` : "جارٍ التحميل…"}
        sort={tableSortSelect(collectionConfig.list.columns, list.sort, list.setSort)}
        filters={[
          {
            key: "status",
            label: "الحالة",
            icon: CircleDot,
            value: list.statusFilter,
            onChange: (value) => list.setStatusFilter(value as "all" | "active" | "inactive"),
            options: ACTIVE_STATUS_FILTER_OPTIONS
          },
          {
            key: "category",
            label: "القسم",
            icon: FolderTree,
            testId: "collections-category-filter",
            value: String(list.categoryFilter),
            onChange: (value) => list.setCategoryFilter(value ? Number(value) : ""),
            options: [
              { value: "", label: "كل الأقسام" },
              ...list.categoryOptions.map((option) => ({
                value: String(option.id),
                label: `${"— ".repeat(option.depth)}${option.label}`
              }))
            ]
          }
        ]}
      />

      <BundlesTable
        config={collectionConfig}
        loading={!loaded}
        rows={list.sortedRows}
        sort={list.sort}
        onSort={list.toggleSort}
        categories={categories}
        canToggle={canToggleErpModule(user, "collections")}
        canEdit={canUpdateErpModule(user, "collections")}
        canDelete={canSoftDeleteErpModule(user, "collections")}
        canReorder={list.reorderEnabled}
        onMove={list.reorder.moveItem}
        onToggle={list.setPendingToggle}
        onDelete={(id) => list.setPendingDelete(list.visible.find((row) => row.id === id) ?? null)}
      />

      <AdminConfirmModal
        open={list.pendingToggle != null}
        title={list.pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={list.closeToggleModal}
        confirmLabel={list.isToggling ? "جارٍ التحديث…" : "تأكيد"}
        disableCancel={list.isToggling}
        disableConfirm={list.isToggling}
        onConfirm={list.confirmToggle}
      >
        <p>{list.pendingToggle?.status === "active" ? copy.toggleOffMessage : copy.toggleOnMessage}</p>
        {list.toggleError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{list.toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={list.pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => list.setPendingDelete(null)}
        confirmLabel={copy.deleteConfirmLabel}
        tone="danger"
        onConfirm={list.confirmDelete}
      >
        <p>{copy.deleteModalText}</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
