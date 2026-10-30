"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authHref } from "@/lib/auth-redirect";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { HeaderMobileDrawer } from "./header/mobile-drawer";
import { AnnouncementBar } from "./header/announcement-bar";
import { ShopMegaMenu } from "./header/shop-mega-menu";
import { SearchOverlay } from "./header/search-overlay";
import { useLanguageSwitch } from "../../hooks/use-language-switch";
import type { HeaderProps } from "../../types/header.types";

export function Header({ lang, dict, menuEntries, announcements: cmsAnnouncements }: HeaderProps) {
  const { count } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  // Signing in from the header should return the customer to the page they were reading, not drop them on the locale home.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const accountHref = user
    ? `/${lang}/orders`
    : authHref("login", lang, `${pathname}${search ? `?${search}` : ""}`);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // The cart lives in this browser, so the server can't know the count; it appears once the page is running here.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cartCount = mounted ? count : 0;
  const isAr = lang === "ar";
  const { switchLang } = useLanguageSwitch(lang);

  const announcements: string[] = cmsAnnouncements
    ?? (Array.isArray(dict.nav.announcements) ? dict.nav.announcements : [dict.nav.announcement]);

  // Non-shifting scroll lock: freeze <html> with overflow:hidden and pad for the removed scrollbar, so the page never moves and the sticky header/measured drawer height stay valid regardless of scroll offset.
  // (A position:fixed/top:-scrollY lock fights globals' `overflow-x: clip` body + sticky header — it shifts the drawer on a scrolled reopen and breaks its inner scroll.)
  useEffect(() => {
    if (!mobileOpen) return;
    const html = document.documentElement;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    const prevOverflow = html.style.overflow;
    const prevPaddingRight = html.style.paddingRight;
    html.style.overflow = "hidden";
    if (scrollbarWidth > 0) html.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPaddingRight;
    };
  }, [mobileOpen]);

  // The announcement bar scrolls away with the page; only the nav row below is sticky. They must be siblings (not nested) because a sticky element can never escape its parent's box — wrapping both in one sticky <header> would pin the announcement bar too.
  return (
    <>
      {announcements.length > 0 ? (
      <div>
        <AnnouncementBar items={announcements} isAr={isAr} pauseLabel={dict.nav.pause} playLabel={dict.nav.play} />
      </div>
      ) : null}

      <header
        className={[
          // bg-surface matches the white page body: it fills the notches outside the nav row's rounded top corners so scrolling content can't peek through them while the header is stuck.
          // While the menu or search is open the header must also rise above the floating WhatsApp button (z-50).
          `sticky top-0 ${mobileOpen || searchOpen ? "z-60" : "z-30"} bg-surface shadow-[0_3px_0_var(--accent-soft)]`
        ].join(" ")}
      >
      <div className="container grid items-center gap-2 py-1.5 sm:gap-4 grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center">
          {/* Mobile left cluster: menu · login */}
          <div className="inline-flex items-center justify-center gap-0.5 min-[880px]:hidden">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-1 text-ink sm:h-10 sm:w-10"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              <Icon.Menu size={24} />
            </button>
            <Link
              href={accountHref}
              className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              aria-label={user ? dict.nav.orders : dict.nav.account}
            >
              <Icon.User size={24} />
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
              <Icon.Globe size={24} />
              <span className="absolute bottom-1 right-1 text-xs font-semibold">{dict.langSwitch.short}</span>
            </button>
            <button
              className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              onClick={() => setSearchOpen((s) => !s)}
              aria-label={dict.nav.search}
              aria-expanded={searchOpen}
              title={dict.nav.search}
            >
              <Icon.Search size={24} />
            </button>
            <ShopMegaMenu lang={lang} dict={dict} menuEntries={menuEntries} isAr={isAr} />
          </div>
        </div>

        <Link
          href={`/${lang}/shop`}
          className="group flex items-center justify-self-center"
          aria-label={dict.brand}
        >
          <Image
            src="/logo-header.png"
            alt={dict.brand}
            width={429}
            height={604}
            priority
            className="h-14 w-auto object-contain sm:h-[68px]"
          />
        </Link>

        <div className="flex items-center justify-end">
          {/* Mobile cluster: wishlist · cart */}
          <div className="inline-flex items-center gap-0.5 min-[880px]:hidden">
            <Link href={`/${lang}/wishlist`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.wishlist}>
              <Icon.Heart size={24} />
              {ids.length > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-(--magenta) px-1 text-xs font-bold leading-none text-white">{ids.length}</span>}
            </Link>
            <Link href={`/${lang}/cart`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.cart}>
              <Icon.Cart size={24} />
              {cartCount > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-(--sunny) px-1 text-xs font-bold leading-none text-ink">{cartCount}</span>}
            </Link>
          </div>

          {/* Desktop right cluster: wishlist · cart · login */}
          <div className="hidden min-[880px]:inline-flex items-center gap-0.5 sm:gap-1">
            <Link href={`/${lang}/wishlist`} className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.wishlist}>
              <Icon.Heart size={24} />
              {ids.length > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-(--magenta) px-1 text-xs font-bold leading-none text-white">{ids.length}</span>}
            </Link>
            <Link href={`/${lang}/cart`} className="relative grid h-10 w-10 place-items-center rounded-full bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.cart}>
              <Icon.Cart size={24} />
              {cartCount > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-(--sunny) px-1 text-xs font-bold leading-none text-ink">{cartCount}</span>}
            </Link>
            <Link
              href={accountHref}
              className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              aria-label={user ? dict.nav.orders : dict.nav.account}
            >
              <Icon.User size={24} />
            </Link>
          </div>
        </div>
      </div>

      {/* Phones and tablets: search is always on show. It opens the same overlay as desktop, which holds the live results. */}
      <div className="container pb-2 min-[880px]:hidden">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-11 w-full items-center gap-2.5 rounded-(--radius-pill) border border-(--hairline) bg-(--surface-2) px-4 text-start text-(--ink-3) transition-colors hover:border-warm"
        >
          <Icon.Search />
          <span className="min-w-0 flex-1 truncate">{dict.nav.search}</span>
        </button>
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
        accountHref={accountHref}
        onSwitchLang={switchLang}
      />
      </header>
    </>
  );
}
