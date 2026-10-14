"use client";

import { useState } from "react";
import type { AdminReview } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { SmartPagination } from "@/components/admin/smart-pagination";
import { usePaginatedList, useServerPage } from "@/hooks/use-paginated-list";
import type { ListSchema } from "@/lib/pagination";
import { ReviewsTable } from "@/features/reviews/components/reviews-table";
import { api } from "@/lib/api/client";
import { showErrorToast } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { hasErpPermission } from "@/lib/erp-permissions";

const REVIEWS_LIST = {
  filters: {
    status: { default: "", values: ["", "active", "inactive"] },
    entityType: { default: "", values: ["", "product", "offer", "collection"] }
  },
  sortKeys: []
} satisfies ListSchema<"status" | "entityType", never>;

export default function ReviewsPage() {
  const { user } = useAdminAuth();
  const canReadReviews = hasErpPermission(user, "reviews.read");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const list = usePaginatedList({ listId: "reviews", schema: REVIEWS_LIST, searchDelay: 300 });
  const server = useServerPage<AdminReview>(canReadReviews && list.ready ? `/api/erp/reviews?${list.requestQuery}` : null);

  if (!canReadReviews) {
    return (
      <ForbiddenPage title="التقييمات" crumbs={[{ label: "التقييمات" }]} message="لا تملك صلاحية الوصول إلى التقييمات." />
    );
  }

  const mutate = async (action: "toggle" | "delete", id: number) => {
    try {
      if (action === "toggle") await api.post(`/api/erp/reviews/${id}/toggle-status`);
      else await api.del(`/api/erp/reviews/${id}`);
      await server.reload();
    } catch (mutationError) {
      showErrorToast(mutationError, "تعذر تحديث التقييم. حاولي مرة أخرى.");
    }
  };

  const canToggle = hasErpPermission(user, "reviews.toggle_status");
  const canDelete = hasErpPermission(user, "reviews.soft_delete");

  return (
    <AdminShell
      title="التقييمات"
      crumbs={[{ label: "التقييمات" }]}
      description="تقييمات العملاء للمنتجات والعروض والمجموعات."
    >
      <AdminListHeader
        searchLabel="البحث في التقييمات"
        searchPlaceholder="ابحثي بالعميل، الطلب، العنصر، أو التعليق…"
        searchValue={list.searchInput}
        onSearchChange={list.setSearch}
        countLabel={server.loading ? "جارٍ التحميل…" : `${formatNumber(server.total)} تقييم`}
        filters={[
          {
            key: "status",
            label: "الحالة",
            value: list.state.filters.status,
            onChange: (value) => list.setFilter("status", value),
            options: [
              { value: "", label: "كل الحالات" },
              { value: "active", label: "نشط" },
              { value: "inactive", label: "معطّل" }
            ]
          },
          {
            key: "entityType",
            label: "النوع",
            value: list.state.filters.entityType,
            onChange: (value) => list.setFilter("entityType", value),
            options: [
              { value: "", label: "كل الأنواع" },
              { value: "product", label: "المنتجات" },
              { value: "offer", label: "العروض" },
              { value: "collection", label: "المجموعات" }
            ]
          }
        ]}
      />

      <ReviewsTable
        loading={server.loading}
        error={server.error}
        reviews={server.items}
        canToggle={canToggle}
        canDelete={canDelete}
        onToggle={(id) => { void mutate("toggle", id); }}
        onDelete={setPendingDelete}
        onRetry={() => { void server.reload(); }}
      />

      <SmartPagination {...list.paginationProps(server.total, server.loading)} />

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        confirmLabel="حذف التقييم"
        tone="danger"
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete == null) return;
          const id = pendingDelete;
          setPendingDelete(null);
          await mutate("delete", id);
        }}
      >
        <p>سيتم حذف هذا التقييم نهائيًا. هل تريدين المتابعة؟</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
