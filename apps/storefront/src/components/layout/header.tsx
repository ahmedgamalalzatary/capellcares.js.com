"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import type { NavGroup } from "@/lib/nav";

interface Props {
  lang: Language;
  dict: any;
  navGroups: NavGroup[];
}

export function Header({ lang, dict, navGroups }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/${lang}/products?${params.toString()}`);
  };

  return (
    <header
      className={[
        "sticky top-0 z-30 border-b border-(--hairline) bg-(--bg)",
        scrolled
          ? "bg-[rgba(250,246,241,0.92)] shadow-[0_4px_18px_rgba(42,34,28,0.05)] backdrop-blur-sm"
          : ""
      ].join(" ")}
    >
      <div className="bg-(--ink) px-4 py-2 text-center text-[12px] tracking-[0.08em] text-[#faf6f1]">
        {lang === "ar"
          ? "شحن مجاني داخل القاهرة للطلبات فوق 600 جنيه"
          : "Free Cairo delivery on orders over EGP 600"}
      </div>

      <div className="container grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 py-4 max-[880px]:grid-cols-[auto_1fr_auto]">
        <button
          className="hidden h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent p-1 text-(--ink) max-[880px]:inline-flex"
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
        >
          <Icon.Menu />
        </button>

        <Link href={`/${lang}`} className="inline-flex min-w-max items-center gap-2.5" aria-label={dict.brand}>
          <span
            className={[
              "text-[22px] font-medium tracking-[0.01em] text-(--ink)",
              lang === "ar" ? "font-bold font-(--font-display)" : "font-(--font-display)"
            ].join(" ")}
          >
            {dict.brand}
          </span>
        </Link>

        <form
          className="flex h-11 w-full max-w-[520px] items-center gap-2.5 justify-self-end rounded-full border border-(--hairline) bg-(--bg-elev) px-[18px] py-2 text-(--ink-2) transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgba(161,59,75,0.08)] max-[880px]:hidden"
          onSubmit={onSearch}
        >
          <Icon.Search />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-(--ink) outline-none placeholder:text-(--ink-3)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dict.nav.search}
            aria-label={dict.nav.search}
          />
        </form>

        <div className="inline-flex items-center gap-1">
          <button
            className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--bg-tint)"
            onClick={switchLang}
            aria-label="Language"
            title="Language"
          >
            <Icon.Globe />
            <span className="absolute bottom-1 right-1 text-[9px] font-semibold">{dict.langSwitch.short}</span>
          </button>

          {user && (
            <Link href={`/${lang}/orders`} className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--bg-tint)" aria-label={dict.nav.orders}>
              <Icon.User />
            </Link>
          )}

          <Link href={`/${lang}/wishlist`} className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--bg-tint)" aria-label={dict.nav.wishlist}>
            <Icon.Heart />
            {ids.length > 0 && (
              <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-(--ink) px-1 text-[10px] font-semibold leading-none text-white">
                {ids.length}
              </span>
            )}
          </Link>

          {!user && (
            <Link href={`/${lang}/login`} className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--bg-tint)" aria-label={dict.nav.account}>
              <Icon.User />
            </Link>
          )}

          <Link href={`/${lang}/cart`} className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--bg-tint)" aria-label={dict.nav.cart}>
            <Icon.Cart />
            {count > 0 && (
              <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      <nav className="border-t border-(--hairline) bg-[rgba(250,246,241,0.9)] py-2.5 max-[880px]:hidden" aria-label="Primary">
        <div className="container flex flex-wrap justify-center gap-7">
          <Link href={`/${lang}/products`} className="px-1 py-2 text-[13px] uppercase tracking-[0.06em] text-(--ink-2) transition-colors hover:text-accent">
            {dict.nav.products}
          </Link>
          <Link href={`/${lang}/offers`} className="px-1 py-2 text-[13px] uppercase tracking-[0.06em] text-(--ink-2) transition-colors hover:text-accent">
            {dict.nav.offers}
          </Link>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-100 grid grid-rows-[auto_1fr] bg-(--bg)" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between border-b border-(--hairline) px-5 py-4">
            <span className="text-[20px] font-(--font-display)">{dict.brand}</span>
            <button
              className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink) hover:bg-(--bg-tint)"
              onClick={() => setMobileOpen(false)}
              aria-label="Close"
            >
              <Icon.Close />
            </button>
          </div>

          <div className="grid gap-0 overflow-y-auto px-5 pb-8 pt-3">
            <Link onClick={() => setMobileOpen(false)} href={`/${lang}/products`} className="border-b border-(--hairline) px-2 py-4 text-base">
              {dict.nav.products}
            </Link>
            <Link onClick={() => setMobileOpen(false)} href={`/${lang}/offers`} className="border-b border-(--hairline) px-2 py-4 text-base">
              {dict.nav.offers}
            </Link>
            {user ? (
              <Link onClick={() => setMobileOpen(false)} href={`/${lang}/orders`} className="border-b border-(--hairline) px-2 py-4 text-base">
                {dict.nav.orders}
              </Link>
            ) : null}

            <div className="px-2 pb-1 pt-5 text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
              {dict.nav.categories}
            </div>
            {navGroups.slice(2).map((g) => (
              <Link
                key={g.root.id}
                onClick={() => setMobileOpen(false)}
                href={`/${lang}/category/${g.root.slug}`}
                className="border-b border-(--hairline) px-2 py-4 text-base"
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

