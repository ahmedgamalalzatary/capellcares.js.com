/** Discount tag matching the floating New and Bestseller labels. */
export function DiscountRibbon({ percent, dict }: { percent: number | undefined; dict: any }) {
  if (!percent || percent <= 0) return null;
  return (
    <span
      data-testid="discount-ribbon"
      className="pointer-events-none absolute top-0 inset-s-0 z-20 inline-flex items-center rounded-ss-lg bg-black px-3 py-1.5 text-xs uppercase tracking-[0.16em] whitespace-nowrap text-(--ribbon) max-md:group-data-[cols=2]/cards:px-2 max-md:group-data-[cols=2]/cards:py-1 max-md:group-data-[cols=2]/cards:text-[10px] max-md:group-data-[cols=2]/cards:tracking-[0.06em]"
    >
      {dict.badges.discount.replace("{n}", String(percent))}
    </span>
  );
}
