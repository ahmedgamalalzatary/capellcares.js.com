"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Star, Trash2 } from "lucide-react";
import type { AdminReviewPage, ReviewEntityType, ReviewStatus } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu, RowMenuItem } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { showErrorToast } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { hasErpPermission } from "@/lib/erp-permissions";

const emptyPage: AdminReviewPage = {
  items: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
};

function entityLabel(type: ReviewEntityType) {
  if (type === "product") return "منتج";
  if (type === "offer") return "عرض";
  return "مجموعة";
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-warning" aria-label={`${rating} من 5 نجوم`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} aria-hidden className="size-3.5" fill={index < rating ? "currentColor" : "none"} />
      ))}
    </span>
  );
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

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>العميل</TH>
              <TH>العنصر</TH>
              <TH>الطلب</TH>
              <TH>التقييم</TH>
              <TH>التعليق</TH>
              <TH>الحالة</TH>
              <TH>التاريخ</TH>
              <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
            </tr>
          </THead>
          <TBody aria-busy={loading}>
            {loading ? Array.from({ length: 5 }, (_, index) => (
              <TR key={index} aria-hidden>
                <TD data-cell="lead"><div className="grid gap-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-40" /></div></TD>
                <TD><Skeleton className="h-3.5 w-28" /></TD>
                <TD><Skeleton className="h-3.5 w-20" /></TD>
                <TD><Skeleton className="h-4 w-20" /></TD>
                <TD><Skeleton className="h-3.5 w-40" /></TD>
                <TD><Skeleton className="h-6 w-16 rounded-full" /></TD>
                <TD><Skeleton className="h-3.5 w-24" /></TD>
                <TD data-cell="actions" />
              </TR>
            )) : null}
            {!loading && !error ? data.items.map((review) => (
              <TR key={review.id}>
                <TD data-cell="lead">
                  <span className="block font-medium text-text-strong">{review.customerName}</span>
                  <span dir="ltr" className="block text-end text-sm text-text-muted">{review.customerEmail}</span>
                </TD>
                <TD data-label="العنصر">
                  <span className="block text-text-strong">{review.entityName.ar || review.entityName.en}</span>
                  <span className="block text-sm text-text-muted">{entityLabel(review.entityType)} #{review.entityId}</span>
                </TD>
                <TD data-label="الطلب">
                  <Link href={`/orders/${review.orderId}`} className="text-text-strong decoration-line-strong underline-offset-4 hover:underline">
                    <code className="mono text-sm">{review.orderCode}</code>
                  </Link>
                </TD>
                <TD data-label="التقييم"><Stars rating={review.rating} /></TD>
                <TD data-label="التعليق" className="max-w-md whitespace-normal text-text-2">{review.comment}</TD>
                <TD data-label="الحالة"><Badge tone={review.status === "active" ? "success" : "neutral"}>{review.status === "active" ? "نشط" : "معطّل"}</Badge></TD>
                <TD data-label="التاريخ" className="whitespace-nowrap text-text-muted">
                  {new Date(review.createdAt).toLocaleDateString("ar-EG-u-nu-latn", { day: "2-digit", month: "short", year: "numeric" })}
                </TD>
                <TD data-cell="actions">
                  <div className="flex justify-end">
                    {canToggle || canDelete ? (
                      <RowMenu label={`إجراءات تقييم ${review.customerName}`}>
                        {canToggle ? (
                          <RowMenuItem onClick={() => { void mutate("toggle", review.id); }}>
                            <Pencil /> {review.status === "active" ? "تعطيل" : "تفعيل"}
                          </RowMenuItem>
                        ) : null}
                        {canDelete ? (
                          <RowMenuItem danger onClick={() => setPendingDelete(review.id)}>
                            <Trash2 /> حذف
                          </RowMenuItem>
                        ) : null}
                      </RowMenu>
                    ) : null}
                  </div>
                </TD>
              </TR>
            )) : null}
            {!loading && error ? (
              <TableState colSpan={8}>
                <EmptyState
                  tone="danger"
                  icon={<Star />}
                  title="تعذر تحميل التقييمات"
                  description="حدث خطأ أثناء جلب التقييمات."
                  action={<Button variant="secondary" onClick={() => { void load(); }}>إعادة المحاولة</Button>}
                />
              </TableState>
            ) : null}
            {!loading && !error && data.items.length === 0 ? (
              <TableState colSpan={8}>
                <EmptyState icon={<Star />} title="لا توجد تقييمات" description="لم يكتب العملاء أي تقييمات بعد." />
              </TableState>
            ) : null}
          </TBody>
        </Table>
      </Card>

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
