"use client";

import type { Dict, Language } from "@minikoshk/shared";
import { CreditCardIcon, HeartIcon, SearchIcon, TruckIcon } from "../icons";
import { useTransientFlag } from "@/hooks/useTransientFlag";
import { useWishlist } from "@/hooks/useWishlist";
import { addToCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { firstInStockVariant, productPrice, type StorefrontProduct } from "@/lib/products";

/** Share of the cash price paid when checking out with a card (15% off). */
const CARD_DISCOUNT = 0.15;

/**
 * Storefront product card replicating the Zee reference design: image with
 * hover swap, wishlist heart, an optional SAVE badge, title, material subtitle,
 * a dual cash/card price block with a "BEST DEAL" pill, the dark "PAY WITH CARD"
 * promo strip, and round colour swatches with a "+N" overflow indicator. On
 * hover the card reveals an "ADD TO CART" button next to a quick-search button.
 */
export function ProductCard({
  product,
  lang,
  dict
}: {
  product: StorefrontProduct;
  lang: Language;
  dict: Dict;
}) {
  const t = dict.product;
  const { has: hasInWishlist, toggle: toggleWishlisted } = useWishlist();
  const [added, flashAdded] = useTransientFlag();
  const wishlisted = hasInWishlist(product.id);
  const name = product.name[lang];
  const subtitle = product.keywords?.[0] ?? "";
  const cashAmount = productPrice(product);
  const cashPrice = formatPrice(cashAmount, lang, t.currency);
  const cardPrice = formatPrice(Math.round(cashAmount * (1 - CARD_DISCOUNT)), lang, t.currency);

  const original = product.compareAtPrice;
  const hasDiscount = typeof original === "number" && original > cashAmount;
  const originalPrice = hasDiscount ? formatPrice(original, lang, t.currency) : null;
  const savePercent = hasDiscount ? Math.round((1 - cashAmount / original) * 100) : 0;

  const productHref = `/${lang}/products/${product.slug}`;
  const swatches = (product.colors ?? []).flatMap((color) => {
    const variant = product.variants.find((candidate) => candidate.colorId === color.id && candidate.stock > 0);
    return variant ? [{ color, variant }] : [];
  });
  const visibleSwatches = swatches.slice(0, 4);
  const extraSwatches = swatches.length - visibleSwatches.length;
  const selectedVariant = firstInStockVariant(product);
  const addSelectedToCart = () => {
    if (!selectedVariant) return;
    addToCart({ type: "product", variantId: selectedVariant.id, qty: 1 });
    flashAdded();
  };

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-transparent bg-white transition-all duration-200 hover:border-gray-200 hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.25)]">
      <div className="relative">
        {hasDiscount && (
          <span className="absolute inset-s-3 top-3 z-10 rounded-full bg-[#3aab4a] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {t.save} -{savePercent}%
          </span>
        )}
        <button
          type="button"
          aria-label={t.wishlist}
          aria-pressed={wishlisted}
          onClick={() => toggleWishlisted(product.id)}
          className={`absolute inset-e-3 top-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full backdrop-blur transition hover:text-brand-red ${
            wishlisted ? "text-brand-red" : "text-brand-dark"
          }`}
        >
          <HeartIcon className="h-4 w-4" fill={wishlisted ? "currentColor" : "none"} />
        </button>
        <a href={productHref} className="block">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f5f5f5]">
            <img
              src={product.imagePath}
              alt={name}
              className={`absolute inset-0 h-full w-full object-contain p-5 transition-opacity duration-300 ${
                product.hoverImagePath ? "group-hover:opacity-0" : ""
              }`}
            />
            {product.hoverImagePath && (
              <img
                src={product.hoverImagePath}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-contain p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            )}
          </div>
        </a>
      </div>

      <div className="mt-3 flex flex-1 flex-col px-3 pb-3">
        <a href={productHref} className="block">
          <h3 className="text-lg font-bold uppercase leading-[1.4] tracking-wide text-brand-dark">
            {name}
          </h3>
        </a>
        {subtitle && <p className="mt-0.5 text-md text-gray-400">{subtitle}</p>}

        {/* Cash price (with optional strikethrough original) */}
        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          {originalPrice && (
            <span className="text-sm text-gray-400 line-through">{originalPrice}</span>
          )}
          <span className="text-md font-extrabold text-brand-dark">{cashPrice}</span>
        </div>

        {/* Card price pill + BEST DEAL */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-red px-2 py-1 text-sm font-semibold text-brand-red">
            <CreditCardIcon className="h-3.5 w-3.5" />
            {cardPrice}
          </span>
          <span className="rounded-md bg-brand-red px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {t.bestDeal}
          </span>
        </div>

        {/* Dark promo strip */}
        <div className="mt-2 flex items-center gap-2 rounded-md bg-brand-dark px-2.5 py-1.5 text-xs font-semibold text-white">
          <span className="inline-flex items-center gap-1.5">
            <CreditCardIcon className="h-3.5 w-3.5" />
            {t.payWithCard}
          </span>
          <span className="h-3 w-px bg-white/30" />
          <span>{t.discount}</span>
          <span className="inline-flex items-center gap-1">
            <TruckIcon className="h-3.5 w-3.5" />
            {t.freeShipping}
          </span>
        </div>

        {/* Colour swatches */}
        {swatches.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {visibleSwatches.map(({ color, variant }) => (
              <a
                key={color.id}
                href={`${productHref}?size=${variant.sizeId}&color=${color.id}&variant=${variant.id}`}
                aria-label={`Color ${color.hex}`}
                title={color.hex}
                className="h-7 w-7 rounded-full border border-gray-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,.45)] transition-transform hover:scale-110"
                style={{ backgroundColor: color.hex }}
              />
            ))}
            {extraSwatches > 0 && (
              <span className="text-sm font-semibold text-gray-800">+{extraSwatches}</span>
            )}
          </div>
        )}

        {/* Hover actions: the slot is always reserved (so hovering never changes
            the card height or pushes the row down); the buttons sit clipped below
            the edge and slide up into view from the bottom on hover. */}
        <div className="mt-3 h-11 overflow-hidden group-focus-within:overflow-visible">
          <div className="flex h-11 translate-y-[calc(100%+0.75rem)] items-center gap-2 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <button
              type="button"
              disabled={!selectedVariant}
              onClick={addSelectedToCart}
              className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full bg-brand-dark text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {added ? dict.bundle.added : t.addToCart}
            </button>
            <a
              href={productHref}
              aria-label={name}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 text-brand-dark transition hover:border-brand-dark"
            >
              <SearchIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
