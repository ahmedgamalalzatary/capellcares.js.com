"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { HeaderDesktopNav } from "./header/desktop-nav";
import { HeaderMobileDrawer } from "./header/mobile-drawer";
import { useHeaderSearch } from "../../hooks/use-search";
import type { HeaderProps } from "../../types/header.types";

export function Header({ lang, dict, navGroups }: HeaderProps) {
  const { count } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<"main" | "categories">("main");
  const isAr = lang === "ar";
  const { q, switchLang, onSearchInput, onSearch } = useHeaderSearch(lang);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflowY = "scroll";
    } else {
      const scrollY = Math.abs(parseInt(document.body.style.top || "0", 10));
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflowY = "";
      window.scrollTo(0, scrollY);
      setDrawerView("main");
    }
    return () => {
      const scrollY = Math.abs(parseInt(document.body.style.top || "0", 10));
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflowY = "";
      if (scrollY) window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

  return (
    <header
      className={[
        "sticky top-0 z-30 border-b border-black transition-[background,box-shadow] duration-200",
        scrolled
          ? "bg-white/90 shadow-(--shadow-1) backdrop-blur-md"
          : "bg-white"
      ].join(" ")}
    >
      <div className={`bg-ink px-4 py-2 text-center text-[11px] text-canvas sm:text-[12px] ${lang === "ar" ? "tracking-[0.04em]" : "tracking-[0.04em] sm:tracking-[0.12em]"}`}>
        {dict.nav.announcement}
      </div>

      <div className="container grid items-center gap-3 py-3 sm:gap-4 sm:py-4 max-[880px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[880px]:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-1 text-ink sm:h-10 sm:w-10 min-[880px]:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Icon.Menu />
          </button>
          <form
            className="hidden min-[880px]:flex h-11 w-full max-w-[380px] items-center gap-2.5 rounded-full border border-black bg-white px-4.5 py-2 text-(--ink-2) transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent)_18%,transparent)]"
            onSubmit={onSearch}
          >
            <Icon.Search />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-ink outline-none placeholder:text-(--ink-3)"
              value={q}
              onChange={(e) => onSearchInput(e.target.value)}
              placeholder={dict.nav.search}
              aria-label={dict.nav.search}
            />
          </form>
        </div>

        <Link href={`/${lang}`} className="group inline-flex min-w-0 items-center justify-self-center" aria-label={dict.brand}>
          <Image
            src="/image.jpeg"
            alt=""
            width={160}
            height={52}
            className="h-[38px] w-auto object-contain transition-opacity group-hover:opacity-80 sm:h-[46px] -mr-2"
            priority
          />

        </Link>

        <div className="flex items-center justify-end">
          <div className="inline-flex items-center gap-0.5 min-[880px]:hidden">
            <button className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" onClick={switchLang} aria-label="Language" title="Language">
              <Icon.Globe />
              <span className="absolute bottom-1 right-1 text-[9px] font-semibold">{dict.langSwitch.short}</span>
            </button>
            <Link href={`/${lang}/wishlist`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.wishlist}>
              <Icon.Heart />
              {ids.length > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-canvas">{ids.length}</span>}
            </Link>
            <Link href={`/${lang}/cart`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.cart}>
              <Icon.Cart />
              {count > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-canvas">{count}</span>}
            </Link>
          </div>
          <div className="hidden min-[880px]:inline-flex items-center gap-0.5 sm:gap-1">
            <button className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft) sm:h-10 sm:w-10" onClick={switchLang} aria-label="Language" title="Language">
              <Icon.Globe />
              <span className="absolute bottom-1 right-1 text-[9px] font-semibold">{dict.langSwitch.short}</span>
            </button>
            {user && (
              <Link href={`/${lang}/orders`} className="relative hidden h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft) sm:grid sm:h-10 sm:w-10" aria-label={dict.nav.orders}>
                <Icon.User />
              </Link>
            )}
            <Link href={`/${lang}/wishlist`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft) sm:h-10 sm:w-10" aria-label={dict.nav.wishlist}>
              <Icon.Heart />
              {ids.length > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-canvas">{ids.length}</span>}
            </Link>
            {!user && (
              <Link href={`/${lang}/login`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft) sm:h-10 sm:w-10" aria-label={dict.nav.account}>
                <Icon.User />
              </Link>
            )}
            <Link href={`/${lang}/cart`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft) sm:h-10 sm:w-10" aria-label={dict.nav.cart}>
              <Icon.Cart />
              {count > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-canvas">{count}</span>}
            </Link>
          </div>
        </div>

      </div>

      <HeaderDesktopNav lang={lang} dict={dict} navGroups={navGroups} />
      <HeaderMobileDrawer
        lang={lang}
        dict={dict}
        navGroups={navGroups}
        isAr={isAr}
        mobileOpen={mobileOpen}
        drawerView={drawerView}
        q={q}
        user={user}
        onClose={() => setMobileOpen(false)}
        onOpenCategories={() => setDrawerView("categories")}
        onBackToMain={() => setDrawerView("main")}
        onSearchInput={onSearchInput}
        onSearch={onSearch}
      />
    </header>
  );
}
