"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { HeaderMobileDrawer } from "./header/mobile-drawer";
import { AnnouncementBar } from "./header/announcement-bar";
import { ShopMegaMenu } from "./header/shop-mega-menu";
import { SearchOverlay } from "./header/search-overlay";
import { useHeaderSearch } from "../../hooks/use-search";
import type { HeaderProps } from "../../types/header.types";

export function Header({ lang, dict, menuEntries }: HeaderProps) {
  const { count } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isAr = lang === "ar";
  const { switchLang } = useHeaderSearch(lang);

  const announcements: string[] = Array.isArray(dict.nav.announcements)
    ? dict.nav.announcements
    : [dict.nav.announcement];

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
        "container sticky top-0 z-30 transition-[background,box-shadow] duration-200"
      ].join(" ")}
    >
      <AnnouncementBar items={announcements} isAr={isAr} pauseLabel={dict.nav.pause} playLabel={dict.nav.play} />

      <div className="grid border items-center mt-4 bg-canvas rounded-t-lg min-[880px]:rounded-t-lg gap-2 max-[430px]:gap-1 p-2 max-[430px]:p-1.5 grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 items-center">
          {/* Mobile left cluster: menu · login */}
          <div className="inline-flex items-center gap-0.5 min-[880px]:hidden">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-1 text-ink max-[430px]:h-8 max-[430px]:w-8 sm:h-10 sm:w-10"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <Icon.Close /> : <Icon.Menu />}
            </button>
            <Link
              href={user ? `/${lang}/orders` : `/${lang}/login`}
              className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft) max-[430px]:h-8 max-[430px]:w-8"
              aria-label={user ? dict.nav.orders : dict.nav.account}
            >
              <Icon.User />
            </Link>
          </div>

          {/* Desktop left cluster: lang · search · shop */}
          <div className="hidden min-[880px]:flex items-center gap-0.5">
            <button
              className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              onClick={switchLang}
              aria-label="Language"
              title="Language"
            >
              <Icon.Globe />
              <span className="absolute bottom-1 right-1 text-xs font-semibold">{dict.langSwitch.short}</span>
            </button>
            <button
              className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              onClick={() => setSearchOpen((s) => !s)}
              aria-label={dict.nav.search}
              aria-expanded={searchOpen}
              title={dict.nav.search}
            >
              <Icon.Search />
            </button>
            <ShopMegaMenu lang={lang} dict={dict} menuEntries={menuEntries} isAr={isAr} />
          </div>
        </div>

        <Link
          href={`/${lang}`}
          className="group flex min-w-0 flex-col items-center justify-self-center gap-0.5 leading-none"
          aria-label={dict.brand}
        >
          <Icon.Eye
            size={44}
            className="h-auto w-11 text-(--gold-deep) transition-transform duration-200 group-hover:scale-105 max-[430px]:w-9"
          />
          <span className="gilt-text font-(--font-display) text-lg font-semibold tracking-[0.42em] ps-[0.42em] max-[430px]:text-sm max-[430px]:tracking-[0.26em] max-[430px]:ps-[0.26em] sm:text-xl">
            HORUS
          </span>
          <span className="text-[0.55rem] tracking-[0.5em] text-(--gold-deep) ps-[0.5em] max-[430px]:text-[0.5rem] max-[430px]:tracking-[0.32em] max-[430px]:ps-[0.32em]">
            SILVER
          </span>
        </Link>

        <div className="flex min-w-0 items-center justify-end">
          {/* Mobile cluster: wishlist · cart */}
          <div className="inline-flex items-center gap-0.5 min-[880px]:hidden ">
            <Link href={`/${lang}/wishlist`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft) max-[430px]:h-8 max-[430px]:w-8" aria-label={dict.nav.wishlist}>
              <Icon.Heart />
              {ids.length > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-xs font-semibold leading-none text-canvas">{ids.length}</span>}
            </Link>
            <Link href={`/${lang}/cart`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft) max-[430px]:h-8 max-[430px]:w-8" aria-label={dict.nav.cart}>
              <Icon.Cart />
              {count > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-xs font-semibold leading-none text-canvas">{count}</span>}
            </Link>
          </div>

          {/* Desktop right cluster: cart · wishlist · login */}
          <div className="hidden min-[880px]:inline-flex items-center gap-0.5 sm:gap-1">
            <Link href={`/${lang}/cart`} className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.cart}>
              <Icon.Cart />
              {count > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-xs font-semibold leading-none text-canvas">{count}</span>}
            </Link>
            <Link href={`/${lang}/wishlist`} className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.wishlist}>
              <Icon.Heart />
              {ids.length > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-xs font-semibold leading-none text-canvas">{ids.length}</span>}
            </Link>
            <Link
              href={user ? `/${lang}/orders` : `/${lang}/login`}
              className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              aria-label={user ? dict.nav.orders : dict.nav.account}
            >
              <Icon.User />
            </Link>
          </div>
        </div>
      </div>

      <SearchOverlay lang={lang} dict={dict} open={searchOpen} onClose={() => setSearchOpen(false)} />

      <HeaderMobileDrawer
        lang={lang}
        dict={dict}
        menuEntries={menuEntries}
        isAr={isAr}
        mobileOpen={mobileOpen}
        user={user}
        onClose={() => setMobileOpen(false)}
        onSwitchLang={switchLang}
        onOpenSearch={() => {
          setMobileOpen(false);
          setSearchOpen(true);
        }}
      />
    </header>
  );
}
