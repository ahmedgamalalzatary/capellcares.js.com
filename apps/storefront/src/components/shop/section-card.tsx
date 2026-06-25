"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { pickLang, formatPrice, type Language, type Offer, type Collection, type Advice } from "@capella/shared";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { loadInstagramEmbedScript, resolveAdviceVideo } from "@/lib/advice-video";

type SectionCardProps =
  | { kind: "offer"; data: Offer; lang: Language; dict: any }
  | { kind: "collection"; data: Collection; lang: Language; dict: any }
  | { kind: "advice"; data: Advice; lang: Language; dict: any };

export function SectionCard(props: SectionCardProps) {
  const { lang, dict } = props;
  const isAr = lang === "ar";
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const addedResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [advicePreviewActive, setAdvicePreviewActive] = useState(false);
  const adviceDialogRef = useRef<HTMLDivElement | null>(null);
  const adviceCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const adviceTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => () => {
    if (addedResetTimeoutRef.current != null) {
      clearTimeout(addedResetTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!adviceOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [adviceOpen]);

  useEffect(() => {
    if (!adviceOpen || props.kind !== "advice" || typeof document === "undefined") return;
    const adviceVideo = resolveAdviceVideo(props.data.videoUrl);
    if (adviceVideo?.provider !== "instagram") return;
    loadInstagramEmbedScript();
  }, [adviceOpen, props]);

  useEffect(() => {
    if (!adviceOpen) return;
    adviceCloseButtonRef.current?.focus();
  }, [adviceOpen]);

  // Typography mirrors ProductCard exactly, only the content/colors differ per kind.
  const nameClass = `m-0 leading-tight text-ink ${
    isAr ? "text-sm font-bold font-(family-name:--font-ar)" : "text-sm font-bold uppercase tracking-[0.06em]"
  }`;
  const priceClass = `font-bold leading-none text-accent ${isAr ? "text-base" : "text-lg"}`;
  const addClass =
    "inline-flex flex-1 items-center justify-center gap-2 h-11 px-2 bg-accent font-semibold tracking-[0.01em] text-canvas transition-[transform,background,color,box-shadow] duration-150 hover:-translate-y-px hover:bg-accent-deep hover:shadow-(--shadow-1) active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

  // Per-kind derivations — the card knows which one it is rendering.
  let href: string | null = null;
  let title = "";
  let description = "";
  let badge = "";
  let image: React.ReactNode = null;
  let price: number | null = null;
  let originalTotal: number | null = null;
  let onAdd: ((e: React.MouseEvent) => void) | null = null;
  let adviceVideo: ReturnType<typeof resolveAdviceVideo> = null;
  let adviceVideoUrl: string | null = null;
  let adviceTrigger: React.ReactNode = null;

  if (props.kind === "offer") {
    const offer = props.data;
    href = `/${lang}/offers/${offer.slug}`;
    title = pickLang(offer.name, lang);
    description = pickLang(offer.description, lang);
    badge = `★ ${dict.offers.badge}`;
    image = <OfferIllustration offer={offer} className="absolute inset-0 h-full w-full object-cover" />;
    price = offer.price;
    originalTotal = offer.originalTotal;
    onAdd = (e) => {
      e.preventDefault();
      cart.add({ type: "offer", offerId: offer.id, qty: 1 });
      setAdded(true);
      if (addedResetTimeoutRef.current != null) {
        clearTimeout(addedResetTimeoutRef.current);
      }
      addedResetTimeoutRef.current = setTimeout(() => {
        setAdded(false);
        addedResetTimeoutRef.current = null;
      }, 1400);
    };
  } else if (props.kind === "collection") {
    const collection = props.data;
    href = `/${lang}/collections/${collection.slug}`;
    title = pickLang(collection.name, lang);
    description = pickLang(collection.description, lang);
    badge = `★ ${dict.collections.badge}`;
    image = <CollectionIllustration collection={collection} lang={lang} className="absolute inset-0 h-full w-full object-cover" />;
    price = collection.price;
    originalTotal = collection.originalTotal;
    onAdd = (e) => {
      e.preventDefault();
      cart.add({ type: "collection", collectionId: collection.id, qty: 1 });
      setAdded(true);
      if (addedResetTimeoutRef.current != null) {
        clearTimeout(addedResetTimeoutRef.current);
      }
      addedResetTimeoutRef.current = setTimeout(() => {
        setAdded(false);
        addedResetTimeoutRef.current = null;
      }, 1400);
    };
  } else {
    const advice = props.data;
    if (!advice.videoUrl.trim()) {
      return null;
    }
    title = pickLang(advice.title, lang);
    description = pickLang(advice.description, lang);
    adviceVideoUrl = advice.videoUrl;
    adviceVideo = resolveAdviceVideo(advice.videoUrl);
    image = adviceVideo?.provider === "youtube" ? (
      <iframe
        title={title}
        src={`${adviceVideo.previewUrl}${adviceVideo.previewUrl.includes("?") ? "&" : "?"}autoplay=${advicePreviewActive ? "1" : "0"}`}
        className="absolute inset-0 h-full w-full object-cover"
        allow={advicePreviewActive ? "autoplay; encrypted-media; picture-in-picture" : "encrypted-media; picture-in-picture"}
        loading="lazy"
        tabIndex={-1}
      />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-ink text-canvas">
        <div className="grid gap-3 px-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto block h-0 w-0 border-y-[14px] border-y-transparent border-s-[24px] border-s-canvas"
          />
          <span className="text-sm font-semibold">{title}</span>
        </div>
      </div>
    );
    const openAdvice = () => {
      setAdvicePreviewActive(false);
      adviceTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAdviceOpen(true);
    };
    const triggerClassName = "absolute inset-0 block";
    if (adviceVideo) {
      adviceTrigger = (
        <button
          type="button"
          aria-label={title}
          className={triggerClassName}
          onMouseEnter={() => setAdvicePreviewActive(true)}
          onMouseLeave={() => setAdvicePreviewActive(false)}
          onFocus={() => setAdvicePreviewActive(true)}
          onBlur={() => setAdvicePreviewActive(false)}
          onClick={openAdvice}
        >
          <span className="absolute inset-0 z-10 bg-transparent" aria-hidden="true" />
        </button>
      );
    } else {
      adviceTrigger = (
        <Link
          href={adviceVideoUrl}
          aria-label={title}
          className={triggerClassName}
          target="_blank"
          rel="noreferrer"
        >
          <span className="absolute inset-0 z-10 bg-transparent" aria-hidden="true" />
          {image}
        </Link>
      );
      image = null;
    }
  }

  const savings = price != null && originalTotal != null ? originalTotal - price : 0;
  const closeAdvice = () => {
    setAdviceOpen(false);
    setAdvicePreviewActive(false);
    adviceTriggerRef.current?.focus();
  };
  const onAdviceDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAdvice();
      return;
    }
    if (event.key !== "Tab") return;

    const focusableElements = adviceDialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusableElements || focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const focusables = Array.from(focusableElements).filter((element) => !element.hasAttribute("disabled"));
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <article className="group">
      <div className="relative aspect-8/9 overflow-hidden rounded-t-lg bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)">
        {/* The whole card is the image; everything else floats on top of it. */}
        {props.kind === "advice" ? (
          <>
            {image}
            {adviceTrigger}
          </>
        ) : href ? (
          <Link href={href} aria-label={title} className="absolute inset-0 grid place-items-center">
            {image}
          </Link>
        ) : (
          <div className="absolute inset-0 grid place-items-center">{image}</div>
        )}

        {badge ? (
          <span className="pointer-events-none absolute top-0 start-0 z-10 inline-flex items-center gap-1.5 rounded-ss-lg bg-accent px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-canvas">
            {badge}
          </span>
        ) : null}
      </div>

      {/* Details: image → name → description → price, stacked beneath the image. */}
      {props.kind === "advice" ? null : <div className="mt-3 grid gap-1 text-start">
        {href ? (
          <Link href={href} className="block">
            <h3 className={nameClass}>{title}</h3>
          </Link>
        ) : (
          <h3 className={nameClass}>{title}</h3>
        )}


        {price != null ? (
          <span className={priceClass}>
            {formatPrice(price, lang)}
            {savings > 0 ? (
              <span className="ms-2 text-sm font-normal text-(--ink-3) line-through">
                {formatPrice(originalTotal as number, lang)}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>}

      {href && onAdd ? (
        <div className="mt-3 flex gap-2">
          <Link href={href} className="inline-flex flex-1 items-center justify-center gap-2 h-11 px-5.5 border border-ink font-semibold tracking-[0.01em] text-ink transition-[transform,background,color,box-shadow] duration-150 hover:-translate-y-px hover:shadow-(--shadow-1) active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2">
            {dict.common.view}
          </Link>
          <button onClick={onAdd} className={addClass}>
            {added ? <Icon.Check size={16} /> : <Icon.Cart size={16} />}
            <span>{added ? dict.common.added : dict.common.addToCart}</span>
          </button>
        </div>
      ) : null}

      {props.kind === "advice" && adviceOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={closeAdvice}
          onKeyDown={onAdviceDialogKeyDown}
        >
          <div
            ref={adviceDialogRef}
            className="grid w-full max-w-5xl gap-5 rounded-[28px] bg-canvas p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overflow-hidden rounded-[20px] bg-ink">
              {adviceVideo?.provider === "youtube" ? (
                <iframe
                  title={`${title} video`}
                  src={`${adviceVideo.popupUrl}${adviceVideo.popupUrl.includes("?") ? "&" : "?"}autoplay=1`}
                  className="aspect-[9/16] h-full min-h-[420px] w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              ) : adviceVideo?.provider === "instagram" ? (
                <div className="flex min-h-[420px] items-center justify-center bg-canvas p-4">
                  <blockquote
                    className="instagram-media m-0 w-full"
                    data-instgrm-captioned=""
                    data-instgrm-permalink={adviceVideo.permalinkUrl}
                    data-instgrm-version="14"
                  >
                    <a href={adviceVideo.permalinkUrl} target="_blank" rel="noreferrer">
                      {title}
                    </a>
                  </blockquote>
                </div>
              ) : adviceVideoUrl ? (
                <div className="flex h-full min-h-[420px] items-center justify-center px-8 text-center text-base font-semibold text-canvas">
                  {title}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-4 self-center text-start">
              <button
                ref={adviceCloseButtonRef}
                type="button"
                className="ms-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition hover:bg-surface"
                aria-label={dict.advices.close ?? dict.common.cancel}
                onClick={closeAdvice}
              >
                <Icon.Close size={18} />
              </button>
              <div className="grid gap-3">
                <span className="inline-flex w-fit items-center rounded-full bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-(--ink-3)">
                  {dict.advices.tipBadge}
                </span>
                <h3 className={isAr ? "text-2xl font-bold font-(family-name:--font-ar) text-ink" : "text-2xl font-bold uppercase tracking-[0.04em] text-ink"}>
                  {title}
                </h3>
                <p className="m-0 text-sm leading-7 text-(--ink-2)">{description}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
