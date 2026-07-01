"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { pickLang, formatPrice, getEffectiveVariantPrice, type Language, type Product, type Offer, type Collection } from "@capella/shared";
import { fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { Icon } from "@/components/ui/icons";

interface Resolved {
  key: string;
  title: string;
  meta: string;
  unitPrice: number;
  qty: number;
  slug: string;
  type: "product" | "offer" | "collection";
  illustration: React.ReactNode;
}

export function CartView({ lang, dict }: { lang: Language; dict: any }) {
  const { lines, setQty, remove, keyOf } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  // Track whether the catalog fetch has resolved successfully. The cart's source
  // of truth is `lines` (in memory / localStorage); the fetch only enriches each
  // line with name/price/image. Until it lands — or if it fails — we must NOT
  // treat an unresolved cart as an empty one, otherwise a slow or flaky fetch
  // renders "empty cart" over a cart that actually has items (the intermittent
  // empty-cart bug seen on some Safari/WebKit runs).
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProducts(), fetchOffers(), fetchCollections()])
      .then(([p, o, c]) => {
        if (cancelled) return;
        setProducts(p);
        setOffers(o);
        setCollections(c);
        setCatalogLoaded(true);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved: Resolved[] = useMemo(() => {
    return lines
      .map((l) => {
        const key = keyOf(l);
        if (l.type === "product") {
          const p = products.find((p) => p.id === l.productId);
          const v = p?.variants.find((v) => v.id === l.variantId);
          if (!p || !v) return null;
          return {
            key,
            type: "product" as const,
            title: pickLang(p.name, lang),
            meta: `${dict.common.size}: ${v.size}`,
            unitPrice: getEffectiveVariantPrice(v),
            qty: l.qty,
            slug: `/${lang}/products/${p.slug}`,
            illustration: <ProductIllustration product={p} />
          };
        }

        if (l.type === "offer") {
          const o = offers.find((o) => o.id === l.offerId);
          if (!o) return null;
          return {
            key,
            type: "offer" as const,
            title: pickLang(o.name, lang),
            meta: dict.offers.badge,
            unitPrice: o.price,
            qty: l.qty,
            slug: `/${lang}/offers/${o.slug}`,
            illustration: <OfferIllustration offer={o} />
          };
        }

        const collection = collections.find((item) => item.id === l.collectionId);
        if (!collection) return null;
        return {
          key,
          type: "collection" as const,
          title: pickLang(collection.name, lang),
          meta: dict.itemType.collection,
          unitPrice: collection.price,
          qty: l.qty,
          slug: `/${lang}/collections/${collection.slug}`,
          illustration: (
            <div className="grid h-full w-full place-items-center text-xs font-semibold text-(--ink-2)">
              {dict.itemType.collection}
            </div>
          )
        };
      })
      .filter(Boolean) as Resolved[];
  }, [lines, lang, dict, keyOf, products, offers, collections]);

  const subtotal = resolved.reduce((acc, r) => acc + r.unitPrice * r.qty, 0);

  // The cart has lines but the catalog hasn't resolved yet (or the resolve fetch
  // failed): show a loading state, never the "empty" screen. Collapsing this into
  // the empty case is what let a slow/failed fetch blank a real cart.
  if (resolved.length === 0 && lines.length > 0 && !catalogLoaded) {
    return (
      <div className="mx-auto my-10 grid max-w-115 place-items-center gap-4 px-6 py-12 text-center sm:my-16">
        <div className="grid h-16 w-16 animate-pulse place-items-center rounded-full bg-(--warm-soft) text-ink">
          <Icon.Cart size={26} />
        </div>
        <p className="text-sm text-(--ink-2)">{dict.common?.loading ?? "…"}</p>
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="mx-auto my-10 grid max-w-115 place-items-center gap-4 rounded-lg border border-(--hairline) bg-surface px-6 py-12 text-center sm:my-16 sm:px-8 sm:py-16">
        <div className="grid h-16 w-16 place-items-center bg-(--warm-soft) text-ink">
          <Icon.Cart size={26} />
        </div>
        <h1 className={`m-0 leading-[1.1] ${lang === "ar"
          ? "text-3xl font-bold font-(family-name:--font-ar) text-ink"
          : "text-3xl font-(--font-display) text-ink"}`}>
          {dict.cart.empty}
        </h1>
        <p className="max-w-[34ch] text-sm leading-[1.7] text-(--ink-2)">
          {dict.cart.emptyTagline}
        </p>
        <Link href={`/${lang}/products`} className="btn btn--primary btn--lg mt-2">
          {dict.cart.keepShopping}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 pb-8 sm:gap-9 sm:pb-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        {/* Mobile: stacked cards */}
        <ul className="flex flex-col gap-3 sm:hidden">
          {resolved.map((r) => (
            <li
              key={r.key}
              className="rounded-lg border border-(--hairline) bg-surface p-3"
            >
              <div className="flex items-start gap-3">
                <Link href={r.slug} className="shrink-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-(--warm-soft)">
                    {r.illustration}
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={r.slug} className="block min-w-0">
                    <div className="truncate font-semibold">{r.title}</div>
                    <div className="text-xs text-(--ink-2)">{r.meta}</div>
                  </Link>
                  <div className="mt-2 font-semibold">{formatPrice(r.unitPrice * r.qty, lang)}</div>
                </div>
                <button
                  className="-mt-1 -me-1 shrink-0 rounded-(--radius) border-0 bg-transparent p-2 text-(--ink-3) transition-colors hover:bg-[color-mix(in_oklch,var(--error)_10%,transparent)] hover:text-(--error)"
                  onClick={() => remove(r.key)}
                  aria-label={dict.cart.remove}
                >
                  <Icon.Trash size={18} />
                </button>
              </div>
              <div className="mt-3">
                <div className="inline-grid grid-cols-[36px_44px_36px] items-center rounded-full border border-(--hairline) bg-surface">
                  <button
                    className="grid h-9 place-items-center rounded-full border-0 bg-transparent"
                    onClick={() => setQty(r.key, r.qty - 1)}
                    aria-label="−"
                  >
                    <Icon.Minus />
                  </button>
                  <span className="text-center text-sm font-semibold">{r.qty}</span>
                  <button
                    className="grid h-9 place-items-center rounded-full border-0 bg-transparent"
                    onClick={() => setQty(r.key, r.qty + 1)}
                    aria-label="+"
                  >
                    <Icon.Plus />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Tablet/desktop: table */}
        <div className="hidden sm:block">
        <table className="table">
          <thead>
            <tr>
              <th>{dict.cart.item}</th>
              <th className="w-35">{dict.cart.qty}</th>
              <th className="w-30 text-end">{dict.cart.price}</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((r) => (
              <tr key={r.key}>
                <td>
                  <Link href={r.slug} className="flex items-center gap-3 sm:gap-3.5">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-(--warm-soft) sm:h-16 sm:w-16">
                      {r.illustration}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.title}</div>
                      <div className="text-xs text-(--ink-2) sm:text-sm">{r.meta}</div>
                    </div>
                  </Link>
                </td>
                <td>
                  <div className="inline-grid grid-cols-[32px_40px_32px] items-center rounded-full border border-(--hairline) bg-surface">
                    <button
                      className="grid h-8 place-items-center rounded-full border-0 bg-transparent"
                      onClick={() => setQty(r.key, r.qty - 1)}
                      aria-label="−"
                    >
                      <Icon.Minus />
                    </button>
                    <span className="text-center text-sm font-semibold">{r.qty}</span>
                    <button
                      className="grid h-8 place-items-center rounded-full border-0 bg-transparent"
                      onClick={() => setQty(r.key, r.qty + 1)}
                      aria-label="+"
                    >
                      <Icon.Plus />
                    </button>
                  </div>
                </td>
                <td className="text-end font-semibold">{formatPrice(r.unitPrice * r.qty, lang)}</td>
                <td>
                  <button
                    className="rounded-(--radius) border-0 bg-transparent p-2 text-(--ink-3) transition-colors hover:bg-[color-mix(in_oklch,var(--error)_10%,transparent)] hover:text-(--error)"
                    onClick={() => remove(r.key)}
                    aria-label={dict.cart.remove}
                  >
                    <Icon.Trash size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <aside className="self-start rounded-lg border border-(--hairline) bg-surface p-5 shadow-(--shadow-1) sm:p-7 lg:sticky lg:top-35">
        <span className="eyebrow text-(--ink-3)!">{dict.cart.summaryEyebrow}</span>
        <div className={`mt-1 ${lang === "ar"
          ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
          : "text-2xl font-(--font-display) text-ink"}`}>
          {dict.cart.summaryTitle}
        </div>
        <div className="my-5 h-px bg-(--hairline)" />
        <div className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-(--ink-2)">{dict.common.subtotal}</span>
          <span className="text-ink">{formatPrice(subtotal, lang)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-(--ink-2)">{dict.common.shipping}</span>
          <span className="text-sm text-(--ink-3)">{dict.common.calculatedAtCheckout}</span>
        </div>
        <div className="my-5 h-px bg-(--hairline)" />
        <div className="flex items-end justify-between pt-1">
          <span className="text-base font-medium text-(--ink-2)">{dict.common.total}</span>
          <span className={`text-accent leading-none ${lang === "ar"
            ? "text-2xl font-bold font-(family-name:--font-ar)"
            : "text-3xl font-(--font-display)"}`}>
            {formatPrice(subtotal, lang)}
          </span>
        </div>
        <Link href={`/${lang}/checkout`} className="btn btn--primary btn--block btn--lg mt-6">
          {dict.cart.proceed}
        </Link>
        <Link href={`/${lang}/products`} className="btn btn--ghost btn--block mt-2">
          {dict.cart.keepShopping}
        </Link>
        <div className="mt-5 flex items-center gap-2 text-xs text-(--ink-3)">
          <Icon.Check size={14} />
          <span>{dict.cart.codNote}</span>
        </div>
      </aside>
    </div>
  );
}
