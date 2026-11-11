/**
 * The "X% OFF" ribbon on a discounted card's top corner (shaped like Dabdoob's): a tag that pokes
 * 4px past the card's edge, a darker fold tucked under that end, a rounded top corner and a notched
 * tail, with a soft shadow. It must sit outside the picture's overflow-hidden box, or the part past
 * the edge is cut off. Logical sides, so it mirrors in RTL. Renders nothing without a saving.
 */
export function DiscountRibbon({ percent, dict }: { percent: number | undefined; dict: any }) {
  if (!percent || percent <= 0) return null;
  return (
    <span
      data-testid="discount-ribbon"
      className="pointer-events-none absolute top-3 -inset-s-1 z-20 drop-shadow-[0_5px_2.5px_rgba(0,0,0,0.25)]"
    >
      <span className="block h-5.25 rounded-ss-[5px] bg-(--magenta-deep) ps-1.5 pe-3 text-[11px] font-bold uppercase leading-5.25 whitespace-nowrap text-white [clip-path:polygon(0_0,100%_0,calc(100%-10px)_50%,100%_100%,0_100%)] [&:dir(rtl)]:[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,10px_50%)]">
        {dict.badges.discount.replace("{n}", String(percent))}
      </span>
      {/* The fold: the strip's end turning back behind the card. */}
      <span
        aria-hidden="true"
        className="absolute top-full inset-s-0 h-1 w-0.75 bg-[color-mix(in_srgb,var(--magenta-deep),black_35%)] [clip-path:polygon(0_0,100%_100%,100%_0)] [&:dir(rtl)]:[clip-path:polygon(0_0,0_100%,100%_0)]"
      />
    </span>
  );
}
