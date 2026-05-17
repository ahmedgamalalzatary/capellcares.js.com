"use client";

import Link from "next/link";
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
  const router = useRouter();
  const { has, toggle } = useWishlist();
  const { user } = useAuth();
  const prices = product.variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const { isNew, isBestseller, isOffer, isOutOfStock } = getProductBadgeState(product);

  const onWish = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    toggle(product.id);
  };

  return (
    <Link href={`/${lang}/products/${product.slug}`} className="pcard">
      <div className="pcard__img">
        <ProductIllustration product={product} />
      </div>
      <div className="pcard__badges">
        {isNew && <span className="badge badge--new">{dict.badges.new}</span>}
        {isBestseller && <span className="badge badge--gold">{dict.badges.bestseller}</span>}
        {isOffer && <span className="badge badge--offer">{dict.badges.offer}</span>}
        {isOutOfStock && <span className="badge">{dict.common.outOfStock}</span>}
      </div>
      <button className="pcard__wish" data-active={has(product.id)} aria-label={dict.common.addToWishlist} onClick={onWish}>
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
      </div>
    </Link>
  );
}
