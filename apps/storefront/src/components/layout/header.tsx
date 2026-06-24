"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { HeaderMobileDrawer } from "./header/mobile-drawer";
import { useHeaderSearch } from "../../hooks/use-search";
import type { HeaderProps } from "../../types/header.types";
import type { HeaderMenuEntry } from "@/lib/header-menu";

function entryHref(lang: string, entry: HeaderMenuEntry): string {
  return entry.type === "category"
    ? `/${lang}/category/${entry.slug}`
    : `/${lang}/${entry.slug}`;
}

export function Header({ lang, dict, menuEntries }: HeaderProps) {
  const { count } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAr = lang === "ar";
  const { q, onSearch, onSearchInput, switchLang } = useHeaderSearch(lang);

  const announcements: string[] = Array.isArray(dict.nav.announcements)
    ? dict.nav.announcements
    : [dict.nav.announcement];

  // Nav row: NEW first, then the first 4 categories.
  const newEntry = menuEntries.find((entry) => entry.key === "new");
  const categoryEntries = menuEntries.filter((entry) => entry.type === "category").slice(0, 4);
  const navEntries: HeaderMenuEntry[] = [...(newEntry ? [newEntry] : []), ...categoryEntries];

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
    <header className="sticky top-0 z-30">
      {/* Row 1 — segmented announcement bar (navy) */}
      <div className="bg-ink text-white">
        <div className="flex items-stretch overflow-hidden text-[11px] font-semibold tracking-wide sm:text-xs">
          {announcements.map((msg, i) => (
            <div
              key={i}
              className={[
                "flex-1 whitespace-nowrap px-3 py-2 text-center",
                i > 0 ? "border-s border-white/20" : "",
                i > 1 ? "hidden md:block" : ""
              ].join(" ")}
            >
              {msg}
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — main bar (logo · search · tools) */}
      <div
        className={[
          "border-b border-(--hairline) transition-[background,box-shadow] duration-200",
          scrolled ? "bg-white/95 shadow-(--shadow-1) backdrop-blur-md" : "bg-(--warm-soft)"
        ].join(" ")}
      >
        <div className="container flex items-center gap-3 py-3 sm:gap-6 sm:py-4">
          {/* Mobile menu toggle */}

          <Link href={`/${lang}`} className="shrink-0" aria-label={dict.brand}>
            <Image
              src="/capella logo.png"
              alt={dict.brand}
              width={400}
              height={100}
              className="h-9 w-auto object-contain sm:h-12"
            />
          </Link>

          {/* Large pill search */}
          <form onSubmit={onSearch} className="relative flex-1" role="search">
            <input
              value={q}
              onChange={(e) => onSearchInput(e.target.value)}
              placeholder={dict.nav.search}
              aria-label={dict.nav.search}
              className="h-11 w-full rounded-full border border-(--hairline) bg-white ps-5 pe-14 text-sm text-ink outline-none transition-[border,box-shadow] placeholder:text-(--ink-3) focus:border-(--accent) focus:shadow-[0_0_0_4px_rgba(9,40,69,0.12)] sm:h-12"
            />
            <button
              type="submit"
              aria-label={dict.nav.search}
              className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border-0 bg-ink text-white transition-colors hover:bg-(--accent-deep) sm:h-9 sm:w-9"
            >
              <Icon.Search />
            </button>
          </form>

          {/* Tools */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              className="relative grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-white"
              onClick={switchLang}
              aria-label={dict.nav.language}
              title={dict.nav.language}
            >
              <Icon.Globe />
              <span className="absolute bottom-1 end-1 text-[10px] font-semibold">{dict.langSwitch.short}</span>
            </button>

            <Link
              href={user ? `/${lang}/orders` : `/${lang}/login`}
              className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink transition-colors hover:bg-white"
              aria-label={user ? dict.nav.account : dict.nav.login}
            >
              <Icon.User />
            </Link>
          </div>
        </div>
      </div>

      {/* Row 3 — nav bar */}
      <div className="hidden border-b border-(--hairline) bg-white min-[880px]:block">
        <div className="container flex items-center justify-between">
          <nav className="flex items-center gap-1">
            <Link
              href={`/${lang}`}
              className="px-3 py-3.5 text-[13px] font-semibold uppercase tracking-wide text-ink transition-colors hover:text-(--accent-deep)"
            >
              {dict.common.breadcrumbHome}
            </Link>
            {navEntries.map((entry) => {
              const hasMenu = entry.type === "category" && entry.children.length > 0;
              return (
                <Link
                  key={entry.key}
                  href={entryHref(lang, entry)}
                  className="inline-flex items-center gap-1 px-3 py-3.5 text-[13px] font-semibold uppercase tracking-wide text-ink transition-colors hover:text-(--accent-deep)"
                >
                  {entry.label}
                  {hasMenu && <Icon.Chevron />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={`/${lang}/wishlist`}
              className="relative inline-flex items-center gap-1.5 px-2 py-3.5 text-[13px] font-semibold text-ink transition-colors hover:text-(--accent-deep)"
              aria-label={dict.nav.wishlist}
            >
              <Icon.Heart />
              <span>{ids.length}</span>
            </Link>
            <Link
              href={`/${lang}/cart`}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink ps-4 pe-5 text-[13px] font-semibold text-white transition-colors hover:bg-(--accent-deep)"
              aria-label={dict.nav.cart}
            >
              <span className="relative grid place-items-center">
                <Icon.Cart />
                {count > 0 && (
                  <span className="absolute -end-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-(--warm) px-1 text-[10px] font-bold leading-none text-ink">
                    {count}
                  </span>
                )}
              </span>
              <span>{count} {dict.footer.currency}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile cart/wishlist quick row */}
      <div className="flex items-center justify-end gap-1 border-b border-(--hairline) bg-white px-4 py-2 min-[880px]:hidden">
        <Link href={`/${lang}/wishlist`} className="relative grid h-9 w-9 place-items-center rounded-full text-ink" aria-label={dict.nav.wishlist}>
          <Icon.Heart />
          {ids.length > 0 && <span className="absolute end-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-white">{ids.length}</span>}
        </Link>
        <Link href={`/${lang}/cart`} className="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white" aria-label={dict.nav.cart}>
          <Icon.Cart />
          <span>{count} {dict.footer.currency}</span>
        </Link>
      </div>

      <HeaderMobileDrawer
        lang={lang}
        dict={dict}
        menuEntries={menuEntries}
        isAr={isAr}
        mobileOpen={mobileOpen}
        user={user}
        onClose={() => setMobileOpen(false)}
        onSwitchLang={switchLang}
        onOpenSearch={() => setMobileOpen(false)}
      />
    </header>
  );
}
