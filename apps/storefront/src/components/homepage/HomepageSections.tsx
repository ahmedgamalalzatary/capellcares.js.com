"use client";

import { useEffect, useRef, useState } from "react";
import type { HomepageBannersDto, HomepageBannerSectionDto } from "@minikoshk/shared";
import { ChevronLeft, ChevronRight } from "../icons";
import { ShopByCategory } from "./ShopByCategory";
import type { StorefrontCategory } from "@/lib/categories";

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
        className={`relative touch-pan-y ${total > 1 ? "cursor-grab" : "cursor-default"}`}
      >
        <a href={item.href}>
          <img
            src={item.imagePath}
            alt={`${ariaLabel} image ${index + 1}`}
            className="h-[clamp(280px,48vw,560px)] w-full rounded-3xl object-cover"
          />
        </a>
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label={`${ariaLabel} previous`}
              onClick={showPrevious}
              className="absolute top-1/2 left-2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center text-brand-dark min-[600px]:left-4"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button
              type="button"
              aria-label={`${ariaLabel} next`}
              onClick={showNext}
              className="absolute top-1/2 right-2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center text-brand-dark min-[600px]:right-4"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {section.items.map((slideItem, slideIndex) => (
            <button
              key={slideItem.id}
              type="button"
              aria-label={`${ariaLabel} slide ${slideIndex + 1}`}
              onClick={() => setIndex(slideIndex)}
              className={`h-2.5 w-2.5 rounded-full border-0 transition ${
                slideIndex === index ? "bg-brand-dark" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GridSection({ section, ariaLabel }: { section: HomepageBannerSectionDto; ariaLabel: string }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(section.items.length / 4));
  const visibleItems = section.items.slice(page * 4, page * 4 + 4);
  const showPrevious = () => setPage((current) => (current - 1 + pageCount) % pageCount);
  const showNext = () => setPage((current) => (current + 1) % pageCount);
  const dragHandlers = useDragPaging(showPrevious, showNext);

  if (section.items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={ariaLabel}
      role="region"
      className={`touch-pan-y py-6 ${pageCount > 1 ? "cursor-grab" : "cursor-default"}`}
      {...(pageCount > 1 ? dragHandlers : {})}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {visibleItems.map((item) => (
          <a key={item.id} href={item.href}>
            <img
              src={item.imagePath}
              alt={`${ariaLabel} image ${item.id}`}
              className="h-60 w-full rounded-[20px] object-cover"
            />
          </a>
        ))}
      </div>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label={`${ariaLabel} previous`}
            onClick={showPrevious}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-brand-dark transition hover:bg-gray-200"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          {Array.from({ length: pageCount }, (_, pageIndex) => (
            <button
              key={pageIndex}
              type="button"
              aria-label={`${ariaLabel} page ${pageIndex + 1}`}
              onClick={() => setPage(pageIndex)}
              className={`h-2.5 w-2.5 rounded-full border-0 transition ${
                pageIndex === page ? "bg-brand-dark" : "bg-gray-300"
              }`}
            />
          ))}
          <button
            type="button"
            aria-label={`${ariaLabel} next`}
            onClick={showNext}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-brand-dark transition hover:bg-gray-200"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
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
  shopByCategories = []
}: {
  sections: HomepageSectionsMap;
  shopByCategories?: StorefrontCategory[];
}) {
  return (
    <div className="container">
      <CarouselSection section={sections.hero_primary} ariaLabel="Homepage hero primary" autoRotate />
      <ShopByCategory categories={shopByCategories} />
      <GridSection section={sections.grid_featured} ariaLabel="Homepage featured grid" />
      <SingleSection section={sections.single_mid} ariaLabel="Homepage single middle" />
      <CarouselSection section={sections.hero_secondary} ariaLabel="Homepage hero secondary" autoRotate />
      <SingleSection section={sections.single_footer} ariaLabel="Homepage single footer" />
    </div>
  );
}
