"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminReviewPage, ReviewEntityType, ReviewStatus } from "@capella/shared";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { api } from "@/lib/api/client";
import { hasErpPermission } from "@/lib/erp-permissions";
import { showErrorToast } from "@/lib/errors";

const emptyPage: AdminReviewPage = {
  items: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
};

function entityLabel(type: ReviewEntityType) {
  if (type === "product") return "منتج";
  if (type === "offer") return "عرض";
  return "مجموعة";
}

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

  useEffect(() => {
    void load();
  }, [load]);

  if (!canReadReviews) {
    return (
      <AdminShell title="التقييمات" crumbs={[{ label: "التقييمات" }]}>
        <ErpForbiddenState message="لا تملك صلاحية الوصول إلى التقييمات." />
      </AdminShell>
    );
  }

  const mutate = async (action: "toggle" | "delete", id: number) => {
    try {
      if (action === "toggle") await api.post(`/api/erp/reviews/${id}/toggle-status`);
      else await api.del(`/api/erp/reviews/${id}`);
      await load();
    } catch (error) {
      showErrorToast(error, "تعذر تحديث التقييم. حاولي مرة أخرى.");
    }
  };

  return (
    <AdminShell title="التقييمات" crumbs={[{ label: "التقييمات" }]}>
      <AdminListHeader
        searchLabel="البحث في التقييمات"
        searchPlaceholder="ابحث بالعميل، الطلب، العنصر أو التعليق…"
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        countLabel={`${data.pagination.total} تقييم`}
        filters={[
          {
            key: "status",
            label: "حالة التقييم",
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
            label: "نوع العنصر",
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

      <div className="card">
        <div className="table-outer">
          <table className="table">
            <thead><tr><th>العميل</th><th>العنصر</th><th>الطلب</th><th>التقييم</th><th>التعليق</th><th>الحالة</th><th>التاريخ</th><th /></tr></thead>
            <tbody>
              {data.items.map((review) => (
                <tr key={review.id}>
                  <td><div className="table-title">{review.customerName}</div><div className="faint">{review.customerEmail}</div></td>
                  <td><div>{review.entityName.ar || review.entityName.en}</div><div className="faint">{entityLabel(review.entityType)} #{review.entityId}</div></td>
                  <td><Link href={`/orders/${review.orderId}`} className="table-title">{review.orderCode}</Link></td>
                  <td><span aria-label={`${review.rating} من 5 نجوم`} className="review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></td>
                  <td className="review-comment">{review.comment}</td>
                  <td><span className={review.status === "active" ? "status status--active" : "status status--draft"}>{review.status === "active" ? "نشط" : "معطّل"}</span></td>
                  <td className="muted">{new Date(review.createdAt).toLocaleDateString("ar-EG")}</td>
                  <td><div className="row row--nowrap">
                    {hasErpPermission(user, "reviews.toggle_status") ? <button className="btn btn--ghost btn--sm" onClick={() => void mutate("toggle", review.id)}>{review.status === "active" ? "تعطيل" : "تفعيل"}</button> : null}
                    {hasErpPermission(user, "reviews.soft_delete") ? <button className="btn btn--ghost btn--sm c-error" onClick={() => void mutate("delete", review.id)}>حذف</button> : null}
                  </div></td>
                </tr>
              ))}
              {!loading && !error && data.items.length === 0 ? <tr><td colSpan={8} className="muted state-note state-note--lg">لا توجد تقييمات.</td></tr> : null}
              {loading ? <tr><td colSpan={8} className="muted state-note">جارٍ التحميل…</td></tr> : null}
              {error ? <tr><td colSpan={8} className="state-note"><button className="btn btn--ghost" onClick={() => void load()}>إعادة المحاولة</button></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {data.pagination.totalPages > 1 ? <div className="row row--center pager">
        <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</button>
        <span className="muted">{page} / {data.pagination.totalPages}</span>
        <button className="btn btn--ghost btn--sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>التالي</button>
      </div> : null}
    </AdminShell>
  );
}
