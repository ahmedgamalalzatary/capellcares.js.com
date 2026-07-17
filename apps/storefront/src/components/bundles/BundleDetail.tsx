"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useTransientFlag } from "@/hooks/useTransientFlag";
import { addToCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { bundleSavePercent, type BundleKind, type StorefrontBundleDetail } from "@/lib/bundles";

/** Detail hero for an offer or collection: image, copy, pricing, qty stepper, add to cart. */
export function BundleDetail({ bundle, kind }: { bundle: StorefrontBundleDetail; kind: BundleKind }) {
  const { lang, dict } = useLocale();
  const [qty, setQty] = useState(1);
  const [added, flashAdded] = useTransientFlag();
  const name = bundle.name[lang];
  const description = bundle.description[lang];
  const savePercent = bundleSavePercent(bundle);
  const inStock = bundle.stock > 0;
  const maxQty = Math.max(1, bundle.stock);

  const changeQty = (delta: number) => {
    setQty((current) => Math.min(maxQty, Math.max(1, current + delta)));
  };
  const add = () => {
    if (!inStock) return;
    addToCart(kind === "offer" ? { type: "offer", offerId: bundle.id, qty } : { type: "collection", collectionId: bundle.id, qty });
    flashAdded();
  };

  return (
    <section aria-label={name} className="mx-auto my-8 grid max-w-5xl gap-8 rounded-3xl bg-white p-6 shadow-xl md:grid-cols-2 md:p-10">
      <div className="relative flex min-h-80 items-center justify-center rounded-2xl bg-gray-50 p-8">
        {savePercent > 0 && (
          <span className="absolute inset-s-4 top-4 rounded-full bg-[#3aab4a] px-3 py-1 text-sm font-bold text-white shadow-sm">
            {dict.product.save} -{savePercent}%
          </span>
        )}
        {bundle.imagePath ? <img src={bundle.imagePath} alt={name} className="max-h-96 w-full object-contain" /> : null}
      </div>

      <div className="flex flex-col justify-center">
        <h1 className="text-3xl font-extrabold uppercase tracking-wide text-brand-dark">{name}</h1>
        {description && <p className="mt-4 whitespace-pre-line leading-relaxed text-gray-600">{description}</p>}
        <p className="mt-4 text-sm font-semibold text-gray-500">
          {dict.bundle.includes} {bundle.items.reduce((total, item) => total + item.qty, 0)} {dict.bundle.itemsCount}
        </p>

        <div className="mt-6 flex flex-wrap items-baseline gap-2">
          {savePercent > 0 && (
            <span className="text-lg text-gray-400 line-through">{formatPrice(bundle.originalTotal, lang, dict.product.currency)}</span>
          )}
          <span className="text-3xl font-extrabold text-brand-dark">{formatPrice(bundle.price, lang, dict.product.currency)}</span>
        </div>
        <div className="mt-1 text-sm text-gray-500">
          {inStock ? `${bundle.stock} ${dict.bundle.inStock}` : dict.bundle.outOfStock}
        </div>

        <div className="mt-8 flex items-center gap-4 border-t border-gray-200 pt-6">
          <div className="flex items-center rounded-full border border-gray-300">
            <button type="button" aria-label="-" onClick={() => changeQty(-1)} disabled={!inStock || qty <= 1}
              className="h-11 w-11 cursor-pointer text-lg font-bold text-brand-dark disabled:opacity-30">−</button>
            <span className="min-w-10 text-center text-sm font-bold text-brand-dark">{qty}</span>
            <button type="button" aria-label="+" onClick={() => changeQty(1)} disabled={!inStock || qty >= maxQty}
              className="h-11 w-11 cursor-pointer text-lg font-bold text-brand-dark disabled:opacity-30">+</button>
          </div>
          <button
            type="button"
            disabled={!inStock}
            onClick={add}
            className="flex-1 cursor-pointer rounded-full bg-brand-dark px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!inStock ? dict.bundle.outOfStock : added ? dict.bundle.added : dict.product.addToCart}
          </button>
        </div>
      </div>
    </section>
  );
}
