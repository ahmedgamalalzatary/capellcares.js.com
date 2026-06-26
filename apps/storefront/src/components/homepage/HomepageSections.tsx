"use client";

import { useEffect, useRef, useState } from "react";
import type { HomepageBannersDto, HomepageBannerSectionDto } from "@minikoshk/shared";
import { ShopByCategory } from "./ShopByCategory";
import { NewArrivals } from "./NewArrivals";
import { BestSellers } from "./BestSellers";
import { PagerControls, useVisibleCount } from "./carousel-ui";
import { clampStart, maxStart, trackTransform } from "@/lib/carousel";
import type { StorefrontCategory } from "@/lib/categories";
import type { StorefrontProduct } from "@/lib/products";

type HomepageSectionsMap = HomepageBannersDto["sections"];
const DRAG_THRESHOLD = 40;

function useDragPaging(onPrevious: () => void, onNext: () => void) {
  const dragStartXRef = useRef<number | null>(null);

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      dragStartXRef.current = event.clientX;
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (dragStartXRef.current == null) {
        return;
      }

      const deltaX = event.clientX - dragStartXRef.current;
      dragStartXRef.current = null;

      if (Math.abs(deltaX) < DRAG_THRESHOLD) {
        return;
      }

      if (deltaX < 0) {
        onNext();
        return;
      }

      onPrevious();
    },
    onPointerCancel: () => {
      dragStartXRef.current = null;
    },
    onPointerLeave: () => {
      dragStartXRef.current = null;
    }
  };
}

function CarouselSection({
  section,
  ariaLabel,
  autoRotate
}: {
  section: HomepageBannerSectionDto;
  ariaLabel: string;
  autoRotate: boolean;
}) {
  const [index, setIndex] = useState(0);
  const total = section.items.length;
  const showPrevious = () => setIndex((current) => (current - 1 + total) % total);
  const showNext = () => setIndex((current) => (current + 1) % total);
  const dragHandlers = useDragPaging(showPrevious, showNext);

  useEffect(() => {
    if (!autoRotate || total <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [autoRotate, total]);

  if (total === 0) {
    return null;
  }

  const item = section.items[index] ?? section.items[0];

  return (
    <section aria-label={ariaLabel} role="region" className="py-6">
      <div
        {...(total > 1 ? dragHandlers : {})}
        className={`overflow-hidden rounded-3xl touch-pan-y ${total > 1 ? "cursor-grab" : "cursor-default"}`}
      >
        <a href={item.href}>
          <img
            src={item.imagePath}
            alt={`${ariaLabel} image ${index + 1}`}
            className="h-[clamp(280px,48vw,560px)] w-full object-cover"
          />
        </a>
      </div>
      <PagerControls
        ariaLabel={ariaLabel}
        count={total}
        index={index}
        dotNoun="slide"
        onPrevious={showPrevious}
        onNext={showNext}
        onSelect={setIndex}
      />
    </section>
  );
}

function GridSection({ section, ariaLabel }: { section: HomepageBannerSectionDto; ariaLabel: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const visible = useVisibleCount(viewportRef);
  const total = section.items.length;
  const [start, setStart] = useState(0);

  // Clamp on every render so a window resize (which changes `visible`) can never
  // leave the track scrolled past the last full window.
  const safeStart = clampStart(start, total, visible);
  const steps = maxStart(total, visible);

  const showPrevious = () => setStart((current) => clampStart(current - 1, total, visible));
  const showNext = () => setStart((current) => clampStart(current + 1, total, visible));
  const dragHandlers = useDragPaging(showPrevious, showNext);

  if (total === 0) {
    return null;
  }

  const canPage = steps > 0;

  return (
    <section aria-label={ariaLabel} role="region" className="py-6">
      <div
        ref={viewportRef}
        className={`overflow-hidden touch-pan-y ${canPage ? "cursor-grab" : "cursor-default"}`}
        {...(canPage ? dragHandlers : {})}
      >
        <div
          data-testid={`${ariaLabel} track`}
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: trackTransform(safeStart, visible) }}
        >
          {section.items.map((item) => (
            <div key={item.id} className="box-border shrink-0 px-2" style={{ flexBasis: `${100 / visible}%` }}>
              <a href={item.href}>
                <img
                  src={item.imagePath}
                  alt={`${ariaLabel} image ${item.id}`}
                  className="w-full rounded-md object-cover"
                />
              </a>
            </div>
          ))}
        </div>
      </div>
      {canPage && (
        <PagerControls
          ariaLabel={ariaLabel}
          count={steps + 1}
          index={safeStart}
          dotNoun="position"
          onPrevious={showPrevious}
          onNext={showNext}
          onSelect={setStart}
        />
      )}
    </section>
  );
}

function SingleSection({ section, ariaLabel }: { section: HomepageBannerSectionDto; ariaLabel: string }) {
  const item = section.items[0];
  if (!item) {
    return null;
  }

  return (
    <section aria-label={ariaLabel} role="region" className="py-6">
      <a href={item.href}>
        <img
          src={item.imagePath}
          alt={`${ariaLabel} image`}
          className="h-[clamp(220px,32vw,420px)] w-full rounded-3xl object-cover"
        />
      </a>
    </section>
  );
}

export function HomepageSections({
  sections,
  shopByCategories = [],
  newArrivals = [],
  bestSellers = []
}: {
  sections: HomepageSectionsMap;
  shopByCategories?: StorefrontCategory[];
  newArrivals?: StorefrontProduct[];
  bestSellers?: StorefrontProduct[];
}) {
  return (
    <div className="container">
      <CarouselSection section={sections.hero_primary} ariaLabel="Homepage hero primary" autoRotate />
      <ShopByCategory categories={shopByCategories} />
      <GridSection section={sections.grid_featured} ariaLabel="Homepage featured grid" />
      <SingleSection section={sections.single_mid} ariaLabel="Homepage single middle" />
      <NewArrivals products={newArrivals} />
      <CarouselSection section={sections.hero_secondary} ariaLabel="Homepage hero secondary" autoRotate />
      <BestSellers products={bestSellers} />
      <SingleSection section={sections.single_footer} ariaLabel="Homepage single footer" />
    </div>
  );
}
