"use client";

import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "../icons";

/**
 * Shared pager: previous arrow, a dot per position, and a next arrow, centered
 * in a row under the media. Used by the hero carousel, the grid slider, and the
 * new-arrivals slider so their controls look and behave identically.
 */
export function PagerControls({
  ariaLabel,
  count,
  index,
  dotNoun,
  onPrevious,
  onNext,
  onSelect
}: {
  ariaLabel: string;
  count: number;
  index: number;
  dotNoun: string;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
}) {
  if (count <= 1) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <button
        type="button"
        aria-label={`${ariaLabel} previous`}
        onClick={onPrevious}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-brand-dark transition hover:bg-gray-200"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      {Array.from({ length: count }, (_, dotIndex) => (
        <button
          key={dotIndex}
          type="button"
          aria-label={`${ariaLabel} ${dotNoun} ${dotIndex + 1}`}
          onClick={() => onSelect(dotIndex)}
          className={`h-2.5 rounded-full border-0 transition-all duration-300 ${
            dotIndex === index ? "w-6 bg-brand-dark" : "w-2.5 bg-gray-300 hover:bg-gray-400"
          }`}
        />
      ))}
      <button
        type="button"
        aria-label={`${ariaLabel} next`}
        onClick={onNext}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-brand-dark transition hover:bg-gray-200"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}

/**
 * Number of cards that fit the viewport, derived from its measured width so
 * sliders never overlap on small screens. Falls back to `fallback` before
 * measurement (e.g. SSR / tests).
 */
export function useVisibleCount(
  ref: RefObject<HTMLElement | null>,
  { minCardWidth = 220, maxVisible = 4, fallback = 4 } = {}
) {
  const [count, setCount] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const update = () => {
      const width = el.clientWidth;
      if (!width) {
        return;
      }
      setCount(Math.max(1, Math.min(maxVisible, Math.floor(width / minCardWidth))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, minCardWidth, maxVisible]);

  return count;
}
