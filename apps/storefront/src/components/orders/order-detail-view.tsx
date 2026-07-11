"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Language, type Order, type ReviewEntityType } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCustomerOrderById, fetchOrderReviewEligibility, submitCustomerReview, type OrderReviewEligibility } from "@/lib/api/client";

export function OrderDetailView({ lang, dict, orderId }: { lang: Language; dict: any; orderId: number }) {
  const { accessToken } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<OrderReviewEligibility | null>(null);
  const [activeReview, setActiveReview] = useState<{ orderItemId: number; entityType: ReviewEntityType; entityId: number } | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isAr = lang === "ar";

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    Promise.all([fetchCustomerOrderById(orderId, accessToken), fetchOrderReviewEligibility(orderId, accessToken)]).then(([value, reviewEligibility]) => {
      setOrder(value);
      setEligibility(reviewEligibility);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [accessToken, orderId]);

  async function submitReview() {
    if (!accessToken || !activeReview || rating < 1) return;
    setSubmissionError(null);
    setSubmitting(true);
    try {
      await submitCustomerReview(accessToken, {
        entityType: activeReview.entityType,
        entityId: activeReview.entityId,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {})
      });
      setEligibility((current) => current ? {
        ...current,
        items: current.items.map((item) => item.entityType === activeReview.entityType && item.entityId === activeReview.entityId
          ? { ...item, eligible: false, submitted: true, status: "pending" }
          : item)
      } : current);
      setActiveReview(null);
      setRating(0);
      setComment("");
    } catch {
      setSubmissionError(dict.reviews.submissionError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="py-12 text-center text-(--ink-3)">{dict.common.loading}</p>;
  if (!order) return <p className="py-12 text-center text-(--ink-3)">{dict.common.empty}</p>;

  const statusChip = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("paid") || s.includes("delivered") || s.includes("complete")) return "chip--sage";
    if (s.includes("pending") || s.includes("processing")) return "chip--gold";
    if (s.includes("cancel") || s.includes("fail")) return "chip--accent";
    return "";
  };

  return (
    <div className="grid gap-5 pb-20">
      <div className="grid gap-3 rounded-lg border border-(--hairline) bg-surface p-5 shadow-(--shadow-1) sm:p-7 md:grid-cols-[1fr_auto] md:items-start">
        <div className="grid gap-2">
          <span className="eyebrow text-(--ink-3)!">{dict.orders.orderCode}</span>
          <div className={`leading-none text-ink ${isAr
            ? "text-2xl font-bold font-(family-name:--font-ar)"
            : "text-3xl font-(--font-display)"}`}>
            {order.orderCode}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-(--ink-2)">
            <span>{dict.orders.paymentStatus}:</span>
            <span className={`chip ${statusChip(order.paymentStatus)}`}>{order.paymentStatus}</span>
            <span aria-hidden>·</span>
            <span>{dict.common.total}: <span className="text-accent font-semibold">{order.totalAmount}</span></span>
          </div>
        </div>
        <div>
          <Link href={`/${lang}/orders`} className="btn btn--ghost">{dict.orders.backToOrders}</Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-(--hairline) bg-surface shadow-(--shadow-1)">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{dict.cart.item}</th>
                <th className="w-20 text-center">{dict.cart.qty}</th>
                <th className="w-32 text-end">{dict.cart.price}</th>
                <th className="w-32 text-end">{dict.common.total}</th>
                <th className="w-40 text-end">{dict.reviews.title}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const reviewState = eligibility?.items.find((candidate) => candidate.orderItemId === item.id);
                return (
                <tr key={item.id}>
                  <td className="text-ink">{isAr ? item.snapshotNameAr ?? item.snapshotNameEn : item.snapshotNameEn ?? item.snapshotNameAr}</td>
                  <td className="text-center text-(--ink-2)">×{item.qty}</td>
                  <td className="text-end text-(--ink-2)">{item.unitPrice}</td>
                  <td className="text-end font-semibold text-ink">{item.lineTotal}</td>
                  <td className="text-end">
                    {reviewState?.eligible && (
                      <button type="button" className="btn btn--soft" onClick={() => setActiveReview(reviewState)}>{dict.reviews.writeReview}</button>
                    )}
                    {reviewState?.submitted && <span className="chip chip--gold">{dict.reviews.statuses[reviewState.status ?? "deleted"]}</span>}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
      {activeReview && (
        <div className="rounded-lg border border-(--hairline) bg-(--warm-soft) p-5 sm:p-7">
          <h2 className="m-0 mb-5 font-(--font-display) text-2xl text-ink">{dict.reviews.writeReview}</h2>
          <fieldset className="mb-5 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-ink">{dict.reviews.ratingLabel}</legend>
            <div className="flex gap-1" dir="ltr">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="cursor-pointer text-3xl text-(--warm)">
                  <input className="sr-only" type="radio" name="review-rating" aria-label={`${value} stars`} checked={rating === value} onChange={() => setRating(value)} />
                  <span aria-hidden>{value <= rating ? "★" : "☆"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            {dict.reviews.commentLabel}
            <textarea className="min-h-28 rounded-md border border-(--hairline) bg-surface p-3 font-normal" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={dict.reviews.commentOptional} maxLength={2000} />
          </label>
          {submissionError && <p role="alert" className="mt-3 text-sm text-accent">{submissionError}</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn btn--primary" disabled={rating < 1 || submitting} onClick={() => void submitReview()}>{dict.reviews.submit}</button>
            <button type="button" className="btn btn--ghost" onClick={() => {
              setRating(0);
              setComment("");
              setSubmissionError(null);
              setActiveReview(null);
            }}>{dict.common.cancel ?? "Cancel"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
