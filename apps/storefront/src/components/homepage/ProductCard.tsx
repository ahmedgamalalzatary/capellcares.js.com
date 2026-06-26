import type { Dict, Language } from "@minikoshk/shared";
import { HeartIcon } from "../icons";
import { productPrice, type StorefrontProduct } from "@/lib/products";

/** Card-payment discount applied on top of the cash price (matches the 15% strip). */
const CARD_DISCOUNT = 0.15;

function formatPrice(amount: number, lang: Language, currency: string) {
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;
}

/** Up to four image thumbnails used as colour-swatch dots, mirroring the design. */
function swatchImages(product: StorefrontProduct): string[] {
  const fromMedia = product.media.filter((m) => m.type === "image").map((m) => m.url);
  const all = fromMedia.length > 0 ? fromMedia : [product.imagePath];
  return all.filter(Boolean);
}

/** Credit-card glyph reused by the card-price row and the payment strip. */
function CardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

/**
 * Storefront product card replicating the Zee reference design: image with
 * hover swap, wishlist heart, title, material subtitle, a dual cash/card price
 * block with a "BEST DEAL" pill, the dark "PAY WITH CARD" promo strip, and
 * round colour swatches with a "+N" overflow indicator.
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
  const name = product.name[lang];
  const subtitle = product.keywords[0] ?? "";
  const cashAmount = productPrice(product);
  const cashPrice = formatPrice(cashAmount, lang, t.currency);
  const cardPrice = formatPrice(Math.round(cashAmount * (1 - CARD_DISCOUNT)), lang, t.currency);
  const swatches = swatchImages(product);
  const visibleSwatches = swatches.slice(0, 4);
  const extraSwatches = swatches.length - visibleSwatches.length;

  return (
    <article className="group flex h-full flex-col rounded-2xl transition-shadow duration-200 hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.25)]">
      <div className="relative">
        <button
          type="button"
          aria-label={t.wishlist}
          className="absolute inset-e-0 top-0 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-brand-dark backdrop-blur transition hover:text-brand-red"
        >
          <HeartIcon className="h-4 w-4 font-bold" />
        </button>
        <a href={`/${lang}/shop?product=${product.slug}`} className="block">
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

      <div className="mt-3 flex flex-1 flex-col px-2 py-2">
        <a href={`/${lang}/shop?product=${product.slug}`} className="block">
          <h3 className="text-lg font-bold uppercase leading-[1.4] tracking-wide text-brand-dark">
            {name}
          </h3>
        </a>
        {subtitle && <p className="mt-0.5 text-md text-gray-400">{subtitle}</p>}

        {/* Price block — cash price + card-price row */}
        <div className="mb-2 mt-2 flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-md font-extrabold">{cashPrice}</span>
          </div>
        </div>

        {/* Colour swatches */}
        {swatches.length > 1 && (
          <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-3">
            {visibleSwatches.map((src, index) => (
              <span
                key={`${src}-${index}`}
                className="h-7 w-7 overflow-hidden rounded-full border border-gray-200 bg-white"
              >
                <img src={src} alt="" aria-hidden className="h-full w-full object-cover" />
              </span>
            ))}
            {extraSwatches > 0 && (
              <span className="text-sm font-semibold text-gray-800">+{extraSwatches}</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
