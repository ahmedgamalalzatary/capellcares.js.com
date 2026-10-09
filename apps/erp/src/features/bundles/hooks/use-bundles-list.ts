"use client";

import { useMemo, useState } from "react";
import type { Category } from "@capella/shared";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";
import { useTableSort } from "@/hooks/use-table-sort";
import { buildCategoryTreeOptions, isInCategoryTree } from "@/lib/category-tree";
import { showErrorToast } from "@/lib/errors";
import { canUpdateErpModule } from "@/lib/erp-permissions";
import type { BundleConfig } from "@/features/bundles/bundle-config";
import type { BundleEntity } from "@/features/bundles/types";

type AdminUser = Parameters<typeof canUpdateErpModule>[0];

/** Filter / search / reorder / toggle / delete state shared by the offer and collection list pages. */
export function useBundlesList<TBundle extends BundleEntity>(config: BundleConfig, user: AdminUser, rows: TBundle[], categories: Category[]) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [pendingDelete, setPendingDelete] = useState<TBundle | null>(null);
  const [pendingToggle, setPendingToggle] = useState<TBundle | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const visible = useMemo(() => rows.filter((row) => !row.deletedAt), [rows]);
  const reorder = useListReorder({
    persistedIds: useMemo(() => visible.map((row) => row.id), [visible]),
    save: (ids) => config.storeApi.reorder(ids),
    successMessage: config.list.copy.reorderSuccess,
    errorMessage: config.list.copy.reorderError
  });
  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);

  const filtered = useMemo(() => {
    const ordered = sortByIdOrder(visible, reorder.orderedIds)
      .filter((row) => statusFilter === "all" || row.status === statusFilter)
      .filter((row) => categoryFilter === "" || isInCategoryTree(categories, row.categoryId, categoryFilter));
    if (!search.trim()) return ordered;
    const needle = search.trim().toLowerCase();
    return ordered.filter((row) =>
      row.name.ar.toLowerCase().includes(needle) ||
      row.name.en.toLowerCase().includes(needle) ||
      row.slug.toLowerCase().includes(needle)
    );
  }, [visible, search, statusFilter, categories, categoryFilter, reorder.orderedIds]);

  const { sort, setSort, toggleSort, sortedRows } = useTableSort(filtered, config.list.sortAccessors(categories));
  const reorderEnabled = canUpdateErpModule(user, `${config.kind}s`) && !search.trim() && statusFilter === "all" && categoryFilter === "";

  const closeToggleModal = () => {
    if (isToggling) return;
    setPendingToggle(null);
    setToggleError(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await config.storeApi.softDelete(pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      showErrorToast(error, config.list.copy.deleteError);
    }
  };

  const confirmToggle = async () => {
    if (!pendingToggle) return;
    try {
      setIsToggling(true);
      setToggleError(null);
      await config.storeApi.toggleStatus(pendingToggle.id);
      setPendingToggle(null);
    } catch (error) {
      showErrorToast(error, config.list.copy.toggleError);
      setToggleError(config.list.copy.toggleError);
    } finally {
      setIsToggling(false);
    }
  };

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    categoryOptions,
    reorder,
    filtered,
    sort,
    setSort,
    toggleSort,
    sortedRows,
    reorderEnabled,
    visible,
    pendingDelete,
    setPendingDelete,
    pendingToggle,
    setPendingToggle,
    isToggling,
    toggleError,
    closeToggleModal,
    confirmDelete,
    confirmToggle
  };
}
