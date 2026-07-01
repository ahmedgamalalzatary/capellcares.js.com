"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";

/**
 * Shop-page card layout: one row of cards (3 on desktop, 2 on tablet, ~1 with a
 * peek on mobile) with the rest reachable via horizontal scroll. Cards keep a
 * fixed 1/3 width and snap into place; the scrollbar is hidden.
 *
 * On desktop, prev/next buttons scroll the row by a page and disable at the
 * ends. The buttons are hidden on touch/tablet, where swiping is natural.
 *
 * Shop-page only — other pages keep their multi-row grids, so this leaves
 * ProductCard / SectionCard untouched.
 */
export function ShopCardRow({
  children,
  lang
}: {
  children: React.ReactNode;
  lang: string;
}) {
  const isRtl = lang === "ar";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateAffordances = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // RTL scrollLeft is negative in modern browsers; abs() normalizes both.
    const offset = Math.abs(el.scrollLeft);
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanPrev(offset > 1);
    setCanNext(offset < maxScroll - 1);
  }, []);

  useEffect(() => {
    updateAffordances();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateAffordances, { passive: true });
    window.addEventListener("resize", updateAffordances);
    return () => {
      el.removeEventListener("scroll", updateAffordances);
      window.removeEventListener("resize", updateAffordances);
    };
  }, [updateAffordances]);

  const scrollByPage = (direction: "prev" | "next") => {
    const el = scrollerRef.current;
    if (!el) return;
    const isRtl = getComputedStyle(el).direction === "rtl";
    // "next" moves toward the row's end regardless of writing direction.
    const sign = direction === "next" ? 1 : -1;
    const amount = el.clientWidth * 0.9 * sign * (isRtl ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const buttonClass =
    "absolute top-[42%] z-10 hidden size-12 -translate-y-1/2 place-items-center text-ink drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)] transition hover:scale-120 disabled:pointer-events-none disabled:opacity-0 lg:grid";

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className={[
          "flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pt-1 pb-2 sm:gap-6 lg:gap-7",
          // hide the scrollbar — prev/next buttons (and swipe) are the affordance
          "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        ].join(" ")}
      >
        {Children.map(children, (child) =>
          child == null ? null : (
            <div className="w-[78%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-2*1.75rem)/3)]">
              {child}
            </div>
          )
        )}
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => scrollByPage("prev")}
        disabled={!canPrev}
        className={`${buttonClass} inset-s-1`}
      >
        <Icon.Chevron size={40} className={isRtl ? "" : "rotate-180"} />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => scrollByPage("next")}
        disabled={!canNext}
        className={`${buttonClass} inset-e-1`}
      >
        <Icon.Chevron size={40} className={isRtl ? "rotate-180" : ""} />
      </button>
    </div>
  );
}
