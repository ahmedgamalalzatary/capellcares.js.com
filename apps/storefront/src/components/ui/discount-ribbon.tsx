/** The "X% OFF" ribbon pinned to a discounted product card's top corner; the notch sits on the inner end and mirrors in RTL. Renders nothing without a saving. */
export function DiscountRibbon({ percent, dict }: { percent: number | undefined; dict: any }) {
  if (!percent || percent <= 0) return null;
  return (
    <span className="pointer-events-none absolute top-3 inset-s-0 z-10 bg-(--magenta-deep) py-1 ps-3 pe-4 text-xs font-extrabold uppercase text-white [clip-path:polygon(0_0,100%_0,calc(100%-8px)_50%,100%_100%,0_100%)] rtl:[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,8px_50%)]">
      {dict.badges.discount.replace("{n}", String(percent))}
    </span>
  );
}
