"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type TransitionEvent
} from "react";
import Link from "next/link";
import type { Language, ShopMediaSection } from "@capella/shared";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";
import { Icon } from "@/components/ui/icons";

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD_PX = 50;

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

function pickSlidesForViewport(
  section: ShopMediaSection,
  lang: Language,
  viewport: "desktop" | "mobile"
) {
  return section.items
    .map((item) => {
      const imagePath = viewport === "desktop" ? item.imagePath : item.mobileImagePath;
      if (!imagePath) {
        return null;
      }

      const href = buildShopMediaHref(lang, item.targetType, item.targetSlug);
      if (!href) {
        return null;
      }

      return {
        id: item.id,
        href,
        imagePath: normalizeShopMediaImageSrc(imagePath)
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}

function Slide({
  href,
  imagePath,
  label,
  index,
  active,
  onClickCapture
}: {
  href: string;
  imagePath: string;
  label: string;
  index: number;
  active: boolean;
  onClickCapture?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      data-slide
      aria-label={`${label} ${index + 1}`}
      aria-hidden={!active}
      tabIndex={active ? undefined : -1}
      onClickCapture={onClickCapture}
      draggable={false}
      className="group relative block w-full shrink-0 overflow-hidden"
    >
      <div className="relative overflow-hidden">
        <img
          src={imagePath}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-bottom transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
    </Link>
  );
}

function ShopMediaViewportStrip({
  lang,
  section,
  label,
  viewport,
  className,
  flatTop = false
}: {
  lang: Language;
  section: ShopMediaSection;
  label: string;
  viewport: "desktop" | "mobile";
  className: string;
  flatTop?: boolean;
}) {
  const items = pickSlidesForViewport(section, lang, viewport);
  const roundedClass = flatTop ? "rounded-b-lg" : "rounded-lg";
  const [pos, setPos] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragDeltaX = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const count = items.length;
  const isRtl = lang === "ar";
  const activeIndex = count > 0 ? ((pos % count) + count) % count : 0;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = setTimeout(() => {
      setPos((current) => current + 1);
    }, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [pos, paused, count]);

  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  if (count === 0) {
    return null;
  }

  if (count === 1) {
    const item = items[0];
    return (
      <section className={className} data-viewport={viewport}>
        <div className={`grid grid-cols-1 overflow-hidden ${roundedClass}`}>
          <Slide href={item.href} imagePath={item.imagePath} label={label} index={0} active />
        </div>
      </section>
    );
  }

  const goTo = (index: number) => setPos(index);
  const prev = () => setPos((current) => current - 1);
  const next = () => setPos((current) => current + 1);
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activePointerId.current = event.pointerId;
    dragStartX.current = event.clientX;
    dragDeltaX.current = 0;
    suppressClick.current = false;
    setDragOffsetX(0);
    setDragging(true);
    setPaused(true);
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || event.pointerId !== activePointerId.current) return;
    dragDeltaX.current = event.clientX - dragStartX.current;
    if (Math.abs(dragDeltaX.current) > SWIPE_THRESHOLD_PX) {
      suppressClick.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setDragOffsetX(dragDeltaX.current);
  };
  const endDrag = (commit: boolean) => {
    const deltaX = dragDeltaX.current;
    dragStartX.current = 0;
    dragDeltaX.current = 0;
    activePointerId.current = null;
    setDragOffsetX(0);
    setDragging(false);
    setPaused(false);

    if (!commit || Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    const direction = deltaX < 0 ? 1 : -1;
    setPos((current) => current + (isRtl ? -direction : direction));
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointerId.current) return;
    endDrag(true);
  };
  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointerId.current) return;
    endDrag(false);
  };
  const handleSlideClickCapture = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const slides = [items[count - 1], ...items, items[0]];
  const renderedActive = pos + 1;
  const offset = (isRtl ? 1 : -1) * (pos + 1) * 100;
  const trackTransform =
    dragging && dragOffsetX !== 0 ? `translateX(calc(${offset}% + ${dragOffsetX}px))` : `translateX(${offset}%)`;

  const handleTrackTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (pos >= count) {
      setAnimate(false);
      setPos(0);
    } else if (pos < 0) {
      setAnimate(false);
      setPos(count - 1);
    }
  };

  return (
    <section className={className} data-viewport={viewport}>
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
        data-active-index={activeIndex}
        className={`relative touch-pan-y select-none overflow-hidden ${roundedClass} ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          data-slide-track
          className={`flex ${animate && !dragging ? "transition-transform duration-500 ease-out" : ""}`}
          style={{ transform: trackTransform }}
          onTransitionEnd={handleTrackTransitionEnd}
        >
          {slides.map((item, renderedIndex) => {
            const logicalIndex = ((renderedIndex - 1) % count + count) % count;
            return (
              <Slide
                key={`${item.id}-${renderedIndex}`}
                href={item.href}
                imagePath={item.imagePath}
                label={label}
                index={logicalIndex}
                active={renderedIndex === renderedActive}
                onClickCapture={handleSlideClickCapture}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          className="absolute top-1/2 inset-s-2 hidden size-12 -translate-y-1/2 place-items-center text-ink drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)] transition hover:scale-120 lg:grid"
        >
          <Icon.Chevron size={40} className={` stroke-1 ${isRtl ? "" : "rotate-180"}`} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="absolute top-1/2 inset-e-2 hidden size-12 -translate-y-1/2 place-items-center text-ink drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)] transition hover:scale-120 lg:grid"
        >
          <Icon.Chevron size={40} className={`stroke-1 ${isRtl ? "rotate-180" : ""}`} />
        </button>

        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeIndex}
              className={`size-2.5 rounded-full border border-accent transition-colors duration-300 ${
                index === activeIndex ? "bg-accent" : "bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ShopMediaStrip({
  lang,
  section,
  label,
  flatTop = false
}: {
  lang: Language;
  section: ShopMediaSection;
  label: string;
  flatTop?: boolean;
}) {
  if (section.status !== "active") {
    return null;
  }

  return (
    <>
      <ShopMediaViewportStrip
        lang={lang}
        section={section}
        label={label}
        viewport="desktop"
        className="mb-12 hidden sm:block"
        flatTop={flatTop}
      />
      <ShopMediaViewportStrip
        lang={lang}
        section={section}
        label={label}
        viewport="mobile"
        className="mb-12 sm:hidden"
        flatTop={flatTop}
      />
    </>
  );
}
