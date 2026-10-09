"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminReviewPage, ReviewEntityType, ReviewStatus } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { ReviewsTable } from "@/features/reviews/components/reviews-table";
import { api } from "@/lib/api/client";
import { showErrorToast } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { hasErpPermission } from "@/lib/erp-permissions";

const emptyPage: AdminReviewPage = {
  items: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
};

export default function ReviewsPage() {
  const { user } = useAdminAuth();
  const canReadReviews = hasErpPermission(user, "reviews.read");
  const [data, setData] = useState<AdminReviewPage>(emptyPage);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReviewStatus | "">("");
  const [entityType, setEntityType] = useState<ReviewEntityType | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!canReadReviews) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search.trim()) query.set("q", search.trim());
    if (status) query.set("status", status);
    if (entityType) query.set("entityType", entityType);
    try {
      const response = await api.get<AdminReviewPage>(`/api/erp/reviews?${query}`);
      if (requestId === requestIdRef.current) setData(response);
    } catch {
      if (requestId === requestIdRef.current) setError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [canReadReviews, entityType, page, search, status]);

  useEffect(() => { void load(); }, [load]);

  if (!canReadReviews) {
    return (
      <ForbiddenPage title="التقييمات" crumbs={[{ label: "التقييمات" }]} message="لا تملك صلاحية الوصول إلى التقييمات." />
    );
  }

  const mutate = async (action: "toggle" | "delete", id: number) => {
    try {
      if (action === "toggle") await api.post(`/api/erp/reviews/${id}/toggle-status`);
      else await api.del(`/api/erp/reviews/${id}`);
      await load();
    } catch (mutationError) {
      showErrorToast(mutationError, "تعذر تحديث التقييم. حاولي مرة أخرى.");
    }
  };

  const canToggle = hasErpPermission(user, "reviews.toggle_status");
  const canDelete = hasErpPermission(user, "reviews.soft_delete");
  const totalPages = data.pagination.totalPages;

  return (
    <AdminShell
      title="التقييمات"
      crumbs={[{ label: "التقييمات" }]}
      description="تقييمات العملاء للمنتجات والعروض والمجموعات."
    >
      <AdminListHeader
        searchLabel="البحث في التقييمات"
        searchPlaceholder="ابحثي بالعميل، الطلب، العنصر، أو التعليق…"
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        countLabel={loading ? "جارٍ التحميل…" : `${formatNumber(data.pagination.total)} تقييم`}
        filters={[
          {
            key: "status",
            label: "الحالة",
            value: status,
            onChange: (value) => { setStatus(value as ReviewStatus | ""); setPage(1); },
            options: [
              { value: "", label: "كل الحالات" },
              { value: "active", label: "نشط" },
              { value: "inactive", label: "معطّل" }
            ]
          },
          {
            key: "entityType",
            label: "النوع",
            value: entityType,
            onChange: (value) => { setEntityType(value as ReviewEntityType | ""); setPage(1); },
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
        loading={loading}
        error={error}
        reviews={data.items}
        canToggle={canToggle}
        canDelete={canDelete}
        onToggle={(id) => { void mutate("toggle", id); }}
        onDelete={setPendingDelete}
        onRetry={() => { void load(); }}
      />

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</Button>
          <span className="text-sm text-text-muted">
            <span className="num">{formatNumber(page)}</span> / <span className="num">{formatNumber(totalPages)}</span>
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>التالي</Button>
        </div>
      ) : null}

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
