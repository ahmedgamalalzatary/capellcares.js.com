"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type TransitionEvent
} from "react";
import Image from "next/image";
import Link from "next/link";
import type { Language, ShopMediaSection } from "@capella/shared";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";
import { Icon } from "@/components/ui/icons";
import {
  SHOP_MEDIA_AUTOPLAY_MS as AUTOPLAY_MS,
  SHOP_MEDIA_SWIPE_THRESHOLD_PX as SWIPE_THRESHOLD_PX,
  SHOP_MEDIA_DESKTOP_MEDIA_QUERY as DESKTOP_MEDIA_QUERY
} from "@/constants/ui";

function normalizeShopMediaImageSrc(imagePath: string) {
  return resolveMediaUrl(imagePath);
}

/**
 * A banner whose target was deleted has no slug to link to. Rather than dropping the
 * banner (which made it vanish from the storefront) or linking to a dead page, every
 * unresolvable target falls back to the home page.
 */
function buildShopMediaHref(
  lang: Language,
  targetType: ShopMediaSection["items"][number]["targetType"],
  targetSlug?: string | null,
  targetId?: number | null
): string {
  const home = `/${lang}`;

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
      return targetSlug ? `/${lang}/products/${targetSlug}` : home;
    case "offers":
      return `/${lang}/offers`;
    case "offer":
      return targetSlug ? `/${lang}/offers/${targetSlug}` : home;
    case "collections":
      return `/${lang}/collections`;
    case "collection":
      return targetSlug ? `/${lang}/collections/${targetSlug}` : home;
    case "category":
      return targetSlug
        ? `/${lang}/category/${targetSlug}${targetId == null ? "" : `?categoryId=${targetId}`}`
        : home;
    default:
      return home;
  }
}

function pickSlidesForViewport(
  section: ShopMediaSection,
  lang: Language,
  viewport: "desktop" | "mobile"
) {
  return section.items
    .map((item) => {
      const requestedImagePath = lang === "ar"
        ? (viewport === "desktop" ? item.arImagePath : item.arMobileImagePath)
        : (viewport === "desktop" ? item.enImagePath : item.enMobileImagePath);
      const fallbackImagePath = lang === "ar"
        ? (viewport === "desktop" ? item.enImagePath : item.enMobileImagePath)
        : (viewport === "desktop" ? item.arImagePath : item.arMobileImagePath);
      const imagePath = requestedImagePath || fallbackImagePath;
      if (!imagePath) {
        return null;
      }

      return {
        id: item.id,
        href: buildShopMediaHref(lang, item.targetType, item.targetSlug, item.targetId),
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
        <Image
          src={imagePath}
          alt=""
          width={1600}
          height={900}
          sizes="100vw"
          className="h-full w-full object-cover object-bottom transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
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
  const trackOffset =
    dragging && dragOffsetX !== 0 ? `calc(${offset}% + ${dragOffsetX}px)` : `${offset}%`;

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
          className={`flex [transform:translateX(var(--track-x))] ${animate && !dragging ? "transition-transform duration-500 ease-out" : ""}`}
          // Track offset follows the active slide and the live drag distance.
          style={{ "--track-x": trackOffset } as CSSProperties}
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
          <Icon.Chevron size={40} className={isRtl ? "" : "rotate-180"} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="absolute top-1/2 inset-e-2 hidden size-12 -translate-y-1/2 place-items-center text-ink drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)] transition hover:scale-120 lg:grid"
        >
          <Icon.Chevron size={40} className={isRtl ? "rotate-180" : ""} />
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

  const desktopItems = pickSlidesForViewport(section, lang, "desktop");
  const mobileItems = pickSlidesForViewport(section, lang, "mobile");
  const [prefersDesktop, setPrefersDesktop] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const applyPreference = () => setPrefersDesktop(mediaQuery.matches);

    applyPreference();
    mediaQuery.addEventListener?.("change", applyPreference);

    return () => {
      mediaQuery.removeEventListener?.("change", applyPreference);
    };
  }, []);

  const viewport = prefersDesktop
    ? (desktopItems.length > 0 ? "desktop" : mobileItems.length > 0 ? "mobile" : null)
    : (mobileItems.length > 0 ? "mobile" : desktopItems.length > 0 ? "desktop" : null);

  if (!viewport) {
    return null;
  }

  return (
    <ShopMediaViewportStrip
      lang={lang}
      section={section}
      label={label}
      viewport={viewport}
      className="mb-12"
      flatTop={flatTop}
    />
  );
}
