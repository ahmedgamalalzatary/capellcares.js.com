"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { Language } from "@capella/shared";
import { CARD_SLIDER_MEDIA_QUERY } from "@/constants/ui";
import { useMediaQuery } from "@/hooks/use-media-query";

interface Props {
  /** The main image, then the rest of the gallery. */
  images: string[];
  /** The ERP hover image; only desktop shows it. */
  hoverImage?: string | null;
  href: string;
  label: string;
  lang: Language;
  /** Draws one picture. Called with "" when there are no images so the card's artwork fallback still shows. */
  renderImage: (url: string) => ReactNode;
}

/** Movement (px) before a touch is read as a sideways swipe or a vertical scroll. */
const AXIS_LOCK_DISTANCE = 8;
/** Sideways distance (px) a swipe must travel to change the picture. */
const SWIPE_DISTANCE = 36;

/**
 * The image area every storefront card shares. On touch and small screens it is a strip the
 * finger swipes through, going round endlessly; elsewhere it shows the main image, swaps to the
 * hover image while the pointer is over it and zooms in. A tap or click anywhere on it opens the item.
 */
export function CardImageCarousel({ hoverImage, ...props }: Props) {
  const slides = useMediaQuery(CARD_SLIDER_MEDIA_QUERY);
  return slides ? <SwipeSlides {...props} /> : <HoverImage {...props} hoverImage={hoverImage} />;
}

function HoverImage({ images, hoverImage, href, label, renderImage }: Omit<Props, "lang">) {
  const primary = images[0] ?? "";
  const [shown, setShown] = useState(primary);

  // Another language or a refreshed item brings a new main image.
  useEffect(() => {
    setShown(primary);
  }, [primary]);

  return (
    <div className="absolute inset-0" data-testid="card-image-carousel" data-active-index={0}>
      <Link
        href={href}
        aria-label={label}
        className="absolute inset-0 grid place-items-center overflow-hidden"
        onMouseEnter={() => setShown(hoverImage || primary)}
        onMouseLeave={() => setShown(primary)}
      >
        <div className="relative grid h-full w-full place-items-center transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-[1.05]">
          {renderImage(shown)}
        </div>
      </Link>
    </div>
  );
}

function SwipeSlides({ images, href, label, lang, renderImage }: Omit<Props, "hoverImage">) {
  const slides = images.length ? images : [""];
  const count = slides.length;
  const loops = count > 1;
  // A copy of the last picture sits before the first and a copy of the first after the last: a
  // swipe past either end slides into the copy, then jumps unseen to the real picture, so the
  // pictures go round forever.
  const track = loops ? [slides[count - 1]!, ...slides, slides[0]!] : slides;
  const firstSlot = loops ? 1 : 0;
  const isRtl = lang === "ar";
  const [slot, setSlot] = useState(firstSlot);
  const [animate, setAnimate] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const swipeConsumedClickRef = useRef(false);
  const slidesKey = slides.join("|");

  // A new set of pictures (another language, a refreshed item) starts again from the main one.
  useEffect(() => {
    setAnimate(false);
    setSlot(firstSlot);
  }, [slidesKey, firstSlot]);

  const activeIndex = loops ? (slot - 1 + count) % count : 0;
  // The real picture a copy stands for.
  const realSlot = (at: number) => (at === 0 ? count : at === count + 1 ? 1 : at);

  // Moves without the slide animation, and lets the browser settle there before anything animates from it.
  const jumpTo = (at: number) => {
    flushSync(() => {
      setAnimate(false);
      setSlot(at);
    });
    void trackRef.current?.offsetWidth;
  };

  const settleOnRealSlot = () => {
    if (realSlot(slot) !== slot) jumpTo(realSlot(slot));
  };

  const step = (direction: 1 | -1) => {
    const from = realSlot(slot);
    if (from !== slot) jumpTo(from);
    setAnimate(true);
    setSlot(from + direction);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragOffset(0);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    // A new gesture clears the last one's mark; a touch swipe that ends off the card fires no click to clear it.
    swipeConsumedClickRef.current = false;
    // A mouse drag on a link would start the browser's own link drag.
    if (!loops || event.pointerType === "mouse" || !event.isPrimary) return;
    // A swipe started before the last one finished going round begins from the real picture, not its copy.
    settleOnRealSlot();
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (!drag.axis) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < AXIS_LOCK_DISTANCE) return;
      drag.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      if (drag.axis === "x") event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (drag.axis === "x") setDragOffset(deltaX);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    if (drag.axis === "x") {
      swipeConsumedClickRef.current = true;
      if (Math.abs(deltaX) >= SWIPE_DISTANCE) {
        // "Next" follows the reading direction: leftwards in English, rightwards in Arabic.
        const forward = isRtl ? deltaX > 0 : deltaX < 0;
        step(forward ? 1 : -1);
      }
    }
    endDrag();
  };

  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) endDrag();
  };

  const onClickCapture = (event: React.MouseEvent) => {
    if (!swipeConsumedClickRef.current) return;
    swipeConsumedClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) settleOnRealSlot();
  };

  // The strip runs in the page's writing direction, so in Arabic later slides sit to the left and it slides the other way.
  const offsetPercent = (isRtl ? 1 : -1) * slot * 100;

  return (
    <div className="absolute inset-0" data-testid="card-image-carousel" data-active-index={activeIndex}>
      <Link
        href={href}
        aria-label={label}
        draggable={false}
        // pan-y: the page still scrolls up and down, while a sideways finger drag stays with the picture instead of the row it sits in.
        className={`absolute inset-0 overflow-hidden ${loops ? "touch-pan-y" : ""}`.trim()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        <div
          ref={trackRef}
          className={`flex h-full ${animate && !dragOffset ? "transition-transform duration-500 ease-(--ease-out-expo)" : ""}`.trim()}
          style={{ transform: `translateX(calc(${offsetPercent}% + ${dragOffset}px))` }}
          onTransitionEnd={onTransitionEnd}
        >
          {track.map((url, trackIndex) => (
            <div
              key={`${url}-${trackIndex}`}
              className="relative grid h-full w-full shrink-0 place-items-center"
              aria-hidden={trackIndex === slot ? undefined : true}
            >
              {renderImage(url)}
            </div>
          ))}
        </div>
      </Link>

      {loops ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5" aria-hidden="true">
          {slides.map((url, slideIndex) => (
            <span
              key={`dot-${url}-${slideIndex}`}
              className={`size-1.5 rounded-full transition-colors duration-300 ${slideIndex === activeIndex ? "bg-ink" : "bg-ink/25"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
