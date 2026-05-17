"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { pickLang, formatPrice, getProductBadgeState, type Language, type Product, type Offer } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import styles from "./product-detail.module.css";

type Tab = "description" | "ingredients" | "howToUse" | "warnings";

interface Props {
  product: Product;
  offers: Offer[];
  lang: Language;
  dict: any;
}

export function ProductDetail({ product, offers, lang, dict }: Props) {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const auth = useAuth();
  const { isNew, isBestseller } = getProductBadgeState(product);
  const ribbons = [
    isNew ? { key: "new", label: dict.badges.new, tone: "new" as const } : null,
    isBestseller ? { key: "bestseller", label: dict.badges.bestseller, tone: "gold" as const } : null
  ].filter(Boolean) as Array<{ key: string; label: string; tone: "new" | "gold" }>;

  const inStockVariants = product.variants.filter((v) => v.stock > 0);
  const [variantId, setVariantId] = useState<number>(inStockVariants[0]?.id ?? product.variants[0].id);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>("description");
  const [added, setAdded] = useState(false);
  const [showWishlistWarning, setShowWishlistWarning] = useState(false);

  const variant = useMemo(() => product.variants.find((v) => v.id === variantId)!, [variantId, product.variants]);
  const isOutOfStock = variant.stock === 0;

  const addToCart = () => {
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const buyNow = () => {
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    router.push(`/${lang}/checkout`);
  };

  const onWish = () => {
    if (!auth.user) {
      setShowWishlistWarning(true);
      return;
    }
    setShowWishlistWarning(false);
    wishlist.toggle(product.id);
  };

  useEffect(() => {
    if (auth.user) setShowWishlistWarning(false);
  }, [auth.user]);

  const tabs: { key: Tab; label: string; content: string }[] = [
    { key: "description", label: dict.product.description, content: pickLang(product.description, lang) },
    { key: "ingredients", label: dict.product.ingredients, content: pickLang(product.ingredients, lang) },
    { key: "howToUse", label: dict.product.howToUse, content: pickLang(product.howToUse, lang) },
    { key: "warnings", label: dict.product.warnings, content: pickLang(product.warnings, lang) }
  ];

  return (
    <div className={styles.layout}>
      <div className={styles.gallery}>
        <div className={styles.galleryMain}>
          {ribbons.length > 0 && (
            <div className={styles.ribbonStack}>
              {ribbons.map((ribbon, index) => (
                <span
                  key={ribbon.key}
                  className={`${styles.ribbon} ${ribbon.tone === "new" ? styles.ribbonNew : styles.ribbonGold}`}
                  data-offset={index === 1 ? "true" : undefined}
                >
                  {ribbon.label}
                </span>
              ))}
            </div>
          )}
          <ProductIllustration product={product} className={styles.illustration} />
        </div>
        <div className={styles.thumbs}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.thumb} data-active={i === 1}>
              <ProductIllustration product={product} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.infoHeader}>
          <span className="eyebrow">{dict.product.sku}: {product.sku}</span>
          <h1 className={styles.title}>{pickLang(product.name, lang)}</h1>
          {offers.length > 0 && (
            <div className={styles.offerBadges}>
              {offers.map((o) => (
                <Link key={o.id} href={`/${lang}/offers/${o.slug}`} className="badge badge--offer">
                  ★ {pickLang(o.name, lang)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(variant.price, lang)}</span>
          {isOutOfStock ? (
            <span className="chip chip--accent">{dict.common.outOfStock}</span>
          ) : variant.stock <= 5 ? (
            <span className="chip chip--gold">{dict.common.lowStock.replace("{n}", String(variant.stock))}</span>
          ) : (
            <span className="chip chip--sage">{dict.common.inStock}</span>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{dict.product.selectSize}</div>
          <div className={styles.variantRow}>
            {product.variants.map((v) => (
              <button
                key={v.id}
                className={styles.variantChip}
                data-active={variantId === v.id}
                data-out={v.stock === 0 ? "true" : undefined}
                onClick={() => v.stock > 0 && setVariantId(v.id)}
                disabled={v.stock === 0}
              >
                <span>{v.size}</span>
                <span className={styles.variantPrice}>{formatPrice(v.price, lang)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{dict.common.quantity}</div>
          <div className={styles.qty}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="−"><Icon.Minus /></button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(variant.stock || 1, q + 1))} aria-label="+"><Icon.Plus /></button>
          </div>
        </div>

        <div className={styles.cta}>
          <button className="btn btn--primary btn--block" onClick={addToCart} disabled={isOutOfStock}>
            <Icon.Cart size={18} />
            {added ? (lang === "ar" ? "أُضيف" : "Added") : dict.common.addToCart}
          </button>
          <button className="btn btn--ghost btn--block" onClick={buyNow} disabled={isOutOfStock}>
            {dict.common.buyNow}
          </button>
          <button className="btn btn--soft" onClick={onWish} aria-label={dict.common.addToWishlist}>
            {wishlist.has(product.id) ? <Icon.HeartFill /> : <Icon.Heart />}
          </button>
        </div>
        {showWishlistWarning && (
          <p className="muted" style={{ marginTop: 10 }}>
            {dict.wishlist.loginRequiredDesc}{" "}
            <Link href={`/${lang}/login`} style={{ textDecoration: "underline" }}>
              {dict.wishlist.goLogin}
            </Link>
          </p>
        )}

        <div className={styles.tabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={styles.tabBtn}
              data-active={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.tabBody}>
          {tabs.find((t) => t.key === tab)?.content}
        </div>

        {offers.length > 0 && (
          <div className={styles.offerCross}>
            <div className={styles.sectionLabel}>{dict.product.relatedOffers}</div>
            <div className={styles.offerList}>
              {offers.map((o) => (
                <Link key={o.id} href={`/${lang}/offers/${o.slug}`} className={styles.offerCard}>
                  <OfferIllustration slug={o.slug} name={pickLang(o.name, lang)} className={styles.offerThumb} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{pickLang(o.name, lang)}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{formatPrice(o.price, lang)} · {dict.offers.save.replace("{amount}", formatPrice(o.originalTotal - o.price, lang))}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
