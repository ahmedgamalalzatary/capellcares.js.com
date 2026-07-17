"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { useResolvedCart } from "@/hooks/useResolvedCart";
import { formatPrice } from "@/lib/format";
import { cartCount, clearCart, removeLine, setLineQty } from "@/lib/cart";

/** Cart page body: resolved lines with qty steppers (capped at stock), removal, total, and a checkout link. */
export function CartView() {
  const { lang, dict } = useLocale();
  const { lines, resolved, total, loading } = useResolvedCart();

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-lg text-gray-500">{dict.cart.empty}</p>
        <a
          href={`/${lang}/products`}
          className="mt-6 inline-block rounded-full bg-brand-dark px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black"
        >
          {dict.cart.continueShopping}
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-2xl font-extrabold uppercase tracking-wide text-brand-dark">
        {dict.cart.title} ({cartCount(lines)})
      </h1>

      <ul className="mt-6 divide-y divide-gray-200 rounded-2xl bg-white shadow-sm">
        {resolved.map((item) => (
          <li key={JSON.stringify(item.line)} className="flex items-center gap-4 p-4">
            <a href={item.href || undefined} className="block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5]">
              {item.imagePath ? <img src={item.imagePath} alt={item.name} className="h-full w-full object-contain p-2" /> : null}
            </a>
            <div className="min-w-0 flex-1">
              <a href={item.href || undefined} className="block truncate font-bold uppercase text-brand-dark">{item.name}</a>
              {item.detail && <p className="text-sm text-gray-500">{item.detail}</p>}
              {item.available ? (
                <p className="mt-1 text-sm font-extrabold text-brand-dark">
                  {formatPrice(item.unitPrice, lang, dict.product.currency)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-brand-red">{dict.cart.unavailable}</p>
              )}
            </div>
            <div className="flex items-center rounded-full border border-gray-300">
              <button type="button" aria-label="-" onClick={() => setLineQty(item.line, item.line.qty - 1)}
                className="h-9 w-9 cursor-pointer font-bold text-brand-dark">−</button>
              <span className="min-w-8 text-center text-sm font-bold">{item.line.qty}</span>
              <button type="button" aria-label="+"
                disabled={item.available && item.line.qty >= item.maxQty}
                onClick={() => setLineQty(item.line, item.line.qty + 1)}
                className="h-9 w-9 cursor-pointer font-bold text-brand-dark disabled:cursor-not-allowed disabled:opacity-30">+</button>
            </div>
            <button
              type="button"
              onClick={() => removeLine(item.line)}
              className="cursor-pointer text-sm font-semibold text-gray-400 transition hover:text-brand-red"
            >
              {dict.cart.remove}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm">
        <button type="button" onClick={() => clearCart()} className="cursor-pointer text-sm font-semibold text-gray-400 hover:text-brand-red">
          {dict.cart.clear}
        </button>
        <div className="text-end">
          <p className="text-sm uppercase tracking-wide text-gray-500">{dict.cart.total}</p>
          <p className="text-2xl font-extrabold text-brand-dark">
            {loading ? "…" : formatPrice(total, lang, dict.product.currency)}
          </p>
        </div>
      </div>

      <a
        href={`/${lang}/checkout`}
        className="mt-6 block rounded-full bg-brand-dark py-4 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black"
      >
        {dict.cart.checkout}
      </a>
    </div>
  );
}
