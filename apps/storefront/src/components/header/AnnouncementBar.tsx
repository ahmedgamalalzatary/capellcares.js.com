"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AnnouncementBarDto } from "@minikoshk/shared";

import { useLocale } from "../i18n/LocaleProvider";

function Sparkle() {
  return <span aria-hidden className="px-1 text-white">✨</span>;
}

/** Two copies is the minimum that can loop; wider viewports need more. */
const MIN_COPIES = 2;

/**
 * Top promo bar: a continuously scrolling marquee of offers on the navy
 * background, matching the Minikoshk storefront announcement strip.
 */
export function AnnouncementBar({ config }: { config: AnnouncementBarDto }) {
  const { lang } = useLocale();
  const messages = useMemo(
    () => config.items.map((item) => item.text[lang]),
    [config.items, lang]
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(MIN_COPIES);

  // Each cycle shifts the track by exactly one copy, so the copies left behind
  // have to cover the viewport on their own — otherwise the strip empties out
  // before it loops. How many that takes depends on the viewport width, the
  // translated copy, and the loaded font, so measure instead of guessing.
  useEffect(() => {
    if (!config.enabled || messages.length === 0) return;
    const viewport = viewportRef.current;
    const copy = copyRef.current;
    if (!viewport || !copy) return;

    const measure = () => {
      const copyWidth = copy.offsetWidth;
      if (!copyWidth) return;
      setCopies(Math.max(MIN_COPIES, Math.ceil(viewport.offsetWidth / copyWidth) + 1));
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [config.enabled, messages]);

  if (!config.enabled || messages.length === 0) {
    return null;
  }

  return (
    <div ref={viewportRef} className="overflow-hidden bg-navy-dark text-white">
      <div
        className="animate-marquee flex w-max whitespace-nowrap py-2 text-xs font-medium tracking-wide"
        // One copy's share of the track. Keeps the scroll speed constant as the
        // copy count changes, since the shift always equals one copy's width.
        style={{ "--marquee-shift": `${100 / copies}%` } as CSSProperties}
      >
        {Array.from({ length: copies }, (_, copyIndex) => (
          <div
            key={copyIndex}
            ref={copyIndex === 0 ? copyRef : undefined}
            className="flex shrink-0"
          >
            {messages.map((msg, i) => (
              <span key={i} className="flex items-center px-8">
                {msg}
                <Sparkle />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
