"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminReview, AdminReviewPage } from "@capella/shared";
import { getStore, useStore } from "@/lib/store";
import { api } from "@/lib/api/client";
import { showErrorToast } from "@/lib/errors";
import type { HardDeleteTarget, TrashListRow, TrashTab, TrashTabConfig } from "../types/trash-page.types";

export function useTrashPage(options: { reviewsReadable?: boolean } = {}) {
  const products = useStore((state) => state.products);
  const categories = useStore((state) => state.categories);
  const offers = useStore((state) => state.offers);

  const [tab, setTab] = useState<TrashTab>("products");
  const [pendingHardDelete, setPendingHardDelete] = useState<HardDeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.reviewsReadable || tab !== "reviews") return;
    let cancelled = false;
    const loadDeletedReviews = async () => {
      setReviewsLoading(true);
      setReviewsError(null);
      try {
        const allReviews: AdminReview[] = [];
        let page = 1;
        let totalPages = 1;
        while (!cancelled && page <= totalPages) {
          const response = await api.get<AdminReviewPage>(`/api/erp/reviews?deleted=true&page=${page}&pageSize=100`);
          allReviews.push(...response.items);
          totalPages = response.pagination.totalPages;
          page += 1;
        }
        if (!cancelled) setReviews(allReviews);
      } catch (error) {
        if (!cancelled) {
          const message = "تعذر تحميل التقييمات المحذوفة. حاولي مرة أخرى.";
          setReviewsError(message);
          showErrorToast(error, message);
        }
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    };
    void loadDeletedReviews();
    return () => {
      cancelled = true;
    };
  }, [options.reviewsReadable, tab]);

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

  const deletedReviews = useMemo(
    () => reviews.map<TrashListRow>((review) => ({
      id: review.id,
      title: `${review.entityName.ar || review.entityName.en} — ${review.customerName}`,
      subtitle: `${"★".repeat(review.rating)} · ${review.comment}`,
      meta: new Date(review.deletedAt!).toLocaleDateString("ar-EG")
    })),
    [reviews]
  );

  const tabs: TrashTabConfig[] = [
    { id: "products", label: "المنتجات", count: deletedProducts.length },
    { id: "categories", label: "الأقسام", count: deletedCategories.length },
    { id: "offers", label: "العروض", count: deletedOffers.length },
    ...(options.reviewsReadable ? [{ id: "reviews" as const, label: "التقييمات", count: deletedReviews.length }] : [])
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
    try {
      setIsDeleting(true);
      setDeleteError(null);
      if (pendingHardDelete.kind === "products") {
        await getStore().hardDeleteProduct(pendingHardDelete.id);
      } else if (pendingHardDelete.kind === "categories") {
        await getStore().hardDeleteCategory(pendingHardDelete.id);
      } else if (pendingHardDelete.kind === "offers") {
        await getStore().hardDeleteOffer(pendingHardDelete.id);
      } else {
        await api.del(`/api/erp/reviews/${pendingHardDelete.id}/permanent`);
        setReviews((current) => current.filter((review) => review.id !== pendingHardDelete.id));
      }
      setPendingHardDelete(null);
    } catch (error) {
      console.error(error);
      const message = "تعذر حذف العنصر نهائياً. حاولي مرة أخرى.";
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
    deletedReviews,
    reviewsLoading,
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
    restoreReview: async (id: number) => {
      try {
        setDeleteError(null);
        await api.post(`/api/erp/reviews/${id}/restore`);
        setReviews((current) => current.filter((review) => review.id !== id));
      } catch (error) {
        const message = "تعذر استعادة التقييم. حاولي مرة أخرى.";
        setDeleteError(message);
        showErrorToast(error, message);
      }
    }
  };
}
