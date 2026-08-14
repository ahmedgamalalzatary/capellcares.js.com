"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  getDict,
  resolveLocalizedEntityMediaUrl,
  type EntityMedia,
  type Language
} from "@capella/shared";
import { Icon } from "@/components/ui/icons";

import { loadInstagramEmbedScript, resolveAdviceVideo, type AdviceVideoPresentation } from "@/lib/advice-video";

interface Props {
  media?: EntityMedia[];
  lang?: Language;
  imagePath?: string | null;
  /**
   * Optional YouTube/Instagram link. It joins the gallery as the last item, so
   * the uploaded photos still lead and nothing plays until it is selected.
   */
  videoUrl?: string | null;
  label: string;
  testIdPrefix: "product" | "offer" | "collection";
  dotLabelTemplate?: string;
  thumbnailLabelTemplate?: string;
  renderImage: (url: string) => ReactNode;
  overlay?: ReactNode;
}

/** Uploaded files and a linked video share one strip, so they share one shape. */
type GalleryItem =
  | { kind: "file"; type: "image" | "video"; url: string }
  | { kind: "embed"; video: AdviceVideoPresentation };

function itemKey(item: GalleryItem, index: number) {
  return item.kind === "embed"
    ? `embed-${item.video.permalinkUrl}-${index}`
    : `${item.type}-${item.url}-${index}`;
}

export function EntityMediaGallery({
  media: incomingMedia,
  lang = "en",
  imagePath,
  videoUrl,
  label,
  testIdPrefix,
  dotLabelTemplate = "go to media {index}",
  thumbnailLabelTemplate = "select media {index}",
  renderImage,
  overlay
}: Props) {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerTargetRef = useRef<HTMLElement | null>(null);
  // Only the pointer that began the swipe may finish it — a second finger
  // lifting must not consume, or cancel, someone else's gesture.
  const dragPointerIdRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);

  // A link we cannot turn into a player contributes no item at all, rather than
  // a thumbnail that opens nothing.
  const linkedVideo = useMemo(
    () => (videoUrl?.trim() ? resolveAdviceVideo(videoUrl) : null),
    [videoUrl]
  );

  const items = useMemo<GalleryItem[]>(() => {
    const files: GalleryItem[] = incomingMedia?.length
      ? incomingMedia.map((item) => ({
        kind: "file" as const,
        type: item.type,
        url: resolveLocalizedEntityMediaUrl(item, lang)
      }))
      : imagePath
        ? [{ kind: "file", type: "image", url: imagePath }]
        : [];

    return linkedVideo ? [...files, { kind: "embed", video: linkedVideo }] : files;
  }, [incomingMedia, imagePath, lang, linkedVideo]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items[activeIndex] ?? items[0] ?? null;
  activeIndexRef.current = activeIndex;

  // Swipes must not fight a player the shopper is scrubbing or an embed that
  // owns its own pointer handling.
  const isPlayerTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("video, iframe, blockquote"));

  useEffect(() => {
    setActiveIndex(0);
  }, [incomingMedia, imagePath, lang, videoUrl]);

  useEffect(() => {
    const active = items[activeIndex];
    if (active?.kind === "embed" && active.video.provider === "instagram") {
      loadInstagramEmbedScript();
    }
  }, [items, activeIndex]);

  const clearPointer = (pointerId: number) => {
    dragStartRef.current = null;
    dragPointerIdRef.current = null;
    const target = activePointerTargetRef.current;
    activePointerTargetRef.current = null;
    if (target && "hasPointerCapture" in target && target.hasPointerCapture(pointerId) && "releasePointerCapture" in target) {
      target.releasePointerCapture(pointerId);
    }
  };

  /** True only for the pointer that started the current swipe. */
  const isSwipePointer = (event: Pick<globalThis.PointerEvent, "pointerId" | "target">) =>
    dragStartRef.current !== null &&
    dragPointerIdRef.current === event.pointerId &&
    !isPlayerTarget(event.target);

  const completeSwipe = ({ clientX, clientY, isPrimary, pointerId }: Pick<globalThis.PointerEvent, "clientX" | "clientY" | "isPrimary" | "pointerId">) => {
    const dragStart = dragStartRef.current;
    clearPointer(pointerId);
    if (items.length <= 1 || !isPrimary || !dragStart) return;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(items.length - 1, activeIndexRef.current + direction));
    if (nextIndex !== activeIndexRef.current) setActiveIndex(nextIndex);
  };

  useEffect(() => {
    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (isSwipePointer(event)) completeSwipe(event);
    };
    const handlePointerCancel = (event: globalThis.PointerEvent) => {
      if (isSwipePointer(event)) clearPointer(event.pointerId);
    };
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [items.length]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (items.length <= 1 || !event.isPrimary || isPlayerTarget(event.target)) return;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragPointerIdRef.current = event.pointerId;
    activePointerTargetRef.current = event.currentTarget;
    if ("setPointerCapture" in event.currentTarget) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const renderEmbed = (video: AdviceVideoPresentation) =>
    video.provider === "youtube" ? (
      <iframe
        title={`${label} video`}
        src={video.embedUrl}
        className="aspect-video w-full"
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
      />
    ) : (
      <div className="flex w-full items-center justify-center p-4">
        <blockquote
          className="instagram-media m-0 w-full"
          data-instgrm-captioned=""
          data-instgrm-permalink={video.permalinkUrl}
          data-instgrm-version="14"
        >
          <a href={video.permalinkUrl} target="_blank" rel="noreferrer">
            {label}
          </a>
        </blockquote>
      </div>
    );

  const renderEmbedThumbnail = (video: AdviceVideoPresentation, index: number) =>
    video.provider === "youtube" ? (
      <img
        src={video.thumbnailUrl}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
    ) : (
      // Instagram exposes no thumbnail without an API call, so the tile just
      // reads as "a video lives here".
      <span
        className="grid aspect-square w-full place-items-center bg-ink text-canvas"
        aria-label={`${label} video ${index + 1}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    );

  const thumbnailItems: GalleryItem[] = items.length
    ? items
    : [{ kind: "file", type: "image", url: imagePath ?? "" }];

  return (
    <>
      <div className="relative">
        <div
          className="relative grid place-items-center overflow-hidden rounded-md sm:rounded-md lg:place-items-start"
          data-testid={`${testIdPrefix}-media-main`}
          onPointerDown={onPointerDown}
          onPointerUp={(event) => {
            if (isSwipePointer(event.nativeEvent)) completeSwipe(event.nativeEvent);
          }}
          onPointerCancel={(event) => {
            if (isSwipePointer(event.nativeEvent)) clearPointer(event.pointerId);
          }}
        >
          {activeItem?.kind === "embed"
            ? renderEmbed(activeItem.video)
            : activeItem?.type === "video" ? (
              <video className="h-4/5 w-4/5" controls src={activeItem.url} aria-label={label}>
                <track kind="captions" />
              </video>
            ) : renderImage(activeItem?.url ?? imagePath ?? "")}
        </div>
        {overlay}
      </div>

      {items.length > 1 ? (
        <div className="flex items-center justify-center gap-2" data-testid={`${testIdPrefix}-media-dots`}>
          {items.map((item, index) => (
            <button
              key={`dot-${itemKey(item, index)}`}
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
        {thumbnailItems.map((item, index) => (
          <button
            key={itemKey(item, index)}
            type="button"
            className="bg-surface transition-transform hover:border-warm data-[active=true]:scale-105"
            data-active={activeIndex === index}
            aria-label={thumbnailLabelTemplate.replace("{index}", String(index + 1))}
            onClick={() => setActiveIndex(index)}
          >
            {item.kind === "embed" ? (
              renderEmbedThumbnail(item.video, index)
            ) : item.type === "video" ? (
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
