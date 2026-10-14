"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { compareByScopedOrdering, type Product } from "@capella/shared";
import { getStore, useStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import { buildCategoryTreeOptions } from "@/lib/category-tree";
import { moveItem } from "@/lib/array";
import { sortRows } from "@/lib/table-sort";
import type { ListSchema } from "@/lib/pagination";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PRODUCT_SORT_COLUMNS, productSortAccessors, type ProductSortKey } from "@/features/products/components/products-table";

const PRODUCTS_LIST = {
  filters: {
    status: { default: "all", values: ["all", "active", "inactive"] },
    category: { default: "", accepts: (value: string) => /^\d+$/.test(value) }
  },
  sortKeys: PRODUCT_SORT_COLUMNS.map((column) => column.key)
} satisfies ListSchema<"status" | "category", ProductSortKey>;

function scopeRank(product: Product, scopeCategoryId: number | null) {
  return product.orderings?.find((entry) =>
    scopeCategoryId == null
      ? entry.scopeType === "root" && entry.scopeId == null
      : entry.scopeType === "category" && entry.scopeId === scopeCategoryId
  )?.rank;
}

function isDescendantOf(categoryId: number, ancestorId: number, categoryById: Map<number, { id: number; parentId: number | null }>) {
  let current = categoryById.get(categoryId);
  const visited = new Set<number>();

  while (current && !visited.has(current.id)) {
    if (current.id === ancestorId) return true;
    visited.add(current.id);
    current = current.parentId != null ? categoryById.get(current.parentId) : undefined;
  }

  return false;
}

function isInCategoryBranch(categoryId: number, selectedId: number, categoryById: Map<number, { id: number; parentId: number | null }>) {
  return isDescendantOf(categoryId, selectedId, categoryById) ||
    isDescendantOf(selectedId, categoryId, categoryById);
}

export function useProductsPage() {
  const products = useStore((state) => state.products);
  const categories = useStore((state) => state.categories);
  const loaded = useStore((state) => state.loaded);
  const list = usePaginatedList({ listId: "products", schema: PRODUCTS_LIST });
  const search = list.state.q;
  const statusFilter = list.state.filters.status as "all" | "active" | "inactive";
  const categoryFilter: number | "" = list.state.filters.category === "" ? "" : Number(list.state.filters.category);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Product | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<number[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => !product.deletedAt)
      .filter((product) => {
        if (statusFilter !== "all" && product.status !== statusFilter) {
          return false;
        }

        if (categoryFilter !== "") {
          if (!isInCategoryBranch(product.categoryId, categoryFilter, categoryById)) {
            return false;
          }
        }

        if (search.trim()) {
          const normalizedSearch = search.trim().toLowerCase();
          if (
            !product.name.ar.toLowerCase().includes(normalizedSearch) &&
            !product.name.en.toLowerCase().includes(normalizedSearch) &&
            !product.sku.toLowerCase().includes(normalizedSearch)
          ) {
            return false;
          }
        }

        return true;
      });
  }, [categoryById, categoryFilter, products, search, statusFilter]);

  const scopeCategoryId = categoryFilter === "" ? null : categoryFilter;

  const orderedProducts = useMemo(() => {
    return filteredProducts
      .map((product) => ({ ...product, sortOrder: scopeRank(product, scopeCategoryId) }))
      .sort(compareByScopedOrdering.bind(null, "erp"));
  }, [filteredProducts, scopeCategoryId]);

  // Reordering needs the complete scope set, so it is only meaningful when no search/status filter hides part of the scope.
  const reorderEnabled = statusFilter === "all" && !search.trim();

  useEffect(() => {
    setDraftOrder(null);
  }, [categoryFilter, statusFilter, search, products]);

  const displayProducts = useMemo(() => {
    if (!draftOrder) {
      return orderedProducts;
    }
    const byId = new Map(orderedProducts.map((product) => [product.id, product]));
    const drafted = draftOrder
      .map((id) => byId.get(id))
      .filter((product): product is (typeof orderedProducts)[number] => Boolean(product));
    const draftedIds = new Set(draftOrder);
    return [...drafted, ...orderedProducts.filter((product) => !draftedIds.has(product.id))];
  }, [draftOrder, orderedProducts]);

  const sortedProducts = useMemo(
    () => sortRows(displayProducts, productSortAccessors(categories), list.state.sort),
    [categories, displayProducts, list.state.sort]
  );

  const isOrderDirty = useMemo(() => {
    if (!draftOrder) return false;
    const persisted = orderedProducts.map((product) => product.id);
    return draftOrder.length !== persisted.length || draftOrder.some((id, index) => id !== persisted[index]);
  }, [draftOrder, orderedProducts]);

  const moveProduct = (id: number, direction: -1 | 1) => {
    const current = displayProducts.map((product) => product.id);
    const index = current.indexOf(id);
    if (index === -1) {
      return;
    }
    setDraftOrder(moveItem(current, index, direction));
  };

  const saveOrder = async () => {
    if (!isOrderDirty || savingOrder || !draftOrder) {
      return;
    }
    setSavingOrder(true);
    try {
      await getStore().reorderProducts({ categoryId: scopeCategoryId, ids: draftOrder });
      toast.success("تم حفظ ترتيب المنتجات.");
      setDraftOrder(null);
    } catch (error) {
      showErrorToast(error, "تعذر حفظ ترتيب المنتجات. حاولي مرة أخرى.");
    } finally {
      setSavingOrder(false);
    }
  };

  const confirmDelete = async () => {
    if (pendingDelete == null) {
      return;
    }
    try {
      await getStore().softDeleteProduct(pendingDelete);
      setPendingDelete(null);
    } catch (error) {
      console.error(error);
      showErrorToast(error, "تعذر حذف المنتج. حاولي مرة أخرى.");
    }
  };

  const closeToggleModal = () => {
    if (isToggling) {
      return;
    }
    setPendingToggle(null);
    setToggleError(null);
  };

  const confirmToggle = async () => {
    if (!pendingToggle) {
      return;
    }
    try {
      setIsToggling(true);
      setToggleError(null);
      await getStore().toggleProductStatus(pendingToggle.id);
      setPendingToggle(null);
    } catch (error) {
      console.error(error);
      showErrorToast(error, "تعذر تحديث حالة المنتج. حاولي مرة أخرى.");
      setToggleError("تعذر تحديث حالة المنتج. حاولي مرة أخرى.");
    } finally {
      setIsToggling(false);
    }
  };

  return {
    loaded,
    categories,
    list,
    statusFilter,
    categoryFilter,
    categoryOptions,
    totalProducts: sortedProducts.length,
    pageProducts: list.pageOf(sortedProducts),
    reorderEnabled,
    isOrderDirty,
    savingOrder,
    moveProduct,
    saveOrder,
    pendingDelete,
    setPendingDelete,
    pendingToggle,
    setPendingToggle,
    isToggling,
    toggleError,
    closeToggleModal,
    confirmToggle,
    confirmDelete
  };
}
