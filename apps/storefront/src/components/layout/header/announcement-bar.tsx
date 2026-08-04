"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  ANNOUNCEMENT_CROSS_S as CROSS_S,
  ANNOUNCEMENT_REDUCED_HOLD_MS as REDUCED_HOLD_MS
} from "@/constants/ui";

type AnnouncementBarProps = {
  items: string[];
  isAr: boolean;
  pauseLabel: string;
  playLabel: string;
};

export function AnnouncementBar({ items, isAr, pauseLabel, playLabel }: AnnouncementBarProps) {
  const slides = items.length ? items : [""];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Fallback rotation when motion is reduced (the slide's animationEnd never fires).
  useEffect(() => {
    if (!reduced || paused || slides.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), REDUCED_HOLD_MS);
    return () => clearTimeout(t);
  }, [reduced, paused, index, slides.length]);

  const advance = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <div className="mt-4 mb-4 flex items-center gap-2 rounded-lg bg-canvas px-3 py-3 sm:px-4 sm:py-2">
      {/* Fixed-height clip box; the text is absolutely positioned so its
          (whitespace-nowrap) width can never widen the header on small screens. */}
      <div className="relative h-4 min-w-0 flex-1 overflow-hidden sm:h-5">
        {reduced ? (
          <p className="absolute inset-0 truncate font-bold text-center text-md leading-4 tracking-[0.04em] sm:text-sm sm:leading-5">
            {slides[index]}
          </p>
        ) : (
          <p
            key={index}
            onAnimationEnd={advance}
              className="marquee-cross absolute inset-0 flex items-center justify-center whitespace-nowrap text-md font-extrabold tracking-[0.04em] sm:text-md"
            style={{
              "--marquee-duration": `${CROSS_S}s`,
              "--marquee-direction": isAr ? "reverse" : "normal",
              "--marquee-play-state": paused ? "paused" : "running"
            } as CSSProperties}
          >
            {slides[index]}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? playLabel : pauseLabel}
        title={paused ? playLabel : pauseLabel}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-0 bg-transparent text-(--ink-3) transition-colors hover:bg-(--warm-soft) hover:text-ink sm:h-7 sm:w-7"
      >
        {paused ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        )}
      </button>
    </div>
  );
}
