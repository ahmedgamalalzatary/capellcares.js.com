"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pickLang, formatPrice, formatPriceRange, getProductBadgeState, type Language, type Product } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { Icon } from "@/components/ui/icons";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";

interface Props {
  product: Product;
  lang: Language;
  dict: any;
}

export function ProductCard({ product, lang, dict }: Props) {
  const { has, toggle } = useWishlist();
  const { user } = useAuth();
  const [showWishlistWarning, setShowWishlistWarning] = useState(false);
  const prices = product.variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const { isNew, isBestseller, isOffer, isOutOfStock } = getProductBadgeState(product);
  const ribbons = [
    isNew ? { key: "new", label: dict.badges.new, tone: "new" as const } : null,
    isBestseller ? { key: "bestseller", label: dict.badges.bestseller, tone: "gold" as const } : null
  ].filter(Boolean) as Array<{ key: string; label: string; tone: "new" | "gold" }>;

  const onWish = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setShowWishlistWarning(true);
      return;
    }
    setShowWishlistWarning(false);
    toggle(product.id);
  };

  useEffect(() => {
    if (user) setShowWishlistWarning(false);
  }, [user]);

  return (
    <Link href={`/${lang}/products/${product.slug}`} className="pcard">
      <div className="pcard__img">
        {ribbons.length > 0 && (
          <div className="pcard__ribbons">
            {ribbons.map((ribbon, index) => (
              <span
                key={ribbon.key}
                className={`pcard__ribbon pcard__ribbon--${ribbon.tone}`}
                data-offset={index === 1 ? "true" : undefined}
              >
                {ribbon.label}
              </span>
            ))}
          </div>
        )}
        <ProductIllustration product={product} />
      </div>
      <div className="pcard__badges">
        {isOffer && <span className="badge badge--offer">{dict.badges.offer}</span>}
        {isOutOfStock && <span className="badge">{dict.common.outOfStock}</span>}
      </div>
      <button
        type="button"
        className="pcard__wish"
        data-active={has(product.id)}
        aria-label={dict.common.addToWishlist}
        onClick={onWish}
      >
        {has(product.id) ? <Icon.HeartFill size={16} /> : <Icon.Heart size={16} />}
      </button>
      <div className="pcard__body">
        <div className="eyebrow">{product.sku}</div>
        <div className="pcard__name">{pickLang(product.name, lang)}</div>
        <div className="pcard__price">
          {prices.length > 1
            ? formatPriceRange(minPrice, maxPrice, lang)
            : formatPrice(minPrice, lang)}
        </div>
        {showWishlistWarning && (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {dict.wishlist.loginRequiredDesc}{" "}
            <span
              role="link"
              tabIndex={0}
              style={{ textDecoration: "underline" }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/${lang}/login`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/${lang}/login`;
                }
              }}
            >
              {dict.wishlist.goLogin}
            </span>
          </p>
        )}
      </div>
    </Link>
  );
}
