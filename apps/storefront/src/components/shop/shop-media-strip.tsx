"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Language, ShopMediaSection } from "@capella/shared";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";
import { Icon } from "@/components/ui/icons";

const AUTOPLAY_MS = 5000;

function normalizeShopMediaImageSrc(imagePath: string) {
  return resolveMediaUrl(imagePath);
}

function buildShopMediaHref(
  lang: Language,
  targetType: ShopMediaSection["items"][number]["targetType"],
  targetSlug?: string | null
) {
  switch (targetType) {
    case "shop":
      return `/${lang}/shop`;
    case "new":
      return `/${lang}/new`;
    case "bestsellers":
      return `/${lang}/bestsellers`;
    case "products":
      return `/${lang}/products`;
    case "product":
      return targetSlug ? `/${lang}/products/${targetSlug}` : null;
    case "offers":
      return `/${lang}/offers`;
    case "offer":
      return targetSlug ? `/${lang}/offers/${targetSlug}` : null;
    case "collections":
      return `/${lang}/collections`;
    case "collection":
      return targetSlug ? `/${lang}/collections/${targetSlug}` : null;
    case "category":
      return targetSlug ? `/${lang}/category/${targetSlug}` : null;
    default:
      return null;
  }
}

function Slide({
  href,
  imagePath,
  label,
  index,
  active
}: {
  href: string;
  imagePath: string;
  label: string;
  index: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} ${index + 1}`}
      aria-hidden={!active}
      tabIndex={active ? undefined : -1}
      className="group relative block w-full shrink-0 overflow-hidden border border-(--hairline) bg-(--warm-soft)"
    >
      <div className="relative h-180 overflow-hidden">
        <img
          src={imagePath}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
    </Link>
  );
}

export function ShopMediaStrip({
  lang,
  section,
  label
}: {
  lang: Language;
  section: ShopMediaSection;
  label: string;
}) {
  const items = section.items
    .map((item) => ({
      ...item,
      imagePath: normalizeShopMediaImageSrc(item.imagePath),
      href: buildShopMediaHref(lang, item.targetType, item.targetSlug)
    }))
    .filter((item): item is typeof item & { href: string } => Boolean(item.href));

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = items.length;
  const isRtl = lang === "ar";

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = setTimeout(() => {
      setActiveIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, paused, count]);

  if (section.status !== "active" || count === 0) {
    return null;
  }

  // Single image: render statically, no carousel chrome.
  if (count === 1) {
    const item = items[0];
    return (
      <section className="mb-16">
        <div className="grid grid-cols-1">
          <Slide href={item.href} imagePath={item.imagePath} label={label} index={0} active />
        </div>
      </section>
    );
  }

  const goTo = (index: number) => setActiveIndex(((index % count) + count) % count);
  const prev = () => goTo(activeIndex - 1);
  const next = () => goTo(activeIndex + 1);

  const offset = (isRtl ? 1 : -1) * activeIndex * 100;

  return (
    <section className="mb-16">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
        data-active-index={activeIndex}
        className="relative overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${offset}%)` }}
        >
          {items.map((item, index) => (
            <Slide
              key={item.id}
              href={item.href}
              imagePath={item.imagePath}
              label={label}
              index={index}
              active={index === activeIndex}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          className="absolute top-1/2 inset-s-2 grid size-12 -translate-y-1/2 place-items-center text-canvas drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition hover:scale-110"
        >
          <Icon.Chevron size={40} className={`stroke-2.75 ${isRtl ? "" : "rotate-180"}`} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="absolute top-1/2 inset-e-2 grid size-12 -translate-y-1/2 place-items-center text-canvas drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition hover:scale-110"
        >
          <Icon.Chevron size={40} className={`stroke-2.75 ${isRtl ? "rotate-180" : ""}`} />
        </button>

        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeIndex}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex ? "w-6 bg-accent" : "w-2 bg-surface/70 hover:bg-surface"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
