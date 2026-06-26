"use client";

import { useMemo, useState } from "react";
import type { Product } from "@minikoshk/shared";
import { getStore, useStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";

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

  const rootCategories = useMemo(
    () => categories.filter((category) => category.parentId === null && !category.deletedAt),
    [categories]
  );

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
    rootCategories,
    filteredProducts,
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
