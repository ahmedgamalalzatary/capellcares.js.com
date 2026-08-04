import type { Language, RatingSummary } from "@capella/shared";
import { Stars, template } from "./stars";

/**
 * The stars a card shows above its price. An unreviewed item renders nothing
 * rather than an empty row, which would read as a zero-star rating.
 */
export function CardRating({ rating, dict, lang }: { rating?: RatingSummary | null; dict: any; lang: Language }) {
  if (!rating || rating.count <= 0) {
    return null;
  }

  const labels = dict.reviews;
  const locale = lang === "ar" ? "ar-EG" : "en-EG";
  const average = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating.average);
  const count = new Intl.NumberFormat(locale).format(rating.count);
  const ratingText = template(labels.outOfFive, { rating: average });
  const countText = template(labels.reviewCount, { count });

  return (
    <span
      role="img"
      aria-label={`${ratingText}, ${countText}`}
      data-testid="card-rating"
      className="flex w-fit items-center gap-1.5 text-sm text-(--ink-2)"
    >
      <Stars rating={rating.average} className="text-sm" />
      <span aria-hidden className="font-semibold tabular-nums text-ink">{average}</span>
      <span aria-hidden>({count})</span>
    </span>
  );
}
