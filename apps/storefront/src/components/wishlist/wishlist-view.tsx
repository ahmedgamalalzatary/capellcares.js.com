"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { type Language, type Product } from "@capella/shared";
import { fetchProducts } from "@/lib/api/client";
import { ProductCard } from "@/components/products/product-card";
import styles from "./wishlist.module.css";
import { Icon } from "@/components/ui/icons";

export function WishlistView({ lang, dict }: { lang: Language; dict: any }) {
  const { user } = useAuth();
  const { ids } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts({ lang }).then((items) => {
      setProducts(items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [lang]);

  if (!user) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateIcon}><Icon.Heart size={36} /></div>
        <h2 className="display" style={{ fontSize: 26, margin: 0 }}>{dict.wishlist.loginRequired}</h2>
        <p className="muted" style={{ maxWidth: "44ch" }}>{dict.wishlist.loginRequiredDesc}</p>
        <Link href={`/${lang}/login`} className="btn btn--primary">{dict.wishlist.goLogin}</Link>
      </div>
    );
  }

  if (loading) return <p className="muted" style={{ padding: 40 }}>…</p>;

  const items = products.filter((p) => ids.includes(p.id));
  if (items.length === 0) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateIcon}><Icon.Heart size={36} /></div>
        <p className="muted">{dict.wishlist.empty}</p>
        <Link href={`/${lang}/products`} className="btn btn--ghost">{dict.cart.keepShopping}</Link>
      </div>
    );
  }

  return (
    <div className="grid grid--products" style={{ paddingBottom: 80 }}>
      {items.map((p) => <ProductCard key={p.id} product={p} lang={lang} dict={dict} />)}
    </div>
  );
}
