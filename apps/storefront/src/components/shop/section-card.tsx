"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { pickLang, formatPrice, type Language, type Offer, type Collection, type Advice } from "@capella/shared";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";

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

  useEffect(() => () => {
    if (addedResetTimeoutRef.current != null) {
      clearTimeout(addedResetTimeoutRef.current);
    }
  }, []);

  // Typography mirrors ProductCard exactly, only the content/colors differ per kind.
  const nameClass = `m-0 leading-tight text-ink ${
    isAr ? "text-sm font-bold font-(family-name:--font-ar)" : "text-sm font-bold uppercase tracking-[0.06em]"
  }`;
  const priceClass = `font-bold leading-none text-accent ${isAr ? "text-base" : "text-lg"}`;
  const viewClass =
    "inline-flex flex-1 items-center justify-center gap-2 h-11 px-5.5 border border-ink font-semibold tracking-[0.01em] text-ink transition-[transform,background,color,box-shadow] duration-150 hover:-translate-y-px hover:shadow-(--shadow-1) active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";
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
  let videoUrl: string | null = null;
  let onAdd: ((e: React.MouseEvent) => void) | null = null;

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
    title = pickLang(advice.title, lang);
    description = pickLang(advice.description, lang);
    badge = dict.advices.tipBadge;
    videoUrl = advice.videoUrl ?? null;
    image = advice.imagePath ? (
      <img
        src={advice.imagePath}
        alt={title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-[1.05]"
      />
    ) : null;
  }

  const savings = price != null && originalTotal != null ? originalTotal - price : 0;

  return (
    <article className="group">
      <div className="relative aspect-8/9 overflow-hidden rounded-t-lg bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)">
        {/* The whole card is the image; everything else floats on top of it. */}
        {href ? (
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
      <div className="mt-3 grid gap-1 text-start">
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
      </div>

      {href && onAdd ? (
        <div className="mt-3 flex gap-2">
          <Link href={href} className={viewClass}>
            {dict.common.view}
          </Link>
          <button onClick={onAdd} className={addClass}>
            {added ? <Icon.Check size={16} /> : <Icon.Cart size={16} />}
            <span>{added ? dict.common.added : dict.common.addToCart}</span>
          </button>
        </div>
      ) : videoUrl ? (
        <div className="mt-3 flex gap-2">
          <a href={videoUrl} target="_blank" rel="noreferrer" className={viewClass}>
            {dict.advices.readMore}
          </a>
        </div>
      ) : null}
    </article>
  );
}
