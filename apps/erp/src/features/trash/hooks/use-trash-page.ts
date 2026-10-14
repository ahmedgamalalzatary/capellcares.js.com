"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminReview } from "@capella/shared";
import { getStore, useStore } from "@/lib/store";
import { api } from "@/lib/api/client";
import { showErrorToast } from "@/lib/errors";
import { formatDateShort } from "@/lib/format";
import { usePaginatedList, useServerPage } from "@/hooks/use-paginated-list";
import type { ListSchema } from "@/lib/pagination";
import type { HardDeleteTarget, TrashListRow, TrashTab, TrashTabConfig } from "@/features/trash/types";

// The open tab is part of the remembered view, so switching tabs starts that tab from its first page.
const TRASH_LIST = {
  filters: { tab: { default: "products", values: ["products", "categories", "offers", "collections", "reviews"] } },
  sortKeys: []
} satisfies ListSchema<"tab", never>;

export function useTrashPage(options: { reviewsReadable?: boolean } = {}) {
  const products = useStore((state) => state.products);
  const categories = useStore((state) => state.categories);
  const offers = useStore((state) => state.offers);
  const collections = useStore((state) => state.collections);

  const list = usePaginatedList({ listId: "trash", schema: TRASH_LIST });
  const requestedTab = list.state.filters.tab as TrashTab;
  const tab: TrashTab = requestedTab === "reviews" && !options.reviewsReadable ? "products" : requestedTab;
  const setTab = (next: TrashTab) => list.setFilter("tab", next);
  const [pendingHardDelete, setPendingHardDelete] = useState<HardDeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const reviewsLoadError = "تعذر تحميل التقييمات المحذوفة. حاولي مرة أخرى.";
  const reviewsServer = useServerPage<AdminReview>(
    options.reviewsReadable && tab === "reviews" && list.ready ? `/api/erp/reviews?deleted=true&${list.pageQuery}` : null,
    { onError: (error) => showErrorToast(error, reviewsLoadError) }
  );
  const reviewsError = reviewsServer.error ? reviewsLoadError : null;

  const deletedProducts = useMemo(
    () =>
      products
        .filter((product) => product.deletedAt)
        .map<TrashListRow>((product) => ({
          id: product.id,
          title: product.name.ar,
          subtitle: product.sku,
          meta: formatDateShort(product.deletedAt!)
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
          meta: formatDateShort(category.deletedAt!)
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
          meta: formatDateShort(offer.deletedAt!)
        })),
    [offers]
  );

  const deletedCollections = useMemo(
    () =>
      collections
        .filter((collection) => collection.deletedAt)
        .map<TrashListRow>((collection) => ({
          id: collection.id,
          title: collection.name.ar,
          subtitle: collection.name.en,
          meta: formatDateShort(collection.deletedAt!)
        })),
    [collections]
  );

  const deletedReviews = useMemo(
    () => reviewsServer.items.map<TrashListRow>((review) => ({
      id: review.id,
      title: `${review.entityName.ar || review.entityName.en} — ${review.customerName}`,
      subtitle: `${"★".repeat(review.rating)} · ${review.comment}`,
      meta: formatDateShort(review.deletedAt!)
    })),
    [reviewsServer.items]
  );

  const tabs: TrashTabConfig[] = [
    { id: "products", label: "المنتجات", count: deletedProducts.length },
    { id: "categories", label: "الأقسام", count: deletedCategories.length },
    { id: "offers", label: "العروض", count: deletedOffers.length },
    { id: "collections", label: "المجموعات", count: deletedCollections.length },
    ...(options.reviewsReadable ? [{ id: "reviews" as const, label: "التقييمات", count: reviewsServer.total }] : [])
  ];

  const tabRows: Record<TrashTab, TrashListRow[]> = {
    products: deletedProducts,
    categories: deletedCategories,
    offers: deletedOffers,
    collections: deletedCollections,
    reviews: deletedReviews
  };
  const activeRows = tabRows[tab];
  // Deleted reviews arrive one server page at a time; every other tab is sliced from the full list here.
  const onServer = tab === "reviews";

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
    try {
      setIsDeleting(true);
      setDeleteError(null);
      if (pendingHardDelete.kind === "products") {
        await getStore().hardDeleteProduct(pendingHardDelete.id);
      } else if (pendingHardDelete.kind === "categories") {
        await getStore().hardDeleteCategory(pendingHardDelete.id);
      } else if (pendingHardDelete.kind === "offers") {
        await getStore().hardDeleteOffer(pendingHardDelete.id);
      } else if (pendingHardDelete.kind === "collections") {
        await getStore().hardDeleteCollection(pendingHardDelete.id);
      } else {
        await api.del(`/api/erp/reviews/${pendingHardDelete.id}/permanent`);
        await reviewsServer.reload();
      }
      setPendingHardDelete(null);
    } catch (error) {
      console.error(error);
      const message = showErrorToast(error, "تعذر حذف العنصر نهائياً. حاولي مرة أخرى.");
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    tab,
    setTab,
    tabs,
    pageRows: onServer ? activeRows : list.pageOf(activeRows),
    paginationProps: list.paginationProps(onServer ? reviewsServer.total : activeRows.length, onServer && reviewsServer.loading),
    reviewsLoading: reviewsServer.loading,
    reviewsError,
    pendingHardDelete,
    setPendingHardDelete: (target: HardDeleteTarget | null) => {
      setDeleteError(null);
      setPendingHardDelete(target);
    },
    isDeleting,
    deleteError,
    closeHardDeleteModal,
    confirmHardDelete,
    restoreProduct: (id: number) => getStore().restoreProduct(id),
    restoreCategory: (id: number) => getStore().restoreCategory(id),
    restoreOffer: (id: number) => getStore().restoreOffer(id),
    restoreCollection: (id: number) => getStore().restoreCollection(id),
    restoreReview: async (id: number) => {
      try {
        setDeleteError(null);
        await api.post(`/api/erp/reviews/${id}/restore`);
        await reviewsServer.reload();
      } catch (error) {
        const message = "تعذر استعادة التقييم. حاولي مرة أخرى.";
        setDeleteError(message);
        showErrorToast(error, message);
      }
    }
  };
}
