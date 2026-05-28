"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  const isAr = lang === "ar";
  const imageMedia = useMemo(() => (product.media ?? []).filter((item) => item.type === "image"), [product.media]);
  const primaryImage = imageMedia[0]?.url ?? product.imagePath;
  const hoverImage = imageMedia[1]?.url ?? primaryImage;
  const [previewImage, setPreviewImage] = useState(primaryImage);

  const onWish = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    toggle(product.id);
  };

  return (
    <Link
      href={`/${lang}/products/${product.slug}`}
      className="group grid overflow-hidden rounded-(--radius-lg) border border-(--hairline) bg-(--surface) transition-all duration-200 hover:-translate-y-0.5 hover:border-(--warm) hover:shadow-(--shadow-2)"
      onMouseEnter={() => setPreviewImage(hoverImage)}
      onMouseLeave={() => setPreviewImage(primaryImage)}
    >
      <div className="relative aspect-4/5 overflow-hidden">
        <ProductIllustration
          product={{ ...product, imagePath: previewImage }}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
        />

        {/* Badges */}
        <div className="absolute top-3 start-3 flex flex-col gap-1.5 z-10">
          {isNew && <span className="badge badge--new">{dict.badges.new}</span>}
          {isBestseller && <span className="badge badge--gold">{dict.badges.bestseller}</span>}
          {isOffer && <span className="badge badge--offer">{dict.badges.offer}</span>}
          {isOutOfStock && <span className="badge">{dict.common.outOfStock}</span>}
        </div>

        {/* Wishlist */}
        <button
          className={`absolute top-3 end-3 z-10 grid h-9 w-9 place-items-center rounded-full text-(--ink) transition-all duration-150 hover:bg-(--warm-soft) hover:scale-105 ${has(product.id) ? "!bg-(--accent) !text-(--canvas) !border-(--accent)" : ""}`}
          aria-label={dict.common.addToWishlist}
          onClick={onWish}
        >
          {has(product.id) ? <Icon.HeartFill size={15} /> : <Icon.Heart size={15} />}
        </button>
      </div>

      <div className="grid gap-2 p-4 sm:p-5">
        <h3 className={`m-0 leading-[1.2] ${isAr
          ? "text-[16px] font-bold font-(--font-ar) text-(--ink)"
          : "text-[18px] italic font-(--font-display) text-(--ink)"}`}>
          {pickLang(product.name, lang)}
        </h3>

        <div className="mt-1 flex flex-wrap items-end gap-2 border-t border-(--hairline) pt-3">
          <span className={`leading-none text-(--accent) ${isAr
            ? "text-[20px] font-bold font-(--font-ar)"
            : "text-[22px] italic font-(--font-display)"}`}>
            {prices.length > 1
              ? formatPriceRange(minPrice, maxPrice, lang)
              : formatPrice(minPrice, lang)}
          </span>
        </div>
      </div>
    </Link>
  );
}
