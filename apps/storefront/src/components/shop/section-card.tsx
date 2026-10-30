"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { pickLang, formatPrice, type CartLine, type Language, type Offer, type Collection, type Advice, type RatingSummary } from "@capella/shared";
import { SOCIAL_LINKS } from "@/constants/socials";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { ItemTagPill, type ItemTag } from "@/components/ui/item-tags";
import { CardRating } from "@/components/reviews/card-rating";
import { Icon } from "@/components/ui/icons";
import { AddToCartControl } from "@/components/ui/add-to-cart-control";
import { CardImageCarousel, useCardImageSwipe } from "@/components/ui/card-image-carousel";
import { useHoverPreviewImage } from "@/hooks/use-hover-preview-image";
import { buildCardImages } from "@/lib/card-images";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import { loadInstagramEmbedScript, resolveAdviceVideo } from "@/lib/advice-video";

/** Resolved category name shown as the classification line, as on ProductCard. */
type ClassifiedCard = { categoryName?: string };

type SectionCardProps =
  | ({ kind: "offer"; data: Offer; lang: Language; dict: any } & ClassifiedCard)
  | ({ kind: "collection"; data: Collection; lang: Language; dict: any } & ClassifiedCard)
  | { kind: "advice"; data: Advice; lang: Language; dict: any };

export function SectionCard(props: SectionCardProps) {
  const { lang, dict } = props;
  // Advice has no classification; only the two purchasable kinds carry one.
  const categoryName = props.kind === "advice" ? undefined : props.categoryName;
  const isAr = lang === "ar";
  const router = useRouter();
  const wishlist = useWishlist();
  const { user } = useAuth();
  // Advice cards show a video cover; the purchasable kinds slide through their pictures the way ProductCard does.
  const images = useMemo(
    () => (props.kind === "advice" ? [] : buildCardImages(props.data, lang)),
    [props.kind, props.data, lang]
  );
  // Where the swipe is off (the shop page) the card is as it was before it: its own main image, swapped to the hover image while hovered, no zoom.
  const swipeAllowed = useCardImageSwipe();
  const { previewImage, hoverProps } = useHoverPreviewImage(
    props.kind === "advice" ? "" : props.data.imagePath,
    props.kind === "advice" ? undefined : props.data.hoverImagePath
  );
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [advicePreviewActive, setAdvicePreviewActive] = useState(false);
  const adviceDialogRef = useRef<HTMLDivElement | null>(null);
  const adviceCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const adviceTriggerRef = useRef<HTMLElement | null>(null);

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
  const nameClass = "m-0 text-base font-bold leading-tight text-ink";
  const priceClass = "text-lg font-extrabold leading-none text-(--magenta-deep)";
  const addClass =
    "inline-flex flex-1 items-center justify-center gap-2 h-11 mb-1 rounded-full bg-(--violet) font-bold text-white shadow-[0_4px_0_var(--violet-deep)] transition-[transform,box-shadow] duration-150 hover:translate-y-px hover:shadow-[0_3px_0_var(--violet-deep)] active:translate-y-1 active:shadow-none focus-visible:outline-3 focus-visible:outline-(--cyan) focus-visible:outline-offset-2 px-2";

  const instagramHref = SOCIAL_LINKS.find((entry) => entry.label === "Instagram")?.href;
  const slideImageClass = "absolute inset-0 h-full w-full object-cover";

  // Per-kind derivations — the card knows which one it is rendering.
  let href: string | null = null;
  let title = "";
  let description = "";
  let badge: ItemTag | null = null;
  let image: React.ReactNode = null;
  /** Draws one slide of an offer or collection card. */
  let renderSlide: ((url: string) => React.ReactNode) | null = null;
  let price: number | null = null;
  let originalTotal: number | null = null;
  // Advice carries no rating; only the two purchasable kinds set one.
  let rating: RatingSummary | null = null;
  let cartLine: CartLine | null = null;
  let cartMaxQty: number | undefined;
  let adviceVideo: ReturnType<typeof resolveAdviceVideo> = null;
  let adviceVideoUrl: string | null = null;
  let adviceTrigger: React.ReactNode = null;
  let isWishlisted = false;
  let onWish: ((e: React.MouseEvent) => void) | null = null;

  if (props.kind === "offer") {
    const offer = props.data;
    href = `/${lang}/offers/${offer.slug}`;
    title = pickLang(offer.name, lang);
    description = pickLang(offer.description, lang);
    badge = { kind: "offer", label: dict.offers.badge, star: true };
    renderSlide = (url) => <OfferIllustration offer={{ ...offer, imagePath: url }} lang={lang} className={slideImageClass} />;
    price = offer.price;
    originalTotal = offer.originalTotal;
    rating = offer.rating ?? null;
    cartLine = { type: "offer", offerId: offer.id, qty: 1 };
    cartMaxQty = offer.stock;
    isWishlisted = wishlist.has("offer", offer.id);
    onWish = (e) => {
      e.preventDefault();
      if (!user) {
        router.push(`/${lang}/wishlist`);
        return;
      }
      wishlist.toggle("offer", offer.id);
    };
  } else if (props.kind === "collection") {
    const collection = props.data;
    href = `/${lang}/collections/${collection.slug}`;
    title = pickLang(collection.name, lang);
    description = pickLang(collection.description, lang);
    badge = { kind: "collection", label: dict.collections.badge, star: true };
    renderSlide = (url) => <CollectionIllustration collection={{ ...collection, imagePath: url }} lang={lang} className={slideImageClass} />;
    price = collection.price;
    originalTotal = collection.originalTotal;
    rating = collection.rating ?? null;
    cartLine = { type: "collection", collectionId: collection.id, qty: 1 };
    cartMaxQty = collection.stock;
    isWishlisted = wishlist.has("collection", collection.id);
    onWish = (e) => {
      e.preventDefault();
      if (!user) {
        router.push(`/${lang}/wishlist`);
        return;
      }
      wishlist.toggle("collection", collection.id);
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
      <div className="absolute inset-0 overflow-hidden bg-ink">
        <img
          src={adviceVideo.thumbnailUrl}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover transition-transform duration-300 ${
            advicePreviewActive ? "scale-[1.03]" : "scale-100"
          }`}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/15 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 grid gap-3 p-5 text-canvas">
          <span
            aria-hidden="true"
            className="inline-flex size-12 items-center justify-center rounded-full border border-white/60 bg-black/30 backdrop-blur-sm"
          >
            <span className="ms-0.5 block h-0 w-0 border-y-8 border-y-transparent border-s-14 border-s-canvas" />
          </span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
      </div>
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-ink text-canvas">
        <div className="grid gap-3 px-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto block h-0 w-0 border-y-14 border-y-transparent border-s-24 border-s-canvas"
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
  const mediaRoundedClass = "rounded-3xl";
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
      <div className={`relative aspect-square overflow-hidden ${mediaRoundedClass} bg-(--warm-soft)`}>
        {/* The whole card is the image; everything else floats on top of it. */}
        {props.kind === "advice" ? (
          <>
            {image}
            {adviceTrigger}
          </>
        ) : href && renderSlide && !swipeAllowed ? (
          <Link href={href} aria-label={title} className="absolute inset-0 grid place-items-center" {...hoverProps}>
            {renderSlide(previewImage)}
          </Link>
        ) : href && renderSlide ? (
          <CardImageCarousel images={images} hoverImage={props.data.hoverImagePath} href={href} label={title} lang={lang} renderImage={renderSlide} />
        ) : null}

        {badge ? (
          <ItemTagPill tag={badge} className="absolute top-2.5 inset-s-2.5 z-10 rounded-full" />
        ) : null}
        {onWish ? (
          <button
            className="absolute top-2 rounded-full inset-e-2 z-20 grid h-9 w-9 place-items-center text-ink backdrop-blur-sm transition-all duration-200 hover:scale-105 bg-surface/85 hover:bg-(--warm-soft)"
            aria-label={dict.common.addToWishlist}
            onClick={onWish}
          >
            {isWishlisted ? <Icon.HeartFill size={17} /> : <Icon.Heart size={17} className="stroke-[2.4]" />}
          </button>
        ) : null}
      </div>

      {/* Details: image → name → category → price, stacked beneath the image. */}
      {props.kind === "advice" ? null : <div className="mt-3 grid gap-1 text-start">
        {href ? (
          <Link href={href} className="block">
            <h3 className={nameClass}>{title}</h3>
          </Link>
        ) : (
          <h3 className={nameClass}>{title}</h3>
        )}

        {categoryName ? (
          <p className={"m-0 text-sm text-(--ink-3)"}>
            {categoryName}
          </p>
        ) : null}

        <CardRating rating={rating} dict={dict} lang={lang} />

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

      {href && cartLine ? (
        <div className="mt-3 flex gap-2">
          <AddToCartControl line={cartLine} dict={dict} maxQty={cartMaxQty} className={addClass} />
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
            className="relative grid h-[min(640px,90vh)] w-[min(960px,92vw)] gap-5 overflow-y-auto rounded-[28px] bg-canvas p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] md:p-6"
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
            <button
              ref={adviceCloseButtonRef}
              type="button"
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-canvas/85 text-ink backdrop-blur transition hover:bg-surface"
              aria-label={dict.advices.close ?? dict.common.cancel}
              onClick={closeAdvice}
            >
              <Icon.Close size={18} />
            </button>
            <div className="flex flex-col gap-4 self-center text-start">
              <div className="grid gap-3">
                <span className="inline-flex w-fit items-center rounded-full bg-surface px-3 py-1 text-xs font-semibold text-(--ink-3)">
                  {dict.advices.tipBadge}
                </span>
                <h3 className={isAr ? "text-2xl font-bold font-(family-name:--font-ar) text-ink" : "text-2xl font-bold text-ink"}>
                  {title}
                </h3>
                <p className="m-0 text-sm leading-7 text-(--ink-2)">{description}</p>
              </div>
              {instagramHref ? <Link
                href={instagramHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-(--radius) bg-accent px-5 py-3 text-sm font-semibold text-canvas transition-[transform,background,color,box-shadow] duration-150 hover:-translate-y-px hover:bg-accent-deep hover:shadow-(--shadow-1) active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                {dict.advices.readMore}
              </Link> : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
