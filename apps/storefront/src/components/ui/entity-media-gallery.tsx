"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  // A swipe ends with a click on the media. That click must not be read as a
  // request to open the lightbox, so the gesture marks it as already spent.
  const swipeConsumedClickRef = useRef(false);

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

  const dict = getDict(lang);
  const isRtl = lang === "ar";
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

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

  // lightboxOpen is a dependency because opening mounts a second copy of the
  // embed in the portal, which needs its own processing pass to become a player.
  useEffect(() => {
    const active = items[activeIndex];
    if (active?.kind === "embed" && active.video.provider === "instagram") {
      loadInstagramEmbedScript();
    }
  }, [items, activeIndex, lightboxOpen]);

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
    swipeConsumedClickRef.current = true;
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
    // A new gesture clears the last one's mark. Relying on a click to clear it
    // strands the flag: a touch swipe releases outside the box and fires none,
    // so the next genuine tap would be swallowed.
    swipeConsumedClickRef.current = false;
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

  const step = (direction: 1 | -1) => {
    setActiveIndex((current) => Math.max(0, Math.min(items.length - 1, current + direction)));
  };

  /**
   * A tap or click on the picture opens the lightbox — but a player owns its own
   * clicks, and the click that ends a swipe must not count as one.
   */
  const openFromMedia = (event: React.MouseEvent) => {
    const swiped = swipeConsumedClickRef.current;
    swipeConsumedClickRef.current = false;
    if (swiped || items.length === 0 || isPlayerTarget(event.target)) return;
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    openButtonRef.current?.focus();
  };

  // While the lightbox is up the page behind must not scroll. <html> is the
  // scrolling element — locking <body> alone is ignored on mobile.
  useEffect(() => {
    if (!lightboxOpen) return;
    const html = document.documentElement;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    const previousOverflow = html.style.overflow;
    const previousPaddingRight = html.style.paddingRight;
    const previousBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    if (scrollbarWidth > 0) html.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousOverflow;
      html.style.paddingRight = previousPaddingRight;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    closeButtonRef.current?.focus();
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }
      // A focused player owns its arrow keys — they scrub the clip, and stepping
      // the gallery too would pull it out from under the shopper mid-seek.
      if (isPlayerTarget(event.target)) return;
      // "Forward" follows the writing direction, so the arrows always move the
      // way the strip reads.
      if (event.key === "ArrowRight") step(isRtl ? -1 : 1);
      if (event.key === "ArrowLeft") step(isRtl ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, isRtl, items.length]);

  /**
   * A dialog that claims aria-modal must not let Tab walk out into the page it
   * covers, so focus cycles within it. Same approach the advice dialog uses.
   */
  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])") ?? []
    );
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const renderItem = (item: GalleryItem | null, fallbackUrl: string) =>
    item?.kind === "embed"
      ? renderEmbed(item.video)
      : item?.type === "video" ? (
        <video className="h-4/5 w-4/5" controls src={item.url} aria-label={label}>
          <track kind="captions" />
        </video>
      ) : renderImage(item?.url ?? fallbackUrl);

  const thumbnailItems: GalleryItem[] = items.length
    ? items
    : [{ kind: "file", type: "image", url: imagePath ?? "" }];

  return (
    <>
      <div className="group/media relative">
        <div
          className={[
            "relative grid place-items-center overflow-hidden rounded-md sm:rounded-md lg:place-items-start",
            // The picture is the trigger: a plus cursor announces it to anyone
            // with a hover-capable pointer, and a tap opens it on touch.
            items.length > 0 ? "cursor-plus" : ""
          ].join(" ").trim()}
          data-testid={`${testIdPrefix}-media-main`}
          onClick={openFromMedia}
          onPointerDown={onPointerDown}
          onPointerUp={(event) => {
            if (isSwipePointer(event.nativeEvent)) completeSwipe(event.nativeEvent);
          }}
          onPointerCancel={(event) => {
            if (isSwipePointer(event.nativeEvent)) clearPointer(event.pointerId);
          }}
        >
          {renderItem(activeItem, imagePath ?? "")}
        </div>
        {items.length > 0 ? (
          // Clicking a picture is invisible to the keyboard and to screen
          // readers, so the same action also exists as a real control. It stays
          // out of the layout until focused.
          <button
            ref={openButtonRef}
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={dict.media.open}
            className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:bottom-2 focus-visible:inset-e-2 focus-visible:z-10 focus-visible:grid focus-visible:size-9 focus-visible:place-items-center focus-visible:rounded-full focus-visible:bg-surface focus-visible:text-ink"
          >
            <Icon.Plus size={18} />
          </button>
        ) : null}
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

      {/* Portalled to <body>: rendered in place, an ancestor stacking context on
          the detail page painted the price, share button and tabs over it. */}
      {lightboxOpen && typeof document !== "undefined" ? createPortal(
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onKeyDown={onDialogKeyDown}
          // Portalled to <body>, it sits outside the locale subtree that carries
          // dir/lang, so it states its own. Without this every logical property
          // inside (inset-s/inset-e, text alignment) resolves against <html dir>
          // and the layout comes out mirrored — which is what flipped the arrows.
          dir={isRtl ? "rtl" : "ltr"}
          lang={lang}
          data-testid={`${testIdPrefix}-lightbox`}
          className="fixed inset-0 z-[120] flex flex-col bg-canvas"
        >
          <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <h2 className={`m-0 truncate text-ink ${isRtl
              ? "text-base font-bold font-(family-name:--font-ar) sm:text-lg"
              : "text-base font-semibold sm:text-lg"}`}>
              {label}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeLightbox}
              aria-label={dict.media.close}
              className="grid size-10 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-(--warm-soft)"
            >
              <Icon.Close size={20} />
            </button>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            <button
              type="button"
              // Index steps are direction-agnostic: "previous" is always the
              // previous picture. Only the button's side and its chevron mirror.
              onClick={() => step(-1)}
              disabled={activeIndex === 0}
              aria-label={dict.media.previous}
              className="absolute inset-s-1 z-10 grid size-10 place-items-center rounded-full border border-(--hairline) bg-canvas text-ink transition hover:bg-(--warm-soft) disabled:pointer-events-none disabled:opacity-30 sm:size-12"
            >
              <Icon.Chevron size={22} className={isRtl ? "" : "rotate-180"} />
            </button>

            <div
              data-testid={`${testIdPrefix}-lightbox-main`}
              // Each detail page renders its own artwork here, so the stage caps
              // whatever comes back rather than trusting it to fit — otherwise a
              // tall photo runs off the bottom of the screen.
              className="grid h-full max-h-full w-full max-w-4xl place-items-center overflow-hidden [&_img]:max-h-full [&_img]:max-w-full [&_img]:w-auto [&_img]:object-contain [&_svg]:max-h-full [&_svg]:max-w-full [&_video]:max-h-full [&_video]:max-w-full"
            >
              {renderItem(activeItem, imagePath ?? "")}
            </div>

            <button
              type="button"
              onClick={() => step(1)}
              disabled={activeIndex >= items.length - 1}
              aria-label={dict.media.next}
              className="absolute inset-e-1 z-10 grid size-10 place-items-center rounded-full border border-(--hairline) bg-canvas text-ink transition hover:bg-(--warm-soft) disabled:pointer-events-none disabled:opacity-30 sm:size-12"
            >
              <Icon.Chevron size={22} className={isRtl ? "rotate-180" : ""} />
            </button>
          </div>

          {/* The strip scrolls on its own so a long gallery never pushes the
              stage off screen on a phone. */}
          <div
            data-testid={`${testIdPrefix}-lightbox-thumbs`}
            className="shrink-0 overflow-x-auto overscroll-contain px-4 py-4 sm:px-6"
          >
            {/* An auto-margined track, not justify-center: a centred flex row
                clips its own first items once it has to scroll, putting the
                earliest thumbnails permanently out of reach. */}
            <div className="mx-auto flex w-max gap-2">
            {items.map((item, index) => (
              <button
                key={`lightbox-${itemKey(item, index)}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={dict.media.thumbnail.replace("{index}", String(index + 1))}
                aria-current={activeIndex === index}
                data-active={activeIndex === index}
                className="size-16 shrink-0 overflow-hidden rounded-md border border-(--hairline) bg-surface transition data-[active=true]:border-accent data-[active=true]:ring-2 data-[active=true]:ring-accent sm:size-20"
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
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
