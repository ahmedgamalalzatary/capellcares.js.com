"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Language, type Order } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCustomerOrderById } from "@/lib/api/client";
import { ReviewFormModal } from "@/components/reviews/review-form-modal";

export function OrderDetailView({ lang, dict, orderId }: { lang: Language; dict: any; orderId: number }) {
  const { accessToken } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewingItemId, setReviewingItemId] = useState<number | null>(null);
  const isAr = lang === "ar";

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    fetchCustomerOrderById(orderId, accessToken).then((value) => {
      setOrder(value);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [accessToken, orderId]);

  if (loading) return <p className="py-12 text-center text-(--ink-3)">{dict.common.loading}</p>;
  if (!order) return <p className="py-12 text-center text-(--ink-3)">{dict.common.empty}</p>;

  const reviewingItem = order.items.find((item) => item.id === reviewingItemId) ?? null;

  const statusChip = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("accepted") || s.includes("paid") || s.includes("delivered") || s.includes("complete")) return "chip--sage";
    if (s.includes("pending") || s.includes("processing")) return "chip--gold";
    if (s.includes("denied") || s.includes("cancel") || s.includes("fail")) return "chip--accent";
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
                <th className="w-44 text-end">{dict.reviews.rating}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="text-ink">{isAr ? item.snapshotNameAr ?? item.snapshotNameEn : item.snapshotNameEn ?? item.snapshotNameAr}</td>
                  <td className="text-center text-(--ink-2)">×{item.qty}</td>
                  <td className="text-end text-(--ink-2)">{item.unitPrice}</td>
                  <td className="text-end font-semibold text-ink">{item.lineTotal}</td>
                  <td className="text-end">
                    {item.review?.state === "eligible" ? (
                      <button type="button" className="btn btn--ghost" onClick={() => setReviewingItemId(item.id)}>{dict.reviews.writeReview}</button>
                    ) : item.review?.state === "submitted" ? (
                      <span className="text-sm font-medium text-(--success)">{dict.reviews.submitted}</span>
                    ) : item.review?.state === "unavailable" ? (
                      <span className="text-sm text-(--ink-3)">{dict.reviews.unavailable}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {reviewingItem?.review && accessToken ? (
        <ReviewFormModal
          open
          accessToken={accessToken}
          itemName={isAr ? reviewingItem.snapshotNameAr ?? reviewingItem.snapshotNameEn ?? "" : reviewingItem.snapshotNameEn ?? reviewingItem.snapshotNameAr ?? ""}
          target={reviewingItem.review}
          dict={dict}
          onClose={() => setReviewingItemId(null)}
          onSubmitted={() => {
            const submittedTarget = reviewingItem.review!;
            setOrder((current) => current ? {
              ...current,
              items: current.items.map((item) => item.review &&
                item.review.entityType === submittedTarget.entityType &&
                item.review.entityId === submittedTarget.entityId
                ? { ...item, review: { ...item.review, state: "submitted" } }
                : item)
            } : current);
            setReviewingItemId(null);
          }}
        />
      ) : null}
    </div>
  );
}
