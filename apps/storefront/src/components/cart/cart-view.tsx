"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { pickLang, formatPrice, type Language, type Product, type Offer } from "@capella/shared";
import { fetchProducts, fetchOffers } from "@/lib/api/client";
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
  type: "product" | "offer";
  illustration: React.ReactNode;
}

export function CartView({ lang, dict }: { lang: Language; dict: any }) {
  const { lines, setQty, remove, keyOf } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchOffers()])
      .then(([p, o]) => {
        setProducts(p);
        setOffers(o);
      })
      .catch(() => {});
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
            unitPrice: v.price,
            qty: l.qty,
            slug: `/${lang}/products/${p.slug}`,
            illustration: <ProductIllustration product={p} />
          };
        }

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
      })
      .filter(Boolean) as Resolved[];
  }, [lines, lang, dict, keyOf, products, offers]);

  const subtotal = resolved.reduce((acc, r) => acc + r.unitPrice * r.qty, 0);

  if (resolved.length === 0) {
    return (
      <div className="grid place-items-center gap-3 py-20 text-center">
        <h1 className="m-0 text-[32px] font-(--font-display) leading-none">{dict.cart.empty}</h1>
        <p className="text-(--ink-2)">{lang === "ar" ? "ابدئي رحلتك مع كابيلا اليوم." : "Let's find something you'll love."}</p>
        <Link href={`/${lang}/products`} className="btn btn--primary">
          {dict.cart.keepShopping}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-9 pb-20 lg:grid-cols-[1fr_360px]">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{dict.cart.item}</th>
              <th className="w-[140px]">{dict.cart.qty}</th>
              <th className="w-[120px] text-end">{dict.cart.price}</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((r) => (
              <tr key={r.key}>
                <td>
                  <Link href={r.slug} className="flex items-center gap-3.5">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-(--bg-tint)">
                      {r.illustration}
                    </div>
                    <div>
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-sm text-(--ink-2)">{r.meta}</div>
                    </div>
                  </Link>
                </td>
                <td>
                  <div className="inline-grid grid-cols-[32px_40px_32px] items-center rounded-full border border-(--hairline) bg-white">
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
                    className="rounded-lg border-0 bg-transparent p-1.5 text-(--ink-3) hover:bg-[rgba(192,57,43,0.08)] hover:text-(--danger)"
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

      <aside className="sticky top-[140px] self-start rounded-[16px] border border-(--hairline) bg-(--bg-elev) p-6">
        <div className="text-[22px] font-(--font-display)">
          {lang === "ar" ? "ملخص الطلب" : "Order summary"}
        </div>
        <hr className="hr" />
        <div className="flex items-center justify-between py-1.5">
          <span className="text-(--ink-2)">{dict.common.subtotal}</span>
          <span>{formatPrice(subtotal, lang)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-(--ink-2)">{dict.common.shipping}</span>
          <span className="text-sm text-(--ink-2)">{dict.common.calculatedAtCheckout}</span>
        </div>
        <hr className="hr" />
        <div className="flex items-center justify-between pt-2 text-lg font-semibold">
          <span>{dict.common.total}</span>
          <span className="font-(--font-display)">{formatPrice(subtotal, lang)}</span>
        </div>
        <Link href={`/${lang}/checkout`} className="btn btn--primary btn--block mt-4">
          {dict.cart.proceed}
        </Link>
        <Link href={`/${lang}/products`} className="btn btn--ghost btn--block mt-2">
          {dict.cart.keepShopping}
        </Link>
      </aside>
    </div>
  );
}

