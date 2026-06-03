"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { type Language, type Product } from "@capella/shared";
import { fetchProducts } from "@/lib/api/client";
import { ProductCard } from "@/components/products/product-card";
import { Icon } from "@/components/ui/icons";

function EmptyShell({ isAr, icon, title, desc, ctaHref, ctaLabel }: {
  isAr: boolean; icon: React.ReactNode; title: string; desc: string; ctaHref: string; ctaLabel: string;
}) {
  return (
    <div className="mx-auto my-10 grid max-w-[480px] place-items-center gap-4 rounded-(--radius-lg) border border-(--hairline) bg-(--surface) px-6 py-12 text-center sm:my-16 sm:px-8 sm:py-14">
      <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-(--accent-soft) text-(--accent)">
        {icon}
      </div>
      <h2 className={`m-0 leading-[1.1] ${isAr
        ? "text-[26px] font-bold font-(--font-ar) text-(--ink)"
        : "text-[30px] italic font-(--font-display) text-(--ink)"}`}>
        {title}
      </h2>
      <p className="max-w-[44ch] text-[14.5px] leading-[1.7] text-(--ink-2)">{desc}</p>
      <Link href={ctaHref} className="btn btn--primary mt-1">{ctaLabel}</Link>
    </div>
  );
}

export function WishlistView({ lang, dict }: { lang: Language; dict: any }) {
  const { user } = useAuth();
  const { ids } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = lang === "ar";

  useEffect(() => {
    fetchProducts({ lang })
      .then((items) => {
        setProducts(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lang]);

  if (!user) {
    return (
      <EmptyShell
        isAr={isAr}
        icon={<Icon.Heart size={32} />}
        title={dict.wishlist.loginRequired}
        desc={dict.wishlist.loginRequiredDesc}
        ctaHref={`/${lang}/login`}
        ctaLabel={dict.wishlist.goLogin}
      />
    );
  }

  if (loading) return <p className="py-12 text-center text-(--ink-3)">{dict.common.loading}</p>;

  const items = products.filter((product) => ids.includes(product.id));
  if (items.length === 0) {
    return (
      <EmptyShell
        isAr={isAr}
        icon={<Icon.Heart size={32} />}
        title={dict.wishlist.empty}
        desc={dict.wishlist.savedEmpty}
        ctaHref={`/${lang}/products`}
        ctaLabel={dict.cart.keepShopping}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 pb-16 sm:gap-6 sm:pb-20 lg:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] lg:gap-7">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
      ))}
    </div>
  );
}
