"use client";

import Link from "next/link";
import { Pencil, Star, Trash2 } from "lucide-react";
import type { AdminReviewPage, ReviewEntityType } from "@capella/shared";
import { TableEmptyRow, TableSkeletonRows } from "@/components/admin/list-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RowMenu, RowMenuItem } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

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

export function ReviewsTable({
  loading,
  error,
  reviews,
  canToggle,
  canDelete,
  onToggle,
  onDelete,
  onRetry
}: {
  loading: boolean;
  error: boolean;
  reviews: AdminReviewPage["items"];
  canToggle: boolean;
  canDelete: boolean;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onRetry: () => void;
}) {
  return (
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
          {loading ? (
            <TableSkeletonRows
              cells={[
                <TD key="lead" data-cell="lead"><div className="grid gap-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-40" /></div></TD>,
                <TD key="entity"><Skeleton className="h-3.5 w-28" /></TD>,
                <TD key="order"><Skeleton className="h-3.5 w-20" /></TD>,
                <TD key="rating"><Skeleton className="h-4 w-20" /></TD>,
                <TD key="comment"><Skeleton className="h-3.5 w-40" /></TD>,
                <TD key="status"><Skeleton className="h-6 w-16 rounded-full" /></TD>,
                <TD key="date"><Skeleton className="h-3.5 w-24" /></TD>,
                <TD key="actions" data-cell="actions" />
              ]}
            />
          ) : null}
          {!loading && !error ? reviews.map((review) => (
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
                {formatDate(review.createdAt)}
              </TD>
              <TD data-cell="actions">
                <div className="flex justify-end">
                  {canToggle || canDelete ? (
                    <RowMenu label={`إجراءات تقييم ${review.customerName}`}>
                      {canToggle ? (
                        <RowMenuItem onClick={() => onToggle(review.id)}>
                          <Pencil /> {review.status === "active" ? "تعطيل" : "تفعيل"}
                        </RowMenuItem>
                      ) : null}
                      {canDelete ? (
                        <RowMenuItem danger onClick={() => onDelete(review.id)}>
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
            <TableEmptyRow
              colSpan={8}
              tone="danger"
              icon={<Star />}
              title="تعذر تحميل التقييمات"
              description="حدث خطأ أثناء جلب التقييمات."
              action={<Button variant="secondary" onClick={onRetry}>إعادة المحاولة</Button>}
            />
          ) : null}
          {!loading && !error && reviews.length === 0 ? (
            <TableEmptyRow colSpan={8} icon={<Star />} title="لا توجد تقييمات" description="لم يكتب العملاء أي تقييمات بعد." />
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
