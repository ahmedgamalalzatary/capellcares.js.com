"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { compareByScopedOrdering, type Category, type Product } from "@capella/shared";
import { getStore, useStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";

function buildCategoryOptions(categories: Category[]) {
  const active = categories
    .filter((category) => !category.deletedAt)
    .slice()
    .sort(compareByScopedOrdering.bind(null, "erp"));
  const childrenByParent = new Map<number | null, Category[]>();
  for (const category of active) {
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const options: Array<{ id: number; label: string; depth: number }> = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const category of childrenByParent.get(parentId) ?? []) {
      options.push({ id: category.id, label: category.name.ar, depth });
      visit(category.id, depth + 1);
    }
  };
  visit(null, 0);
  return options;
}

function scopeRank(product: Product, scopeCategoryId: number | null) {
  return product.orderings?.find((entry) =>
    scopeCategoryId == null
      ? entry.scopeType === "root" && entry.scopeId == null
      : entry.scopeType === "category" && entry.scopeId === scopeCategoryId
  )?.rank;
}

export function useProductsPage() {
  const products = useStore((state) => state.products);
  const categories = useStore((state) => state.categories);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Product | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<number[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => !product.deletedAt)
      .filter((product) => {
        if (statusFilter !== "all" && product.status !== statusFilter) {
          return false;
        }

        if (categoryFilter !== "") {
          const category = categories.find((candidate) => candidate.id === product.categoryId);
          if (!category) {
            return false;
          }

          let current: typeof category | undefined = category;
          const visited = new Set<number>();
          while (current) {
            if (visited.has(current.id)) {
              current = undefined;
              break;
            }
            visited.add(current.id);
            if (current.id === categoryFilter) {
              break;
            }
            current = current.parentId != null ? categories.find((candidate) => candidate.id === current!.parentId) : undefined;
          }

          if (!current) {
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
  }, [categories, categoryFilter, products, search, statusFilter]);

  const scopeCategoryId = categoryFilter === "" ? null : categoryFilter;

  const orderedProducts = useMemo(() => {
    return filteredProducts
      .map((product) => ({ ...product, sortOrder: scopeRank(product, scopeCategoryId) }))
      .sort(compareByScopedOrdering.bind(null, "erp"));
  }, [filteredProducts, scopeCategoryId]);

  // Reordering needs the complete scope set, so it is only meaningful when no
  // search/status filter hides part of the scope.
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

  const isOrderDirty = useMemo(() => {
    if (!draftOrder) return false;
    const persisted = orderedProducts.map((product) => product.id);
    return draftOrder.length !== persisted.length || draftOrder.some((id, index) => id !== persisted[index]);
  }, [draftOrder, orderedProducts]);

  const moveProduct = (id: number, direction: -1 | 1) => {
    const current = displayProducts.map((product) => product.id);
    const index = current.indexOf(id);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= current.length) {
      return;
    }
    const next = current.slice();
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    setDraftOrder(next);
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
    categories,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    categoryOptions,
    filteredProducts: displayProducts,
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
