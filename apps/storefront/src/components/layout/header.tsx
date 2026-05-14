"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { buildNav } from "@/lib/nav";
import styles from "./header.module.css";

interface Props {
  lang: Language;
  dict: any;
}

export function Header({ lang, dict }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = buildNav(lang);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const switchLang = () => {
    const next: Language = lang === "ar" ? "en" : "ar";
    const rest = pathname.replace(/^\/(ar|en)/, "") || "/";
    router.push(`/${next}${rest === "/" ? "" : rest}`);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/${lang}/products?${params.toString()}`);
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.announce}>
        {lang === "ar"
          ? "شحن مجاني داخل القاهرة للطلبات فوق 600 جنيه"
          : "Free Cairo delivery on orders over EGP 600"}
      </div>
      <div className={`container ${styles.bar}`}>
        <button className={styles.menuBtn} onClick={() => setMobileOpen(true)} aria-label="Menu">
          <Icon.Menu />
        </button>
        <Link href={`/${lang}`} className={styles.brand} aria-label={dict.brand}>
          <Icon.Logo size={32} />
          <span className={styles.brandWord}>{dict.brand}</span>
        </Link>
        <form className={styles.searchForm} onSubmit={onSearch}>
          <Icon.Search />
          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dict.nav.search}
            aria-label={dict.nav.search}
          />
        </form>
        <div className={styles.actions}>
          <button className={styles.iconBtn} onClick={switchLang} aria-label="Language" title="Language">
            <Icon.Globe />
            <span className={styles.iconLabel}>{dict.langSwitch.short}</span>
          </button>
          <Link href={`/${lang}/${user ? "wishlist" : "wishlist"}`} className={styles.iconBtn} aria-label={dict.nav.wishlist}>
            <Icon.Heart />
            {ids.length > 0 && <span className={styles.badgeDot}>{ids.length}</span>}
          </Link>
          <Link href={`/${lang}/${user ? "wishlist" : "login"}`} className={styles.iconBtn} aria-label={dict.nav.account}>
            <Icon.User />
          </Link>
          <Link href={`/${lang}/cart`} className={styles.iconBtn} aria-label={dict.nav.cart}>
            <Icon.Cart />
            {count > 0 && <span className={styles.badgeDot} data-accent>{count}</span>}
          </Link>
        </div>
      </div>
      <nav className={styles.nav} aria-label="Primary">
        <div className="container" style={{ display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
          <Link href={`/${lang}/products`} className={styles.navLink}>{dict.nav.products}</Link>
          {groups.slice(2, 8).map((g) => (
            <div className={styles.navItem} key={g.root.id}>
              <Link href={`/${lang}/category/${g.root.slug}`} className={styles.navLink}>
                {lang === "ar" ? g.root.name.ar : g.root.name.en}
                {g.children.length > 0 && <Icon.Chevron size={14} className="arrow-flip" />}
              </Link>
              {g.children.length > 0 && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownInner}>
                    <div className={styles.dropdownGrid}>
                      {g.children.map((c) => (
                        <Link key={c.id} href={`/${lang}/category/${c.slug}`} className={styles.dropdownLink}>
                          {c.label}
                        </Link>
                      ))}
                    </div>
                    <Link href={`/${lang}/category/${g.root.slug}`} className={styles.dropdownAll}>
                      {dict.nav.allCategories} →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link href={`/${lang}/offers`} className={`${styles.navLink} ${styles.navLinkAccent}`}>{dict.nav.offers}</Link>
        </div>
      </nav>

      {mobileOpen && (
        <div className={styles.sheet} role="dialog" aria-modal="true">
          <div className={styles.sheetHead}>
            <span className="display" style={{ fontSize: 20 }}>{dict.brand}</span>
            <button className={styles.iconBtn} onClick={() => setMobileOpen(false)} aria-label="Close">
              <Icon.Close />
            </button>
          </div>
          <div className={styles.sheetBody}>
            <Link onClick={() => setMobileOpen(false)} href={`/${lang}/products`} className={styles.sheetLink}>{dict.nav.products}</Link>
            <Link onClick={() => setMobileOpen(false)} href={`/${lang}/offers`} className={styles.sheetLink}>{dict.nav.offers}</Link>
            <div className={styles.sheetSection}>{dict.nav.categories}</div>
            {groups.slice(2).map((g) => (
              <Link
                key={g.root.id}
                onClick={() => setMobileOpen(false)}
                href={`/${lang}/category/${g.root.slug}`}
                className={styles.sheetLink}
              >
                {lang === "ar" ? g.root.name.ar : g.root.name.en}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
