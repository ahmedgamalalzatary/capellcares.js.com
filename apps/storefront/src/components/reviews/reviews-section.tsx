import type { Language, PublicReview, ReviewEntityType, ReviewSummary } from "@capella/shared";
import { fetchPublicReviews } from "@/lib/api/client";

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="inline-flex gap-0.5 text-lg text-(--warm)" aria-label={`${rating} ${label}`}>
      {Array.from({ length: 5 }, (_, index) => <span key={index} aria-hidden>{index < rating ? "★" : "☆"}</span>)}
    </span>
  );
}

export async function ReviewsSection({
  entityType,
  entityId,
  lang,
  dict
}: {
  entityType: ReviewEntityType;
  entityId: number;
  lang: Language;
  dict: any;
}) {
  const data = await fetchPublicReviews(entityType, entityId) ?? {
    summary: { averageRating: null, reviewCount: 0 } satisfies ReviewSummary,
    items: [] satisfies PublicReview[]
  };

  return (
    <section className="my-12 border-t border-(--hairline) pt-10 sm:my-18 sm:pt-14" aria-labelledby={`reviews-${entityType}-${entityId}`}>
      <div className="mb-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="eyebrow mb-2 text-(--ink-3)!">{dict.reviews.eyebrow}</p>
          <h2 id={`reviews-${entityType}-${entityId}`} className="m-0 font-(--font-display) text-3xl text-ink sm:text-4xl">
            {dict.reviews.title}
          </h2>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-(--hairline) bg-surface px-5 py-2.5">
          <Stars rating={Math.round(data.summary.averageRating ?? 0)} label={dict.reviews.stars} />
          <strong>{data.summary.averageRating ?? "—"}</strong>
          <span className="text-sm text-(--ink-3)">({data.summary.reviewCount})</span>
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-(--hairline) bg-(--warm-soft) px-6 py-10 text-center text-(--ink-3)">
          {dict.reviews.empty}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((review) => (
            <article key={review.id} className="grid content-start gap-4 rounded-lg border border-(--hairline) bg-surface p-5 shadow-(--shadow-1) sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="m-0 text-base font-semibold text-ink">{review.customerName}</h3>
                  <time className="text-xs text-(--ink-3)" dateTime={review.createdAt}>
                    {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium" }).format(new Date(review.createdAt))}
                  </time>
                </div>
                <Stars rating={review.rating} label={dict.reviews.stars} />
              </div>
              {review.comment && <p className="m-0 leading-7 text-(--ink-2)">{review.comment}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
