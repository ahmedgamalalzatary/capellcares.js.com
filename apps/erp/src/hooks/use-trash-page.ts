"use client";

import { useMemo, useState } from "react";
import { getStore, useStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import type { HardDeleteTarget, TrashListRow, TrashTab, TrashTabConfig } from "../types/trash-page.types";

export function useTrashPage() {
  const products = useStore((state) => state.products);
  const categories = useStore((state) => state.categories);
  const offers = useStore((state) => state.offers);

  const [tab, setTab] = useState<TrashTab>("products");
  const [pendingHardDelete, setPendingHardDelete] = useState<HardDeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deletedProducts = useMemo(
    () =>
      products
        .filter((product) => product.deletedAt)
        .map<TrashListRow>((product) => ({
          id: product.id,
          title: product.name.ar,
          subtitle: product.sku,
          meta: new Date(product.deletedAt!).toLocaleDateString("ar-EG")
        })),
    [products]
  );

  const deletedCategories = useMemo(
    () =>
      categories
        .filter((category) => category.deletedAt)
        .map<TrashListRow>((category) => ({
          id: category.id,
          title: category.name.ar,
          subtitle: category.name.en,
          meta: new Date(category.deletedAt!).toLocaleDateString("ar-EG")
        })),
    [categories]
  );

  const deletedOffers = useMemo(
    () =>
      offers
        .filter((offer) => offer.deletedAt)
        .map<TrashListRow>((offer) => ({
          id: offer.id,
          title: offer.name.ar,
          subtitle: offer.name.en,
          meta: new Date(offer.deletedAt!).toLocaleDateString("ar-EG")
        })),
    [offers]
  );

  const tabs: TrashTabConfig[] = [
    { id: "products", label: "المنتجات", count: deletedProducts.length },
    { id: "categories", label: "الأقسام", count: deletedCategories.length },
    { id: "offers", label: "العروض", count: deletedOffers.length }
  ];

  const closeHardDeleteModal = () => {
    if (isDeleting) {
      return;
    }
    setPendingHardDelete(null);
    setDeleteError(null);
  };

  const confirmHardDelete = async () => {
    if (!pendingHardDelete) {
      return;
    }
    // This hook currently exposes hard delete only for products; other trash tabs use restore-only actions.
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await getStore().hardDeleteProduct(pendingHardDelete.id);
      setPendingHardDelete(null);
    } catch (error) {
      console.error(error);
      const message = "تعذر حذف المنتج نهائياً. حاولي مرة أخرى.";
      showErrorToast(error, message);
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    tab,
    setTab,
    tabs,
    deletedProducts,
    deletedCategories,
    deletedOffers,
    pendingHardDelete,
    setPendingHardDelete,
    isDeleting,
    deleteError,
    closeHardDeleteModal,
    confirmHardDelete,
    restoreProduct: (id: number) => getStore().restoreProduct(id),
    restoreCategory: (id: number) => getStore().restoreCategory(id),
    restoreOffer: (id: number) => getStore().restoreOffer(id)
  };
}
