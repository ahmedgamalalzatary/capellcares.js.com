"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice, pickLang, type Language, type RelatedItemCard } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { ItemTagPill, type ItemTag } from "@/components/ui/item-tags";
import { ColumnsToggle, type Cols } from "@/components/ui/columns-toggle";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";

interface Props {
  items: RelatedItemCard[];
  lang: Language;
  dict: any;
  title?: string;
}

function hrefFor(item: RelatedItemCard, lang: Language): string {
  const segment = item.type === "offer" ? "offers" : item.type === "collection" ? "collections" : "products";
  return `/${lang}/${segment}/${item.slug}`;
}

export function RelatedItems({ items, lang, dict, title }: Props) {
  const [cols, setCols] = useState<Cols>(1);

  if (items.length === 0) {
    return null;
  }

  const isAr = lang === "ar";
  // Mirror the category page grid: cols toggle sets the mobile base, then the
  // layout steps up on md/lg the same way (1→3 and 2→4 on desktop).
  const gridCols = cols === 1
    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <section className="grid gap-4 border-t border-(--hairline) py-4 sm:py-4" data-testid="related-items">
      <div className="flex items-center justify-between gap-4">
        {title ? (
          <h2 className={isAr
            ? "m-0 text-[clamp(20px,2.4vw,28px)] font-bold font-(family-name:--font-ar) text-ink"
            : "m-0 text-[clamp(22px,2.4vw,30px)] font-(--font-display) text-ink"}>
            {title}
          </h2>
        ) : <span />}

        <ColumnsToggle cols={cols} onChange={setCols} lang={lang} />
      </div>
      <div className={`grid gap-4 md:gap-6 lg:gap-7 ${gridCols}`}>
        {items.map((item) => (
          <RelatedCard key={`${item.type}-${item.id}`} item={item} lang={lang} dict={dict} />
        ))}
      </div>
    </section>
  );
}

/**
 * One related card. Deliberately identical to ProductCard/SectionCard —
 * media frame, badge, wishlist heart, typography, and action row all match,
 * so a related item reads as the same object as the cards it sits under.
 */
function RelatedCard({ item, lang, dict }: { item: RelatedItemCard; lang: Language; dict: any }) {
  const router = useRouter();
  const cart = useCart();
  const { has, toggle } = useWishlist();
  const { user } = useAuth();
  const [added, setAdded] = useState(false);
  const addedResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (addedResetTimeoutRef.current != null) {
      clearTimeout(addedResetTimeoutRef.current);
    }
  }, []);

  const isAr = lang === "ar";
  const href = hrefFor(item, lang);
  const label = pickLang(item.name, lang);
  const media = { slug: item.slug, name: item.name, imagePath: item.imagePath ?? "" };
  const isWishlisted = has(item.type, item.id);

  // Products carry no new/bestseller flags in this payload, so only bundles
  // badge — and only when the dictionary actually supplies a label.
  const badgeLabel: string | undefined =
    item.type === "offer" ? dict.offers?.badge : item.type === "collection" ? dict.collections?.badge : undefined;
  const badge: ItemTag | null = badgeLabel
    ? { kind: item.type === "offer" ? "offer" : "collection", label: badgeLabel, star: true }
    : null;

  const onWish = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    toggle(item.type, item.id);
  };

  // A product needs a variant to transact on; bundles are addressed by their
  // own id. Without one there is nothing to add, so the row is withheld.
  const canAdd = item.type !== "product" || item.variantId != null;

  const onAdd = (event: React.MouseEvent) => {
    event.preventDefault();
    if (item.type === "offer") {
      cart.add({ type: "offer", offerId: item.id, qty: 1 });
    } else if (item.type === "collection") {
      cart.add({ type: "collection", collectionId: item.id, qty: 1 });
    } else if (item.variantId != null) {
      cart.add({ type: "product", productId: item.id, variantId: item.variantId, qty: 1 });
    }
    setAdded(true);
    if (addedResetTimeoutRef.current != null) {
      clearTimeout(addedResetTimeoutRef.current);
    }
    addedResetTimeoutRef.current = setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article className="group" data-testid="related-item">
      <div className="relative aspect-8/9 overflow-hidden rounded-t-lg bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)">
        {/* The whole card is the image; everything else floats on top of it. */}
        <Link href={href} aria-label={label} className="absolute inset-0 grid place-items-center">
          {/* Bundle artwork is sized the way SectionCard sizes it, product
              artwork the way ProductCard does — each matches its own card. */}
          {item.type === "offer" ? (
            <OfferIllustration
              offer={media}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-[1.05]"
            />
          ) : item.type === "collection" ? (
            <CollectionIllustration
              collection={media}
              lang={lang}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-[1.05]"
            />
          ) : (
            <ProductIllustration
              product={media}
              className="object-contain transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-[1.05]"
            />
          )}
        </Link>

        {badge ? <ItemTagPill tag={badge} className="absolute top-0 inset-s-0 z-10 rounded-ss-lg" /> : null}

        <button
          type="button"
          className={`absolute top-2 rounded-full inset-e-2 z-20 grid h-9 w-9 place-items-center text-ink backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
            isWishlisted ? "border-accent! bg-accent text-canvas" : "bg-surface/85 hover:bg-(--warm-soft)"
          }`}
          aria-label={isWishlisted ? (dict.common.removeFromWishlist ?? dict.common.addToWishlist) : dict.common.addToWishlist}
          aria-pressed={isWishlisted}
          onClick={onWish}
        >
          {isWishlisted ? <Icon.HeartFill size={17} /> : <Icon.Heart size={17} className="stroke-[2.4]" />}
        </button>
      </div>

      {/* Details: image → name → price, stacked beneath the image. */}
      <div className="mt-3 grid gap-1 text-start">
        <Link href={href} className="block">
          <h3 className={`m-0 leading-tight text-ink ${
            isAr ? "text-sm font-bold font-(family-name:--font-ar)" : "text-sm font-bold uppercase tracking-[0.06em]"
          }`}>
            {label}
          </h3>
        </Link>

        {item.categoryName ? (
          <p className={`m-0 ${isAr ? "text-md font-(family-name:--font-ar)" : "text-md tracking-[0.04em]"}`}>
            {pickLang(item.categoryName, lang)}
          </p>
        ) : null}

        <span className={`font-bold leading-none text-accent ${isAr ? "text-base" : "text-lg"}`}>
          {formatPrice(item.price, lang)}
        </span>
        {/* Only a genuine saving is struck through, the same test the offer and
            collection detail views apply to their own original totals. */}
        {item.originalTotal != null && item.originalTotal > item.price ? (
          <span className="text-sm text-(--ink-3) line-through">{formatPrice(item.originalTotal, lang)}</span>
        ) : null}
      </div>

      {canAdd ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex flex-1 items-center justify-center gap-2 h-11 px-4 bg-accent font-semibold tracking-[0.01em] text-canvas transition-[transform,background,color,box-shadow] duration-150 hover:-translate-y-px hover:bg-accent-deep hover:shadow-(--shadow-1) active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            {added ? <Icon.Check size={16} /> : null}
            <span>{added ? dict.common.added : dict.common.addToCart}</span>
          </button>
        </div>
      ) : null}
    </article>
  );
}
