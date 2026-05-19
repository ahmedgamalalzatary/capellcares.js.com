"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { type Language, type Product } from "@capella/shared";
import { fetchProducts } from "@/lib/api/client";
import { ProductCard } from "@/components/products/product-card";
import { Icon } from "@/components/ui/icons";

export function WishlistView({ lang, dict }: { lang: Language; dict: any }) {
  const { user } = useAuth();
  const { ids } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="grid place-items-center gap-3 py-20 text-center">
        <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-(--accent-soft) text-accent">
          <Icon.Heart size={36} />
        </div>
        <h2 className="m-0 text-[26px] font-(--font-display) leading-none">{dict.wishlist.loginRequired}</h2>
        <p className="max-w-[44ch] text-(--ink-2)">{dict.wishlist.loginRequiredDesc}</p>
        <Link href={`/${lang}/login`} className="btn btn--primary">
          {dict.wishlist.goLogin}
        </Link>
      </div>
    );
  }

  if (loading) return <p className="py-10 text-(--ink-2)">…</p>;

  const items = products.filter((product) => ids.includes(product.id));
  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-3 py-20 text-center">
        <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-(--accent-soft) text-accent">
          <Icon.Heart size={36} />
        </div>
        <p className="text-(--ink-2)">{dict.wishlist.empty}</p>
        <Link href={`/${lang}/products`} className="btn btn--ghost">
          {dict.cart.keepShopping}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 pb-20 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
      ))}
    </div>
  );
}

