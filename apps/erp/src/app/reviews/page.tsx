"use client";

import { useEffect, useMemo, useState } from "react";
import type { Bilingual, ReviewEntityType, ReviewStatus } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Icon } from "@/components/ui/icons";
import { api } from "@/lib/api/client";
import { hasErpPermission } from "@/lib/erp-permissions";

type AdminReview = {
  id: number;
  customerId: number;
  customerName: string;
  customerEmail: string;
  entityType: ReviewEntityType;
  entityId: number;
  entityName: Bilingual;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
};

const statusLabels: Record<ReviewStatus, string> = {
  pending: "بانتظار المراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  hidden: "مخفية"
};

const entityLabels: Record<ReviewEntityType, string> = {
  product: "منتج",
  offer: "عرض",
  collection: "مجموعة"
};

export default function ReviewsPage() {
  const { user } = useAdminAuth();
  if (!hasErpPermission(user, "reviews.read")) {
    return (
      <AdminShell title="المراجعات" crumbs={[{ label: "المراجعات" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى المراجعات." />
      </AdminShell>
    );
  }
  return <ReviewsContent canModerate={hasErpPermission(user, "reviews.moderate")} canDelete={hasErpPermission(user, "reviews.delete")} />;
}

function ReviewsContent({ canModerate, canDelete }: { canModerate: boolean; canDelete: boolean }) {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [rating, setRating] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<AdminReview | null>(null);
  const [moderatingReviewId, setModeratingReviewId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api.get<{ items: AdminReview[] }>("/api/erp/reviews")
      .then((response) => setItems(response.items))
      .catch(() => setError("تعذر تحميل المراجعات. حاولي مرة أخرى."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => items.filter((review) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [review.customerName, review.customerEmail, review.entityName.ar, review.entityName.en, review.comment ?? ""]
      .some((value) => value.toLowerCase().includes(term));
    return matchesSearch && (status === "all" || review.status === status) &&
      (entityType === "all" || review.entityType === entityType) &&
      (rating === "all" || review.rating === Number(rating));
  }), [entityType, items, rating, search, status]);

  const groups = useMemo(() => {
    const grouped = new Map<number, { name: string; email: string; reviews: AdminReview[] }>();
    for (const review of filtered) {
      const group = grouped.get(review.customerId) ?? { name: review.customerName, email: review.customerEmail, reviews: [] };
      group.reviews.push(review);
      grouped.set(review.customerId, group);
    }
    return [...grouped.entries()];
  }, [filtered]);

  async function moderate(review: AdminReview, nextStatus: ReviewStatus) {
    setError(null);
    setModeratingReviewId(review.id);
    try {
      await api.patch(`/api/erp/reviews/${review.id}/status`, { status: nextStatus });
      setItems((current) => current.map((item) => item.id === review.id ? { ...item, status: nextStatus } : item));
    } catch {
      setError("تعذر تحديث حالة المراجعة. حاولي مرة أخرى.");
    } finally {
      setModeratingReviewId(null);
    }
  }

  return (
    <AdminShell title="المراجعات" crumbs={[{ label: "المراجعات" }]}>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <div className="search">
          <Icon.Search />
          <input placeholder="ابحثي بالعميل، المنتج، أو التعليق…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select className="input" aria-label="حالة المراجعة" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">كل الحالات</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="input" aria-label="نوع العنصر" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
          <option value="all">كل الأنواع</option>
          {Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="input" aria-label="عدد النجوم" value={rating} onChange={(event) => setRating(event.target.value)}>
          <option value="all">كل التقييمات</option>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} نجوم</option>)}
        </select>
        <span className="muted" style={{ marginInlineStart: "auto" }}>{filtered.length} مراجعة</span>
      </div>

      {error && <div role="alert" className="card" style={{ padding: 16, color: "var(--danger)" }}>{error}</div>}

      {loading ? <div className="card" style={{ padding: 40, textAlign: "center" }}>جارٍ التحميل…</div> : error && items.length === 0 ? null : groups.length === 0 ? (
        <div className="card" style={{ padding: 50, textAlign: "center", color: "var(--ink-3)" }}>لا توجد مراجعات مطابقة.</div>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {groups.map(([customerId, group]) => (
            <section className="card" key={customerId}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div><strong>{group.name}</strong><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{group.email}</div></div>
                <span className="tag">{group.reviews.length} مراجعة</span>
              </div>
              <div className="table-outer">
                <table className="table">
                  <thead><tr><th>العنصر</th><th>التقييم</th><th>التعليق</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead>
                  <tbody>{group.reviews.map((review) => (
                    <tr key={review.id}>
                      <td><div className="table-title">{review.entityName.ar || review.entityName.en}</div><div className="table-subtitle">{entityLabels[review.entityType]} · #{review.entityId}</div></td>
                      <td><span style={{ color: "var(--warm)", letterSpacing: 1 }} aria-label={`${review.rating} نجوم`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></td>
                      <td style={{ maxWidth: 320, whiteSpace: "normal" }}>{review.comment || <span className="faint">بدون تعليق</span>}</td>
                      <td><span className={`status status--${review.status === "approved" ? "active" : review.status === "pending" ? "draft" : "deleted"}`}>{statusLabels[review.status]}</span></td>
                      <td className="muted">{new Date(review.createdAt).toLocaleDateString("ar-EG")}</td>
                      <td><div className="row" style={{ justifyContent: "flex-end", gap: 5 }}>
                        {canModerate && review.status !== "approved" && <button className="btn btn--ghost btn--sm" disabled={moderatingReviewId === review.id} onClick={() => void moderate(review, "approved")}>{review.status === "hidden" ? "إظهار" : "اعتماد"}</button>}
                        {canModerate && review.status !== "rejected" && <button className="btn btn--ghost btn--sm" disabled={moderatingReviewId === review.id} onClick={() => void moderate(review, "rejected")}>رفض</button>}
                        {canModerate && review.status === "approved" && <button className="btn btn--ghost btn--sm" disabled={moderatingReviewId === review.id} onClick={() => void moderate(review, "hidden")}>إخفاء</button>}
                        {canDelete && <button aria-label="حذف نهائي" className="btn btn--danger btn--sm" onClick={() => setPendingDelete(review)}><Icon.Trash /></button>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <AdminConfirmModal open={pendingDelete != null} title="حذف المراجعة نهائيًا" confirmLabel="حذف نهائي" confirmClassName="btn btn--danger btn--sm" disableCancel={deleting} disableConfirm={deleting} onClose={() => setPendingDelete(null)} onConfirm={async () => {
        if (!pendingDelete) return;
        setError(null);
        setDeleting(true);
        try {
          await api.del(`/api/erp/reviews/${pendingDelete.id}`);
          setItems((current) => current.filter((item) => item.id !== pendingDelete.id));
          setPendingDelete(null);
        } catch {
          setError("تعذر حذف المراجعة. حاولي مرة أخرى.");
        } finally {
          setDeleting(false);
        }
      }}>
        <p style={{ margin: 0 }}>سيُحذف محتوى المراجعة نهائيًا، ولن يتمكن العميل من إرسال مراجعة أخرى لنفس العنصر.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
