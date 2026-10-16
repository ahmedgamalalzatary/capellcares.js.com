"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { getDict, type Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";

interface Props {
  images: string[];
  href: string;
  label: string;
  lang: Language;
  /** Draws one slide. Called with "" when there are no images so the card's artwork fallback still shows. */
  renderImage: (url: string) => ReactNode;
}

/** Movement (px) before a touch is read as a sideways swipe or a vertical scroll. */
const AXIS_LOCK_DISTANCE = 8;
/** Sideways distance (px) a swipe must travel to change the picture. */
const SWIPE_DISTANCE = 36;

/**
 * The image area every storefront card shares: all of the card's pictures in one strip, stepped
 * with arrows on hover-capable screens and with a finger swipe on touch screens. A tap anywhere
 * on the picture still opens the item; the click that ends a swipe does not.
 */
export function CardImageCarousel({ images, href, label, lang, renderImage }: Props) {
  const slides = images.length ? images : [""];
  const count = slides.length;
  const isRtl = lang === "ar";
  const dict = getDict(lang);
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const swipeConsumedClickRef = useRef(false);
  const slidesKey = slides.join("|");

  // A new set of pictures (another language, a refreshed item) starts again from the main one.
  useEffect(() => {
    setIndex(0);
  }, [slidesKey]);

  const activeIndex = Math.min(index, count - 1);
  const step = (direction: 1 | -1) => setIndex(Math.max(0, Math.min(count - 1, activeIndex + direction)));

  const endDrag = () => {
    dragRef.current = null;
    setDragOffset(0);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    // A new gesture clears the last one's mark; a touch swipe that ends off the card fires no click to clear it.
    swipeConsumedClickRef.current = false;
    // Desktop steps with the arrows; a mouse drag on a link would start the browser's own link drag.
    if (count <= 1 || event.pointerType === "mouse" || !event.isPrimary) return;
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
    if (drag.axis !== "x") return;
    // Past the first or last picture the strip only gives a little, so the end is felt rather than hit.
    const forward = isRtl ? deltaX > 0 : deltaX < 0;
    const atEdge = forward ? activeIndex === count - 1 : activeIndex === 0;
    setDragOffset(atEdge ? deltaX / 3 : deltaX);
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

  // The strip runs in the page's writing direction, so in Arabic later slides sit to the left and it slides the other way.
  const offsetPercent = (isRtl ? 1 : -1) * activeIndex * 100;
  const arrowClass =
    "absolute top-1/2 z-20 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-surface/85 text-ink opacity-0 backdrop-blur-sm transition-[opacity,background] duration-200 hover:bg-(--warm-soft) focus-visible:opacity-100 group-hover/card-media:opacity-100 disabled:invisible pointer-fine:grid";

  return (
    <div
      className="group/card-media absolute inset-0"
      data-testid="card-image-carousel"
      data-active-index={activeIndex}
    >
      <Link
        href={href}
        aria-label={label}
        draggable={false}
        // pan-y: the page still scrolls up and down, while a sideways finger drag stays with the picture instead of the row it sits in.
        className={`absolute inset-0 overflow-hidden ${count > 1 ? "touch-pan-y" : ""}`.trim()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        <div
          className={`flex h-full ${dragOffset ? "" : "transition-transform duration-500 ease-(--ease-out-expo)"}`.trim()}
          style={{ transform: `translateX(calc(${offsetPercent}% + ${dragOffset}px))` }}
        >
          {slides.map((url, slideIndex) => (
            <div
              key={`${url}-${slideIndex}`}
              className="relative grid h-full w-full shrink-0 place-items-center"
              aria-hidden={slideIndex === activeIndex ? undefined : true}
            >
              {renderImage(url)}
            </div>
          ))}
        </div>
      </Link>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={activeIndex === 0}
            aria-label={dict.media.previous}
            className={`${arrowClass} inset-s-2`}
          >
            <Icon.Chevron size={18} className={isRtl ? "" : "rotate-180"} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={activeIndex >= count - 1}
            aria-label={dict.media.next}
            className={`${arrowClass} inset-e-2`}
          >
            <Icon.Chevron size={18} className={isRtl ? "rotate-180" : ""} />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5" aria-hidden="true">
            {slides.map((url, slideIndex) => (
              <span
                key={`dot-${url}-${slideIndex}`}
                className={`size-1.5 rounded-full transition-colors duration-300 ${slideIndex === activeIndex ? "bg-ink" : "bg-ink/25"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
