"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice, type Language, type Order } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCustomerOrderById } from "@/lib/api/client";
import { ReviewFormModal } from "@/components/reviews/review-form-modal";
import { Icon } from "@/components/ui/icons";
import {
  formatOrderDate,
  itemsCountLabel,
  OrderItemMedia,
  orderItemCategory,
  orderItemHref,
  orderItemName,
  paymentStatusChip,
  paymentStatusLabel,
  useCatalog
} from "./order-presentation";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-(--hairline) bg-surface shadow-(--shadow-1)">
      <h2 className="m-0 border-b border-(--hairline) px-4 py-3 text-sm font-semibold text-ink sm:px-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function OrderDetailView({ lang, dict, orderId }: { lang: Language; dict: any; orderId: number }) {
  const { accessToken, logout } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reviewingItemId, setReviewingItemId] = useState<number | null>(null);
  const catalog = useCatalog();
  const isAr = lang === "ar";

  useEffect(() => {
    if (!accessToken) {
      setOrder(null);
      setLoadError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setOrder(null);
    setLoadError(false);
    setLoading(true);
    fetchCustomerOrderById(orderId, accessToken).then((value) => {
      if (cancelled) return;
      setOrder(value);
      setLoading(false);
    }).catch((error) => {
      if (cancelled) return;
      if (error instanceof Error && error.message.includes("API 401")) {
        void logout().catch(() => {});
      } else {
        setLoadError(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, orderId, logout]);

  if (loading) {
    return (
      <div className="grid gap-4 pb-20">
        {[0, 1].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg border border-(--hairline) bg-(--warm-soft)" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return <p role="alert" className="py-12 text-center text-sm text-(--error)">{dict.orders.loadError}</p>;
  }

  if (!order) return <p className="py-12 text-center text-(--ink-3)">{dict.common.empty}</p>;

  const reviewingItem = order.items.find((item) => item.id === reviewingItemId) ?? null;
  const units = order.items.reduce((acc, item) => acc + item.qty, 0);
  // Line totals are the authoritative per-item figures stored with the order;
  // summing them gives the goods subtotal, which for COD equals the order total.
  const subtotal = order.items.reduce((acc, item) => acc + item.lineTotal, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {/* Header: identity, status, and the way back */}
        <div className="grid gap-3 rounded-lg border border-(--hairline) bg-surface p-5 shadow-(--shadow-1) sm:p-6 md:grid-cols-[1fr_auto] md:items-start">
          <div className="grid gap-2">
            <span className="eyebrow text-(--ink-3)!">{dict.orders.orderCode}</span>
            <div className={`leading-none text-ink ${isAr
              ? "text-2xl font-bold font-(family-name:--font-ar)"
              : "text-3xl font-(--font-display)"}`}>
              {order.orderCode}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-(--ink-2)">
              <span className={`chip ${paymentStatusChip(order.paymentStatus)}`}>
                {paymentStatusLabel(order.paymentStatus, dict)}
              </span>
              <span aria-hidden>·</span>
              <span>{dict.orders.placedOn} {formatOrderDate(order.createdAt, lang)}</span>
              <span aria-hidden>·</span>
              <span>{itemsCountLabel(units, dict)}</span>
              <span aria-hidden>·</span>
              <span>{dict.common.total}: {formatPrice(order.totalAmount, lang)}</span>
            </div>
          </div>
          <div className="md:text-end">
            <Link href={`/${lang}/orders`} className="btn btn--ghost">{dict.orders.backToOrders}</Link>
          </div>
        </div>

        {/* Items: thumbnail, snapshot name/size, quantity, money, review action */}
        <Panel title={dict.orders.itemsInOrder}>
          <ul className="m-0 grid list-none gap-0 p-0">
            {order.items.map((item) => {
              const href = orderItemHref(item, catalog, lang);
              const name = orderItemName(item, lang);
              const category = orderItemCategory(item, catalog, lang);

              return (
                <li
                  key={item.id}
                  className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-(--hairline) p-4 last:border-b-0 sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-4 sm:p-5"
                >
                  <div className="aspect-square w-16 self-start overflow-hidden rounded-md bg-(--warm-soft) sm:w-20">
                    {href ? (
                      <Link href={href} className="block h-full w-full">
                        <OrderItemMedia item={item} catalog={catalog} lang={lang} />
                      </Link>
                    ) : (
                      <OrderItemMedia item={item} catalog={catalog} lang={lang} />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      {href ? (
                        <Link href={href} className="block font-medium break-words text-ink hover:text-accent">
                          {name}
                        </Link>
                      ) : (
                        <div className="font-medium break-words text-ink">{name}</div>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-(--ink-3)">
                        {category ? (
                          <>
                            <span>{category}</span>
                            <span aria-hidden>·</span>
                          </>
                        ) : null}
                        {item.snapshotSizeLabel ? <span>{item.snapshotSizeLabel}</span> : null}
                        {item.snapshotSizeLabel ? <span aria-hidden>·</span> : null}
                        <span>{formatPrice(item.unitPrice, lang)} × {item.qty}</span>
                        {/* Until the catalog lands every line looks unresolvable,
                            so the notice waits for the fetch to settle. */}
                        {!href && catalog.loaded ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{dict.orders.unavailableItem}</span>
                          </>
                        ) : null}
                      </div>

                      {item.review?.state === "eligible" ? (
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-(--radius) border-0 bg-transparent p-0 text-sm font-medium text-ink underline underline-offset-2 transition-colors hover:text-accent"
                          onClick={() => setReviewingItemId(item.id)}
                        >
                          {dict.reviews.writeReview}
                        </button>
                      ) : item.review?.state === "submitted" ? (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-(--success)">
                          <Icon.Check size={14} />
                          <span>{dict.reviews.submitted}</span>
                        </div>
                      ) : item.review?.state === "unavailable" ? (
                        <div className="mt-2 text-sm text-(--ink-3)">{dict.reviews.unavailable}</div>
                      ) : null}
                    </div>

                    <div className="ms-auto shrink-0 text-end font-semibold text-ink">
                      {formatPrice(item.lineTotal, lang)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {reviewingItem?.review && accessToken ? (
        <ReviewFormModal
          open
          accessToken={accessToken}
          itemName={orderItemName(reviewingItem, lang)}
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
