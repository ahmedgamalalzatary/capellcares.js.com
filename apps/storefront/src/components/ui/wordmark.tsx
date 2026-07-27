/**
 * The Đespacito lockup, set in type rather than shipped as a raster.
 *
 * The printed logo is a Didone with a crossed D (Đ, U+0110) and the word
 * "Delight" riding in script above its end shoulder. Bodoni Moda carries both:
 * caps at wide tracking for the wordmark, italic for "Delight". Setting it in
 * type means it stays crisp at any size, recolours with the theme, and costs no
 * image bytes — the header previously pointed at /logoblack.jpg, which is no
 * longer in public/ and rendered broken.
 *
 * The size lands on the WRAPPER, and both halves size in `em` off it, so
 * "Delight" tracks the wordmark at every breakpoint instead of drifting into
 * the letterforms.
 */
export function Wordmark({
  size = "md",
  className = "",
  showDelight = true
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** The script half. Drop it where the lockup would crowd, e.g. tight nav. */
  showDelight?: boolean;
}) {
  const wrapperScale = {
    sm: "text-lg sm:text-xl",
    md: "text-2xl sm:text-3xl",
    lg: "text-4xl sm:text-5xl",
    xl: "text-[clamp(2.6rem,11vw,9rem)]"
  }[size];

  return (
    // dir=ltr: the wordmark is a Latin mark and must not mirror on Arabic pages.
    //
    // Column with a negative bottom margin rather than absolute positioning:
    // "Delight" stacks above the end shoulder and tucks into the wordmark's
    // ascender space, matching the printed lockup. Absolute offsets could not
    // track a clamped font size and collided with the letterforms.
    <span
      dir="ltr"
      className={`inline-flex flex-col items-end leading-none ${wrapperScale} ${className}`}
    >
      {showDelight ? (
        <span
          aria-hidden
          className="wordmark__delight -mb-[0.06em] me-[0.55em] text-[0.26em]"
        >
          Delight
        </span>
      ) : null}
      <span className="wordmark block text-[1em]">Đespacito</span>
    </span>
  );
}
