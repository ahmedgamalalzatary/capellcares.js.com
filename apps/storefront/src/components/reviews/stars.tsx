/** Fills a dictionary template such as "{rating} out of 5". */
export function template(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, replacement),
    value
  );
}

/**
 * The five-star row. Without a label it is decorative — the caller is then
 * responsible for naming the rating, so screen readers hear it once.
 */
export function Stars({ rating, label, className }: { rating: number; label?: string; className?: string }) {
  const decorative = label == null;
  return (
    <span
      className={`inline-flex gap-0.5 text-gold ${className ?? "text-lg"}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden className={star <= Math.round(rating) ? "text-gold" : "text-(--hairline)"}>★</span>
      ))}
    </span>
  );
}
