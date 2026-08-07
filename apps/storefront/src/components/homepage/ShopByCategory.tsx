"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StorefrontCategory } from "@/lib/categories";
import { dir, type Language } from "@minikoshk/shared";
import { useLocale } from "../i18n/LocaleProvider";
import { ChevronLeft, ChevronRight } from "../icons";

const SECTION_LABEL = "Shop by category";

/** From 600px up, a second row only earns its space past this many cards. Below
    600px the rail always stays two rows tall so the cards keep a readable size. */
const SECOND_ROW_MIN_CARDS = 6;

/* Category art is a 900x255 transparent artboard whose pill outline spans
   26,14 -> 874,241 — the frame, its hairline, and the radius are baked into the
   PNG. Sizing the card to that inner box and covering it with the art scaled by
   900/848 pushes the baked frame out under the card's rounded clip, so the
   border, radius, shadow, hover, and focus ring all come from CSS instead. Art
   with other proportions still fills the card, center-cropped. */
const CARD_BOX = "aspect-[848/227]";
const ART_BLEED = "scale-[1.062]";

/**
 * Dissolves the rail against whichever physical edge still hides cards, so the
 * strip reads as continuing off-screen without dimming a card that is genuinely
 * the first or last one. Returns undefined when nothing is hidden.
 */
function edgeFadeMask(fadeLeft: boolean, fadeRight: boolean) {
  if (!fadeLeft && !fadeRight) {
    return undefined;
  }
  const start = fadeLeft ? "transparent 0, #000 1.5rem" : "#000 0";
  const end = fadeRight ? "#000 calc(100% - 1.5rem), transparent 100%" : "#000 100%";
  return `linear-gradient(to right, ${start}, ${end})`;
}

function CategoryCard({ category, lang }: { category: StorefrontCategory; lang: Language }) {
  const label = category.name[lang];

  return (
    <a
      href={`/${lang}/shop?category=${category.slug}`}
      className="group snap-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2"
    >
      <span
        className={`relative block w-full overflow-hidden rounded-xl border border-black/[0.07] bg-white ${CARD_BOX} shadow-[0_1px_1px_rgba(53,58,63,0.04),0_4px_12px_-6px_rgba(53,58,63,0.18)] transition duration-200 ease-out group-hover:-translate-y-1 group-hover:border-black/15 group-hover:shadow-[0_2px_4px_rgba(53,58,63,0.06),0_14px_26px_-12px_rgba(53,58,63,0.35)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0`}
      >
        <img
          src={category.imagePath ?? ""}
          alt={label}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover ${ART_BLEED} transition-transform duration-300 ease-out group-hover:scale-[1.11] motion-reduce:transition-none motion-reduce:group-hover:scale-[1.062]`}
        />
      </span>
    </a>
  );
}

function RailArrow({
  side,
  rtl,
  atEdge,
  onClick
}: {
  side: "previous" | "next";
  rtl: boolean;
  /** The rail is already against this edge, so the arrow fades out of reach. */
  atEdge: boolean;
  onClick: () => void;
}) {
  // The arrow points toward the edge it scrolls to, which swaps in RTL.
  const pointsLeft = (side === "previous") !== rtl;
  const Chevron = pointsLeft ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      aria-label={`${SECTION_LABEL} ${side}`}
      onClick={onClick}
      disabled={atEdge}
      className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-black/[0.07] bg-white text-brand-dark shadow-[0_2px_6px_rgba(53,58,63,0.18)] transition duration-200 hover:bg-brand-dark hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-0 motion-reduce:transition-none min-[900px]:flex ${
        side === "previous" ? "start-0" : "end-0"
      }`}
    >
      <Chevron className="h-5 w-5" />
    </button>
  );
}

/**
 * "Shop by category": a horizontal rail of category cards that bleeds past the
 * container so it reads as continuing off-screen. The caller passes
 * already-filtered categories (see `selectShopByCategories`).
 */
export function ShopByCategory({ categories }: { categories: StorefrontCategory[] }) {
  const { lang, dict } = useLocale();
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const syncScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    const distance = rail.scrollWidth - rail.clientWidth;
    // RTL scroll offsets run negative in every current engine, so compare magnitudes.
    const position = Math.abs(rail.scrollLeft);
    setAtStart(position <= 1);
    setAtEnd(position >= distance - 1);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") {
      return;
    }
    syncScrollState();
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [syncScrollState, categories.length]);

  const scrollByPage = (side: "previous" | "next") => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    const rtl = dir(lang) === "rtl";
    const magnitude = rail.clientWidth * 0.8 * (side === "next" ? 1 : -1) * (rtl ? -1 : 1);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: magnitude, behavior: reduceMotion ? "auto" : "smooth" });
  };

  if (categories.length === 0) {
    return null;
  }

  const headingClass = "font-heading text-xl font-bold tracking-[0.25em] text-brand-dark uppercase whitespace-nowrap";
  const rtl = dir(lang) === "rtl";
  // One row is plenty until there are enough cards to make a second one look full.
  const desktopRows = categories.length >= SECOND_ROW_MIN_CARDS ? "" : "min-[600px]:grid-rows-1";
  const railMask = edgeFadeMask(rtl ? !atEnd : !atStart, rtl ? !atStart : !atEnd);

  return (
    <section aria-label={SECTION_LABEL} role="region" className="py-8">
      <h2 className="mb-5 flex items-center gap-3">
        <span className={headingClass}>{dict.shop.shopByCategoryTop}</span>
        <span className="h-px flex-1 bg-black" aria-hidden />
        <span className={headingClass}>{dict.shop.shopByCategoryBottom}</span>
      </h2>

      <div className="relative">
        <div
          ref={railRef}
          onScroll={syncScrollState}
          /* The rail bleeds into the container's own padding so cards run to the
             screen edge, and the mask dissolves them there rather than cutting
             them off. `py-3` keeps the hover lift and its shadow inside the
             scroll box, which cannot overflow vertically once it scrolls. */
          style={railMask ? { maskImage: railMask, WebkitMaskImage: railMask } : undefined}
          className={`-mx-6 grid auto-cols-[clamp(190px,46vw,320px)] grid-flow-col grid-rows-2 gap-x-4 gap-y-3 overflow-x-auto scroll-px-6 scroll-smooth px-6 py-3 [-ms-overflow-style:none] [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden min-[600px]:gap-x-5 min-[600px]:gap-y-4 ${desktopRows}`}
        >
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} lang={lang} />
          ))}
        </div>

        <RailArrow side="previous" rtl={rtl} atEdge={atStart} onClick={() => scrollByPage("previous")} />
        <RailArrow side="next" rtl={rtl} atEdge={atEnd} onClick={() => scrollByPage("next")} />
      </div>
    </section>
  );
}
