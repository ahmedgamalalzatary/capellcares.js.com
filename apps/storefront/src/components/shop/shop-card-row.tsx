"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { getDict, type Language } from "@capella/shared";
import { NavArrow } from "@/components/ui/nav-arrow";
import { NoCardImageSwipe } from "@/components/ui/card-image-carousel";

/** Shop-page card layout: one row of cards (3 desktop, 2 tablet, ~1 with a peek mobile) with the rest reachable via horizontal scroll; cards keep a fixed 1/3 width and snap, scrollbar hidden.
 * On desktop prev/next buttons scroll a page and disable at the ends (hidden on touch/tablet); used by the shop page's sections and Capella Tips, leaving ProductCard/SectionCard untouched. */
export function ShopCardRow({
  children,
  lang,
  cols = 1
}: {
  children: React.ReactNode;
  lang: Language;
  /** Card density, matching ColumnsToggle: 1 keeps the roomy default (3 per screen desktop), 2 packs one extra card into every breakpoint, 3 fits small logo or portrait tiles; only item width changes — the row still scrolls and snaps either way. */
  cols?: 1 | 2 | 3;
}) {
  const isRtl = lang === "ar";
  const dict = getDict(lang);
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

  // Widths subtract the gaps (1.25rem / 1.5rem / 1.75rem per breakpoint) so a whole number of cards lands per screen, leaving a peek on mobile.
  const itemWidthClass = cols === 3
    ? "w-[40%] sm:w-[calc((100%-3*1.5rem)/4)] lg:w-[calc((100%-5*1.75rem)/6)]"
    : cols === 2
    ? "w-[calc((100%-1.25rem)/2)] sm:w-[calc((100%-2*1.5rem)/3)] lg:w-[calc((100%-3*1.75rem)/4)]"
    : "w-[78%] sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-2*1.75rem)/3)]";

  const arrowClass = "absolute top-[42%] z-10 -translate-y-1/2";

  return (
    // The row scrolls sideways, so its cards' pictures don't swipe; a sideways swipe scrolls the row instead.
    <NoCardImageSwipe>
    <div className="relative min-w-0">
      <div
        ref={scrollerRef}
        className={[
          // min-w-0 keeps the scroller from being widened to its content by a flex/grid parent, which would push the cards past the viewport.
          "flex min-w-0 snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pt-1 pb-3 sm:gap-6 lg:gap-7",
          // hide the scrollbar — prev/next buttons (and swipe) are the affordance
          "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        ].join(" ")}
      >
        {Children.map(children, (child) =>
          child == null ? null : (
            <div className={`shrink-0 snap-start ${itemWidthClass}`}>
              {child}
            </div>
          )
        )}
      </div>

      <NavArrow
        direction="prev"
        isRtl={isRtl}
        aria-label={dict.common.previous}
        onClick={() => scrollByPage("prev")}
        disabled={!canPrev}
        className={`${arrowClass} inset-s-1`}
      />
      <NavArrow
        direction="next"
        isRtl={isRtl}
        aria-label={dict.common.next}
        onClick={() => scrollByPage("next")}
        disabled={!canNext}
        className={`${arrowClass} inset-e-1`}
      />
    </div>
    </NoCardImageSwipe>
  );
}
