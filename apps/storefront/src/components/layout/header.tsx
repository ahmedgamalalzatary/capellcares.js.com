"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { authHref } from "@/lib/auth-redirect";
import { compareHeaderCategoryEntries, type HeaderMenuEntry } from "@/lib/header-menu";
import { buildCategoryHref } from "@/lib/category-links";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { HeaderMobileDrawer } from "./header/mobile-drawer";
import { AnnouncementBar } from "./header/announcement-bar";
import { SearchOverlay } from "./header/search-overlay";
import { useLanguageSwitch } from "../../hooks/use-language-switch";
import type { HeaderProps } from "../../types/header.types";

export function Header({ lang, dict, menuEntries, brands = [], genders = [], announcements: cmsAnnouncements, bestsellers = [] }: HeaderProps) {
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

  // Main categories in the same order as the menu, for the search screen's category buttons.
  const searchCategories = useMemo(() => menuEntries
    .filter((entry): entry is Extract<HeaderMenuEntry, { type: "category" }> => entry.type === "category")
    .slice()
    .sort(compareHeaderCategoryEntries)
    .map((category) => ({ key: category.key, label: category.label, href: buildCategoryHref(lang, { id: category.id, slug: category.slug }) })), [menuEntries, lang]);

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
        <AnnouncementBar items={announcements} isAr={isAr} pauseLabel={dict.nav.pause} playLabel={dict.nav.play} />
      ) : null}

      {/* Full page width, in the page background colour (--page-bg), flush under the announcement bar. While the menu or search is open it must rise above the floating WhatsApp button (z-50). */}
      <header className={`sticky top-0 ${mobileOpen || searchOpen ? "z-60" : "z-30"} bg-(--page-bg) min-[880px]:border-b min-[880px]:border-(--hairline)`}>
      <div className="container">
      <div className="grid items-center gap-2 py-1.5 sm:gap-4 grid-cols-[1fr_auto_1fr] min-[880px]:grid-cols-[auto_auto_1fr_auto] min-[880px]:gap-8">
        {/* Mobile left cluster: menu · login */}
        <div className="flex items-center min-[880px]:hidden">
          <div className="inline-flex items-center justify-center gap-2">
            {/* First icon: as wide as the icon so it sits flush with the container edge. */}
            <button
              className="inline-flex h-9 items-center justify-center border-0 bg-transparent p-0 text-ink sm:h-10"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? dict.media?.close ?? "Close" : "Menu"}
              aria-expanded={mobileOpen}
            >
              <MenuToggle open={mobileOpen} />
            </button>
            <Link
              href={accountHref}
              className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              aria-label={user ? dict.nav.orders : dict.nav.account}
            >
              <Icon.User size={24} />
            </Link>
          </div>
        </div>

        <Link
          href={`/${lang}/shop`}
          className="group flex items-center justify-self-center min-[880px]:justify-self-start"
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

        {/* Desktop: quick links between the logo and the search bar. The shop page is the home page. */}
        <nav aria-label={dict.nav.home} className="hidden items-center gap-6 min-[880px]:flex">
          <Link href={`/${lang}/shop`} className="text-base font-bold text-ink transition-colors hover:text-(--violet)">
            {dict.nav.home}
          </Link>
          <Link href={`/${lang}/products`} className="text-base font-bold text-ink transition-colors hover:text-(--violet)">
            {dict.nav.categories}
          </Link>
        </nav>

        {/* Desktop: the big search bar. It opens the same overlay as phones, which holds the live results. */}
        <SearchBar
          testId="desktop-search"
          label={dict.nav.search}
          buttonLabel={dict.nav.searchButton}
          onClick={() => setSearchOpen(true)}
          expanded={searchOpen}
          className="hidden h-12 rounded-md min-[880px]:flex"
        />

        <div className="flex items-center justify-end">
          {/* Mobile cluster: wishlist · cart */}
          <div className="inline-flex items-center gap-2 min-[880px]:hidden">
            <Link href={`/${lang}/wishlist`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)" aria-label={dict.nav.wishlist}>
              <Icon.Heart size={24} />
              {ids.length > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-(--magenta) px-1 text-xs font-bold leading-none text-white">{ids.length}</span>}
            </Link>
            {/* Last icon: as wide as the icon so it sits flush with the container edge. */}
            <Link href={`/${lang}/cart`} className="relative grid h-9 place-items-center border-0 bg-transparent text-ink" aria-label={dict.nav.cart}>
              <Icon.Cart size={24} />
              {cartCount > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-(--sunny) px-1 text-xs font-bold leading-none text-ink">{cartCount}</span>}
            </Link>
          </div>

          {/* Desktop right cluster: language · wishlist · cart · login */}
          <div className="hidden min-[880px]:inline-flex items-center gap-0.5 sm:gap-1">
            <button
              className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-(--warm-soft)"
              onClick={switchLang}
              aria-label="Language"
              title="Language"
            >
              <Icon.Globe size={24} />
              <span className="absolute bottom-1 right-1 text-xs font-semibold">{dict.langSwitch.short}</span>
            </button>
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

      </div>

      {/* Phones and tablets: search is always on show under the logo row, inside the page container. It opens the same overlay as desktop, which holds the live results. */}
      <div className="container min-[880px]:hidden">
        <SearchBar
          label={dict.nav.search}
          buttonLabel={dict.nav.searchButton}
          onClick={() => setSearchOpen(true)}
          expanded={searchOpen}
          className="flex h-12"
        />
      </div>

      <SearchOverlay lang={lang} dict={dict} open={searchOpen} onClose={() => setSearchOpen(false)} bestsellers={bestsellers} categories={searchCategories} />

      <HeaderMobileDrawer
        lang={lang}
        dict={dict}
        menuEntries={menuEntries}
        brands={brands}
        genders={genders}
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

/** A box with a purple (#91008d) "Search" button joined to its end. It only opens the search screen, which holds the real input and the live results. */
function SearchBar({ label, buttonLabel, onClick, expanded, className, testId }: {
  label: string;
  buttonLabel?: string;
  onClick: () => void;
  expanded: boolean;
  className: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-expanded={expanded}
      className={`w-full items-stretch overflow-hidden border border-ink bg-surface text-start ${className}`}
    >
      <span className="flex min-w-0 flex-1 items-center px-4 text-(--ink-3)">
        <span className="truncate">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 bg-(--violet) px-4 font-bold text-white sm:px-5">
        <Icon.Search size={20} />
        {buttonLabel ? <span className="max-[359px]:sr-only">{buttonLabel}</span> : null}
      </span>
    </button>
  );
}

/** Three bars that turn into an X while the menu is open: the outer bars fade and the whole icon turns. The viewBox is cropped to the bars (x 3–21) so no blank space sits beside them. */
function MenuToggle({ open }: { open: boolean }) {
  const ease = "ease-[cubic-bezier(0.76,0,0.24,1)] motion-reduce:transition-none";
  return (
    <svg width={18} height={24} viewBox="3 0 18 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"
      className={`transition-transform duration-500 ${ease} ${open ? "rotate-90" : ""}`}>
      <line x1="4" y1="7" x2="20" y2="7" className={`origin-center transition-transform duration-500 ${ease} ${open ? "translate-y-[5px] rotate-45" : ""}`} style={{ transformBox: "fill-box" }} />
      <line x1="4" y1="12" x2="20" y2="12" className={`transition-opacity duration-300 ${open ? "opacity-0" : ""}`} />
      <line x1="4" y1="17" x2="20" y2="17" className={`origin-center transition-transform duration-500 ${ease} ${open ? "-translate-y-[5px] -rotate-45" : ""}`} style={{ transformBox: "fill-box" }} />
    </svg>
  );
}
