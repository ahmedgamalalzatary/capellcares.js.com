"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { useTransientFlag } from "@/hooks/useTransientFlag";
import { addToCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { bundleSavePercent, type BundleKind, type StorefrontBundle } from "@/lib/bundles";

/**
 * Card for a fixed-price bundle (offer or collection): image, SAVE badge,
 * struck-through original total, and an add-to-cart button. Clicking through
 * goes to the bundle's detail page.
 */
export function BundleCard({ bundle, kind }: { bundle: StorefrontBundle; kind: BundleKind }) {
  const { lang, dict } = useLocale();
  const [added, flashAdded] = useTransientFlag();
  const name = bundle.name[lang];
  const savePercent = bundleSavePercent(bundle);
  const inStock = bundle.stock > 0;
  const href = `/${lang}/${kind === "offer" ? "offers" : "collections"}/${bundle.slug}`;

  const add = () => {
    addToCart(kind === "offer" ? { type: "offer", offerId: bundle.id, qty: 1 } : { type: "collection", collectionId: bundle.id, qty: 1 });
    flashAdded();
  };

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-transparent bg-white transition-all duration-200 hover:border-gray-200 hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.25)]">
      <div className="relative">
        {savePercent > 0 && (
          <span className="absolute inset-s-3 top-3 z-10 rounded-full bg-[#3aab4a] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {dict.product.save} -{savePercent}%
          </span>
        )}
        <a href={href} className="block">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f5f5f5]">
            {bundle.imagePath ? (
              <img src={bundle.imagePath} alt={name} className="absolute inset-0 h-full w-full object-contain p-5" />
            ) : null}
          </div>
        </a>
      </div>

      <div className="mt-3 flex flex-1 flex-col px-3 pb-3">
        <a href={href} className="block">
          <h3 className="text-lg font-bold uppercase leading-[1.4] tracking-wide text-brand-dark">{name}</h3>
        </a>
        <p className="mt-0.5 text-md text-gray-400">
          {dict.bundle.includes} {bundle.items.length} {dict.bundle.itemsCount}
        </p>

        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          {savePercent > 0 && (
            <span className="text-sm text-gray-400 line-through">{formatPrice(bundle.originalTotal, lang, dict.product.currency)}</span>
          )}
          <span className="text-md font-extrabold text-brand-dark">{formatPrice(bundle.price, lang, dict.product.currency)}</span>
        </div>

        <div className="mt-auto pt-3">
          <button
            type="button"
            disabled={!inStock}
            onClick={add}
            className="h-11 w-full cursor-pointer rounded-full bg-brand-dark text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!inStock ? dict.bundle.outOfStock : added ? dict.bundle.added : dict.product.addToCart}
          </button>
        </div>
      </div>
    </article>
  );
}
