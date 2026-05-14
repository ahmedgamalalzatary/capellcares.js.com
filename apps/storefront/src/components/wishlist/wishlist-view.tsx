"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { mock, type Language } from "@capella/shared";
import { ProductCard } from "@/components/products/product-card";
import styles from "./wishlist.module.css";
import { Icon } from "@/components/ui/icons";

export function WishlistView({ lang, dict }: { lang: Language; dict: any }) {
  const { user } = useAuth();
  const { ids } = useWishlist();

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

  const items = mock.products.filter((p) => ids.includes(p.id));
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
