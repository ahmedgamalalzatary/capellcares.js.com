"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { EntityMedia } from "@capella/shared";

interface Props {
  media?: EntityMedia[];
  imagePath?: string | null;
  label: string;
  testIdPrefix: "product" | "offer" | "collection";
  dotLabelTemplate?: string;
  thumbnailLabelTemplate?: string;
  renderImage: (url: string) => ReactNode;
  overlay?: ReactNode;
}

export function EntityMediaGallery({
  media: incomingMedia,
  imagePath,
  label,
  testIdPrefix,
  dotLabelTemplate = "go to media {index}",
  thumbnailLabelTemplate = "select media {index}",
  renderImage,
  overlay
}: Props) {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerTargetRef = useRef<HTMLElement | null>(null);
  const activeIndexRef = useRef(0);
  const media = useMemo(
    () => incomingMedia?.length
      ? incomingMedia
      : imagePath
        ? [{ type: "image" as const, url: imagePath }]
        : [],
    [incomingMedia, imagePath]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const activeMedia = media[activeIndex] ?? media[0] ?? null;
  activeIndexRef.current = activeIndex;
  const isVideoTarget = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("video"));

  useEffect(() => {
    setActiveIndex(0);
  }, [incomingMedia, imagePath]);

  const clearPointer = (pointerId: number) => {
    dragStartRef.current = null;
    const target = activePointerTargetRef.current;
    activePointerTargetRef.current = null;
    if (target && "hasPointerCapture" in target && target.hasPointerCapture(pointerId) && "releasePointerCapture" in target) {
      target.releasePointerCapture(pointerId);
    }
  };

  const completeSwipe = ({ clientX, clientY, isPrimary, pointerId }: Pick<globalThis.PointerEvent, "clientX" | "clientY" | "isPrimary" | "pointerId">) => {
    const dragStart = dragStartRef.current;
    clearPointer(pointerId);
    if (media.length <= 1 || !isPrimary || !dragStart) return;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(media.length - 1, activeIndexRef.current + direction));
    if (nextIndex !== activeIndexRef.current) setActiveIndex(nextIndex);
  };

  useEffect(() => {
    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (dragStartRef.current && !isVideoTarget(event.target)) completeSwipe(event);
    };
    const handlePointerCancel = (event: globalThis.PointerEvent) => {
      if (dragStartRef.current && !isVideoTarget(event.target)) clearPointer(event.pointerId);
    };
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [media.length]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (media.length <= 1 || !event.isPrimary || isVideoTarget(event.target)) return;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    activePointerTargetRef.current = event.currentTarget;
    if ("setPointerCapture" in event.currentTarget) event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <>
      <div className="relative">
        <div
          className="relative grid place-items-center overflow-hidden rounded-md sm:rounded-md lg:place-items-start"
          data-testid={`${testIdPrefix}-media-main`}
          onPointerDown={onPointerDown}
          onPointerUp={(event) => {
            if (!isVideoTarget(event.target)) completeSwipe(event.nativeEvent);
          }}
          onPointerCancel={(event) => {
            if (!isVideoTarget(event.target)) clearPointer(event.pointerId);
          }}
        >
          {activeMedia?.type === "video" ? (
            <video className="h-4/5 w-4/5" controls src={activeMedia.url} aria-label={label}>
              <track kind="captions" />
            </video>
          ) : renderImage(activeMedia?.url ?? imagePath ?? "")}
        </div>
        {overlay}
      </div>

      {media.length > 1 ? (
        <div className="flex items-center justify-center gap-2" data-testid={`${testIdPrefix}-media-dots`}>
          {media.map((item, index) => (
            <button
              key={`dot-${item.type}-${item.url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={dotLabelTemplate.replace("{index}", String(index + 1))}
              aria-current={activeIndex === index}
              className={`size-2.5 rounded-full border border-accent transition-colors duration-300 ${activeIndex === index ? "bg-accent" : "bg-transparent"}`}
            />
          ))}
        </div>
      ) : null}

      <div
        className="grid grid-cols-4 gap-4 sm:gap-4"
        data-testid={`${testIdPrefix}-media-thumbs`}
      >
        {(media.length ? media : [{ type: "image" as const, url: imagePath ?? "" }]).map((item, index) => (
          <button
            key={`${item.type}-${item.url}-${index}`}
            type="button"
            className="bg-surface transition-transform hover:border-warm data-[active=true]:scale-105"
            data-active={activeIndex === index}
            aria-label={thumbnailLabelTemplate.replace("{index}", String(index + 1))}
            onClick={() => setActiveIndex(index)}
          >
            {item.type === "video" ? (
              <video src={item.url} aria-label={`${label} video ${index + 1}`}>
                <track kind="captions" />
              </video>
            ) : renderImage(item.url)}
          </button>
        ))}
      </div>
    </>
  );
}
