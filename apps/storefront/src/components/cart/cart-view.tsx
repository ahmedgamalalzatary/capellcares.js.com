"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { pickLang, formatPrice, type Language, type Product, type Offer } from "@capella/shared";
import { fetchProducts, fetchOffers } from "@/lib/api/client";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { Icon } from "@/components/ui/icons";
import styles from "./cart.module.css";

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
    Promise.all([fetchProducts(), fetchOffers()]).then(([p, o]) => {
      setProducts(p);
      setOffers(o);
    }).catch(() => {});
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
            key, type: "product" as const,
            title: pickLang(p.name, lang),
            meta: `${dict.common.size}: ${v.size}`,
            unitPrice: v.price, qty: l.qty, slug: `/${lang}/products/${p.slug}`,
            illustration: <ProductIllustration product={p} />
          };
        }
        const o = offers.find((o) => o.id === l.offerId);
        if (!o) return null;
        return {
          key, type: "offer" as const,
          title: pickLang(o.name, lang),
          meta: dict.offers.badge,
          unitPrice: o.price, qty: l.qty, slug: `/${lang}/offers/${o.slug}`,
          illustration: <OfferIllustration slug={o.slug} name={pickLang(o.name, lang)} />
        };
      })
      .filter(Boolean) as Resolved[];
  }, [lines, lang, dict, keyOf, products, offers]);

  const subtotal = resolved.reduce((acc, r) => acc + r.unitPrice * r.qty, 0);

  if (resolved.length === 0) {
    return (
      <div className={styles.empty}>
        <h1 className="display" style={{ fontSize: 32, margin: 0 }}>{dict.cart.empty}</h1>
        <p className="muted">{lang === "ar" ? "ابدئي رحلتك مع كابيلا اليوم." : "Let's find something you'll love."}</p>
        <Link href={`/${lang}/products`} className="btn btn--primary">{dict.cart.keepShopping}</Link>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.items}>
        <table className="table">
          <thead>
            <tr>
              <th>{dict.cart.item}</th>
              <th style={{ width: 140 }}>{dict.cart.qty}</th>
              <th style={{ width: 120, textAlign: "end" }}>{dict.cart.price}</th>
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((r) => (
              <tr key={r.key}>
                <td>
                  <Link href={r.slug} className={styles.cell}>
                    <div className={styles.thumb}>{r.illustration}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{r.meta}</div>
                    </div>
                  </Link>
                </td>
                <td>
                  <div className={styles.qty}>
                    <button onClick={() => setQty(r.key, r.qty - 1)} aria-label="−"><Icon.Minus /></button>
                    <span>{r.qty}</span>
                    <button onClick={() => setQty(r.key, r.qty + 1)} aria-label="+"><Icon.Plus /></button>
                  </div>
                </td>
                <td style={{ textAlign: "end", fontWeight: 600 }}>{formatPrice(r.unitPrice * r.qty, lang)}</td>
                <td>
                  <button className={styles.del} onClick={() => remove(r.key)} aria-label={dict.cart.remove}>
                    <Icon.Trash size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className={styles.summary}>
        <div className="display" style={{ fontSize: 22 }}>{lang === "ar" ? "ملخص الطلب" : "Order summary"}</div>
        <hr className="hr" />
        <div className={styles.row}><span className="muted">{dict.common.subtotal}</span><span>{formatPrice(subtotal, lang)}</span></div>
        <div className={styles.row}><span className="muted">{dict.common.shipping}</span><span className="muted" style={{ fontSize: 12 }}>{dict.common.calculatedAtCheckout}</span></div>
        <hr className="hr" />
        <div className={styles.row} style={{ fontSize: 18, fontWeight: 600 }}>
          <span>{dict.common.total}</span>
          <span className="display">{formatPrice(subtotal, lang)}</span>
        </div>
        <Link href={`/${lang}/checkout`} className="btn btn--primary btn--block" style={{ marginTop: 18 }}>
          {dict.cart.proceed}
        </Link>
        <Link href={`/${lang}/products`} className="btn btn--ghost btn--block" style={{ marginTop: 8 }}>
          {dict.cart.keepShopping}
        </Link>
      </aside>
    </div>
  );
}
