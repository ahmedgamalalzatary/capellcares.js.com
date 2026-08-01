"use client";

import { useId, useRef, useState } from "react";
import type { Language, ReviewEntityType, ReviewPage } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { fetchPublicReviews } from "@/lib/api/client";
import { useModalAccessibility } from "./use-modal-accessibility";

interface Props {
  entityType: ReviewEntityType;
  entityId: number;
  reviewData: ReviewPage | null;
  lang: Language;
  dict: any;
}

function template(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, replacement),
    value
  );
}

function Stars({ rating, label }: { rating: number; label?: string }) {
  return (
    <span className="inline-flex gap-0.5 text-lg text-gold" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden className={star <= Math.round(rating) ? "text-gold" : "text-(--hairline)"}>★</span>
      ))}
    </span>
  );
}

export function ReviewSummary({ entityType, entityId, reviewData, lang, dict }: Props) {
  if (!reviewData) {
    return <p role="alert" className="text-sm text-(--error)">{dict.reviews.loadError}</p>;
  }

  return <LoadedReviewSummary entityType={entityType} entityId={entityId} reviewData={reviewData} lang={lang} dict={dict} />;
}

function LoadedReviewSummary({ entityType, entityId, reviewData, lang, dict }: Props & { reviewData: ReviewPage }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(reviewData.items);
  const [page, setPage] = useState(reviewData.pagination.page);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const labels = dict.reviews;
  const ratingText = template(labels.outOfFive, { rating: reviewData.summary.averageRating.toFixed(1) });
  const countText = template(labels.reviewCount, { count: String(reviewData.summary.reviewCount) });

  useModalAccessibility(open, overlayRef, dialogRef, () => setOpen(false));

  const loadMore = async () => {
    if (loading || page >= reviewData.pagination.totalPages) return;
    setLoading(true);
    setLoadError(false);
    try {
      const nextPage = await fetchPublicReviews(entityType, entityId, page + 1, reviewData.pagination.pageSize);
      if (!nextPage) throw new Error("Missing review page");
      setItems((current) => [...current, ...nextPage.items]);
      setPage(nextPage.pagination.page);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="flex w-fit items-center gap-2 rounded-(--radius-pill) border-0 bg-transparent p-0 text-sm text-(--ink-2) underline-offset-4 hover:text-ink hover:underline"
        aria-label={`${ratingText}, ${countText}`}
        onClick={() => setOpen(true)}
      >
        <Stars rating={reviewData.summary.averageRating} label={ratingText} />
        <span className="font-semibold tabular-nums text-ink">{reviewData.summary.averageRating.toFixed(1)}</span>
        <span>({reviewData.summary.reviewCount})</span>
      </button>

      {open ? (
        <div ref={overlayRef} className="fixed inset-0 z-100 bg-black/45 sm:grid sm:place-items-center sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="flex h-full w-full flex-col overflow-hidden bg-canvas sm:max-h-[min(760px,90vh)] sm:max-w-2xl sm:rounded-(--radius-lg) sm:border sm:border-(--hairline) sm:shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-(--hairline) p-5 sm:p-6">
              <div>
                <h2 id={titleId} className="m-0 text-2xl font-semibold text-ink">{labels.title}</h2>
                <div className="mt-2 flex items-center gap-2 text-sm text-(--ink-2)">
                  <Stars rating={reviewData.summary.averageRating} label={ratingText} />
                  <span>{ratingText}</span>
                  <span>·</span>
                  <span>{countText}</span>
                </div>
              </div>
              <button type="button" className="btn btn--soft p-2!" aria-label={labels.close} onClick={() => setOpen(false)}>
                <Icon.Close />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {items.length === 0 ? (
                <p className="text-(--ink-3)">{labels.noReviews}</p>
              ) : (
                <div className="grid gap-4">
                  {items.map((review) => (
                    <article key={review.id} className="rounded-(--radius) border border-(--hairline) bg-surface p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-ink">{review.firstName}</strong>
                        <Stars rating={review.rating} label={template(labels.outOfFive, { rating: String(review.rating) })} />
                      </div>
                      <div className="mt-1 text-xs font-medium text-(--success)">{labels.verifiedPurchase}</div>
                      <p className="mb-0 mt-3 whitespace-pre-wrap leading-7 text-(--ink-2)">{review.comment}</p>
                      <time className="mt-3 block text-xs text-(--ink-3)" dateTime={review.createdAt}>
                        {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium" }).format(new Date(review.createdAt))}
                      </time>
                    </article>
                  ))}
                  {page < reviewData.pagination.totalPages ? (
                    <button type="button" className="btn btn--ghost btn--block" disabled={loading} onClick={loadMore}>
                      {loading ? labels.loading : labels.loadMore}
                    </button>
                  ) : null}
                  {loadError ? <p role="alert" className="text-sm text-(--error)">{labels.loadError}</p> : null}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
