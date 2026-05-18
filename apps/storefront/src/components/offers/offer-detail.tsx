"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, type Language, type Offer, type Product } from "@capella/shared";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import styles from "./offer-detail.module.css";

interface ItemEntry {
  qty: number;
  variantId: number;
  product: Product;
  size: string;
  unitPrice: number;
  available: number;
}

interface Props {
  offer: Offer;
  items: ItemEntry[];
  lang: Language;
  dict: any;
}

export function OfferDetail({ offer, items, lang, dict }: Props) {
  const router = useRouter();
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const savings = offer.originalTotal - offer.price;
  const inStock = items.every((it) => it.available >= it.qty);

  const add = () => {
    cart.add({ type: "offer", offerId: offer.id, qty: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const buyNow = () => {
    cart.add({ type: "offer", offerId: offer.id, qty: 1 });
    router.push(`/${lang}/checkout`);
  };

  return (
    <div className={styles.layout}>
      <div className={styles.media}>
        <OfferIllustration offer={offer} className={styles.thumb} />
      </div>
      <div className={styles.info}>
        <span className="eyebrow">{dict.offers.badge}</span>
        <h1 className={styles.title}>{pickLang(offer.name, lang)}</h1>
        <p className="muted">{pickLang(offer.description, lang)}</p>

        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(offer.price, lang)}</span>
          {savings > 0 && (
            <>
              <span className={styles.strike}>{formatPrice(offer.originalTotal, lang)}</span>
              <span className="chip chip--accent">{dict.offers.save.replace("{amount}", formatPrice(savings, lang))}</span>
            </>
          )}
        </div>

        <div className={styles.includes}>
          <div className="eyebrow">{dict.offers.includes}</div>
          <div className={styles.items}>
            {items.map((it) => (
              <Link key={`${it.product.id}-${it.variantId}`} href={`/${lang}/products/${it.product.slug}`} className={styles.item}>
                <div className={styles.itemImg}>
                  <ProductIllustration product={it.product} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{pickLang(it.product.name, lang)}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {it.size} · {dict.common.quantity}: {it.qty}
                  </div>
                </div>
                <div style={{ marginInlineStart: "auto", color: "var(--ink-2)" }}>
                  {formatPrice(it.unitPrice * it.qty, lang)}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.cta}>
          <button className="btn btn--primary btn--block" onClick={add} disabled={!inStock}>
            <Icon.Cart size={18} /> {added ? (lang === "ar" ? "أُضيف" : "Added") : dict.offers.addBundleToCart}
          </button>
          <button className="btn btn--ghost btn--block" onClick={buyNow} disabled={!inStock}>
            {dict.common.buyNow}
          </button>
        </div>
        {!inStock && (
          <p style={{ color: "var(--danger)", fontSize: 13 }}>
            {lang === "ar" ? "أحد المنتجات بالباقة غير متوفر حاليًا." : "One of the products in this bundle is currently unavailable."}
          </p>
        )}
      </div>
    </div>
  );
}
