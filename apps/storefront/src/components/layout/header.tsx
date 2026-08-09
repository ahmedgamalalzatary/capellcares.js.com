"use client";

import Image from "next/image";
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
import { useLanguageSwitch } from "../../hooks/use-language-switch";
import type { HeaderProps } from "../../types/header.types";

export function Header({ lang, dict, menuEntries }: HeaderProps) {
  const { count } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isAr = lang === "ar";
  const { switchLang } = useLanguageSwitch(lang);

  const announcements: string[] = Array.isArray(dict.nav.announcements)
    ? dict.nav.announcements
    : [dict.nav.announcement];

  // Non-shifting scroll lock: freeze <html> with overflow:hidden and pad for the
  // removed scrollbar. The page never moves, so the sticky header and the drawer's
  // measured open-height stay valid no matter the scroll offset at open time.
  // (A position:fixed/top:-scrollY lock fights globals' `overflow-x: clip` body +
  // the sticky header — it shifts the drawer on a scrolled reopen and breaks its
  // inner scroll.)
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

  // The announcement bar scrolls away with the page; only the nav row below is
  // sticky. They must be siblings (not nested) because a sticky element can
  // never escape its parent's box — wrapping both in one sticky <header> would
  // pin the announcement bar too.
  return (
    <>
      <div className="container">
        <AnnouncementBar items={announcements} isAr={isAr} pauseLabel={dict.nav.pause} playLabel={dict.nav.play} />
      </div>

      <header
        className={[
          // bg-surface matches the white page body: it fills the notches outside
          // the nav row's rounded top corners so scrolling content can't peek
          // through them while the header is stuck.
          "container sticky top-0 z-30 bg-surface transition-[background,box-shadow] duration-200"
        ].join(" ")}
      >
      <div className="grid items-center bg-canvas rounded-t-lg min-[880px]:rounded-t-lg gap-2 sm:gap-4 px-3 py-4 grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center">
          {/* Mobile left cluster: menu · login */}
          <div className="inline-flex items-center justify-center gap-0.5 min-[880px]:hidden scale-110">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-1 text-ink sm:h-10 sm:w-10 scale-130"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              <MenuToggle open={mobileOpen} />
            </button>
            <Link
              href={user ? `/${lang}/orders` : `/${lang}/login`}
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
          href={`/${lang}`}
          className="group flex items-center justify-self-center scale-130"
          aria-label={dict.brand}
        >
          <Image
            src="/logoblack.jpg"
            alt={dict.brand}
            width={400}
            height={100}
            className=" w-auto object-contain transition-transform duration-200 h-10 sm:h-14 "
          />
        </Link>

        <div className="flex items-center justify-end">
          {/* Mobile cluster: wishlist · cart */}
          <div className="inline-flex items-center gap-0.5 min-[880px]:hidden  scale-110">
            <Link href={`/${lang}/cart`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.cart}>
              <Icon.Cart size={24} />
              <span className="absolute right-1/4 top-1/8 grid min-h-4 min-w-4 place-items-center text-xs font-semibold leading-none">{count}</span>
            </Link>
            <Link href={`/${lang}/wishlist`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.wishlist}>
              <Icon.Heart size={24} />
              {ids.length > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-xs font-semibold leading-none text-canvas">{ids.length}</span>}
            </Link>
            
          </div>

          {/* Desktop right cluster: cart · wishlist · login */}
          <div className="hidden min-[880px]:inline-flex items-center gap-0.5 sm:gap-1">
            <Link href={`/${lang}/cart`} className="relative grid h-10 w-10 place-items-center rounded-full bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.cart}>
              <Icon.Cart size={24} />
              <span className="absolute right-1/4 top-1 grid min-h-4 min-w-4 place-items-center text-md font-bold leading-none  ">{count}</span>
            </Link>
            <Link href={`/${lang}/wishlist`} className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.wishlist}>
              <Icon.Heart size={24} />
              {ids.length > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-xs font-semibold leading-none text-canvas">{ids.length}</span>}
            </Link>
            <Link
              href={user ? `/${lang}/orders` : `/${lang}/login`}
              className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              aria-label={user ? dict.nav.orders : dict.nav.account}
            >
              <Icon.User size={24} />
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
    </>
  );
}

// Hamburger ⇄ minus morph, mirroring Rhode: the whole icon spins 180° while the
// top and bottom bars fade out, leaving the middle bar as a single "-". Same
// cubic-bezier(0.76, 0, 0.24, 1) used by the drawer reveal so they feel like one
// gesture. Reverses on close.
function MenuToggle({ open }: { open: boolean }) {
  const bar = "transition-opacity duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]";
  const barOpacity = open ? "opacity-0" : "opacity-100";
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className={`transition-transform duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] ${open ? "rotate-180" : "rotate-0"}`}
    >
      <line x1="4" y1="7" x2="20" y2="7" className={`${bar} ${barOpacity}`} />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" className={`${bar} ${barOpacity}`} />
    </svg>
  );
}
