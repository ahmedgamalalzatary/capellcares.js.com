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
  const isAr = lang === "ar";

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
        "sticky top-0 z-30 border-b border-(--hairline) transition-[background,box-shadow] duration-200",
        scrolled
          ? "bg-white/90 shadow-(--shadow-1) backdrop-blur-md"
          : "bg-white"
      ].join(" ")}
    >
      <div className={`bg-ink px-4 py-2 text-center text-[11px] text-canvas sm:text-[12px] ${lang === "ar" ? "tracking-[0.04em]" : "tracking-[0.04em] sm:tracking-[0.12em]"}`}>
        {lang === "ar"
          ? "شحن مجاني داخل القاهرة للطلبات فوق ٦٠٠ جنيه · ادفع عند الاستلام"
          : "Free Cairo delivery on orders over EGP 600 · Cash on delivery"}
      </div>

      <div className="container grid items-center gap-3 py-3 sm:gap-4 sm:py-4 max-[880px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[880px]:grid-cols-[1fr_auto_1fr]">

        {/* ── Col 1: hamburger (mobile) · search (desktop) ─────── */}
        {/* RTL grid renders col1 on the physical RIGHT → search ends up on right in AR ✓ */}
        <div className="flex items-center">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-1 text-ink sm:h-10 sm:w-10 min-[880px]:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Icon.Menu />
          </button>
          <form
            className="hidden min-[880px]:flex h-11 w-full max-w-[380px] items-center gap-2.5 rounded-full border border-(--hairline) bg-white px-4.5 py-2 text-(--ink-2) transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent)_18%,transparent)]"
            onSubmit={onSearch}
          >
            <Icon.Search />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-ink outline-none placeholder:text-(--ink-3)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={dict.nav.search}
              aria-label={dict.nav.search}
            />
          </form>
        </div>

        {/* ── Col 2: Logo (always center) ──────────────────────── */}
        <Link href={`/${lang}`} className="group inline-flex min-w-0 items-center justify-self-center gap-2.5" aria-label={dict.brand}>
          <span className={["text-ink leading-none transition-colors group-hover:text-accent whitespace-nowrap", isAr ? "text-[20px] font-(--font-ar) font-bold tracking-normal sm:text-[26px]" : "text-[22px] font-(--font-display) italic tracking-[0.005em] sm:text-[28px]"].join(" ")}>
            {dict.brand}
          </span>
        </Link>

        {/* ── Col 3: icons (desktop) · compact icons (mobile) ──── */}
        {/* RTL grid renders col3 on the physical LEFT → icons end up on left in AR ✓ */}
        <div className="flex items-center justify-end">
          {/* Mobile: compact icons */}
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
          {/* Desktop: full icon bar */}
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

      <nav className="relative border-t border-(--hairline) bg-white py-2.5 max-[880px]:hidden" aria-label="Primary">
        <div className="container flex flex-wrap items-center justify-center gap-1">
          <Link href={`/${lang}/shop`} className={`rounded-(--radius-pill) px-4 py-2 text-[13px] ${lang === "ar" ? "" : "uppercase tracking-[0.08em]"} text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink`}>
            {dict.nav.products}
          </Link>
          <div className="group relative">
            <Link href={`/${lang}/products`} className={`flex items-center gap-1 rounded-(--radius-pill) px-4 py-2 text-[13px] ${lang === "ar" ? "" : "uppercase tracking-[0.08em]"} text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink`}>
              {dict.nav.allCategories}
              <svg className="mt-px h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 group-hover:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-[opacity,visibility] duration-200 group-hover:visible group-hover:opacity-100">
              <div className="w-max max-w-[min(960px,92vw)] overflow-hidden rounded-(--radius-lg) border border-(--hairline) bg-(--surface) shadow-[0_4px_6px_oklch(0.42_0.05_45_/_0.04),0_24px_48px_oklch(0.42_0.05_45_/_0.13)]">

                {/* top accent hairline */}
                <div className="h-px bg-gradient-to-r from-transparent via-(--warm) to-transparent" />

                {/* header row */}
                <div className="flex items-center justify-between border-b border-(--hairline) px-7 py-3.5">
                  <span className={`text-(--ink-3) ${lang === "ar" ? "font-(--font-ar) text-[13px]" : "font-(--font-display) italic text-[17px] tracking-[0.01em]"}`}>
                    {lang === "ar" ? "تصفح الأقسام" : "Browse by category"}
                  </span>
                  <Link
                    href={`/${lang}/products`}
                    className={`text-[11px] text-(--accent) transition-opacity hover:opacity-70 ${lang === "ar" ? "font-(--font-ar)" : "uppercase tracking-[0.14em]"}`}
                  >
                    {lang === "ar" ? "كل المنتجات ←" : "View all →"}
                  </Link>
                </div>

                {/* category grid — auto columns sized to content */}
                <div className="grid auto-cols-max grid-flow-col divide-x divide-(--hairline)">
                  {navGroups.slice(2).map((g) => (
                    <div key={g.root.id} className="flex w-max min-w-[140px] flex-col gap-0 px-6 py-5">

                      {/* category name — italic serif as header */}
                      <Link
                        href={`/${lang}/category/${g.root.slug}`}
                        className={`group/cat mb-0.5 block transition-colors hover:text-(--accent) ${lang === "ar" ? "font-(--font-ar) text-[14px] font-semibold text-(--ink)" : "font-(--font-display) italic text-[19px] leading-[1.1] text-(--ink)"}`}
                      >
                        {lang === "ar" ? g.root.name.ar : g.root.name.en}
                      </Link>

                      {/* decorative rule */}
                      <div className="mb-3 mt-2 h-px w-6 bg-(--warm) opacity-60" />

                      {/* children */}
                      <div className="flex flex-col gap-1.5">
                        {g.children.map((child) => (
                          <Link
                            key={child.id}
                            href={`/${lang}/category/${child.slug}`}
                            className="group/link flex items-center gap-1.5 text-[12.5px] leading-[1.45] text-(--ink-3) transition-colors hover:text-(--accent)"
                          >
                            <span className="inline-block h-px w-2.5 shrink-0 bg-(--warm) opacity-0 transition-opacity group-hover/link:opacity-60" />
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* footer strip */}
                <div className="border-t border-(--hairline) bg-gradient-to-r from-(--warm-soft) via-(--canvas) to-(--warm-soft) px-7 py-3">
                  <Link
                    href={`/${lang}/products`}
                    className={`text-(--ink-2) transition-colors hover:text-(--accent) ${lang === "ar" ? "font-(--font-ar) text-[12px]" : "font-(--font-display) italic text-[14px]"}`}
                  >
                    {lang === "ar" ? "← استعرض المجموعة الكاملة" : "Explore the full collection →"}
                  </Link>
                </div>

              </div>
            </div>
          </div>
          {navGroups.slice(2).filter(g => g.children.some(c => c.grandchildren.length > 0)).map((g) => (
            <div key={g.root.id} className="group relative">
              <Link
                href={`/${lang}/category/${g.root.slug}`}
                className={`flex items-center gap-1 rounded-(--radius-pill) px-4 py-2 text-[13px] ${lang === "ar" ? "" : "uppercase tracking-[0.08em]"} text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink`}
              >
                {lang === "ar" ? g.root.name.ar : g.root.name.en}
                <svg className="mt-px h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 group-hover:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>

              <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100">
                <div className="min-w-[520px] max-w-[820px] rounded-(--radius-lg) border border-(--hairline) bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
                  <div className={`grid gap-x-8 gap-y-1 ${g.children.length <= 2 ? "grid-cols-2" : g.children.length <= 4 ? "grid-cols-3" : "grid-cols-4"}`}>
                    {g.children.map((child) => (
                      <div key={child.id} className="flex flex-col gap-1">
                        <Link
                          href={`/${lang}/category/${child.slug}`}
                          className={`mb-1.5 block text-[12px] font-semibold text-(--ink) transition-colors hover:text-(--accent) ${lang === "ar" ? "font-(--font-ar)" : "uppercase tracking-[0.1em]"}`}
                        >
                          {child.label}
                        </Link>
                        {child.grandchildren.map((gc) => (
                          <Link
                            key={gc.id}
                            href={`/${lang}/category/${gc.slug}`}
                            className="block text-[13px] leading-[1.4] text-(--ink-2) transition-colors hover:text-(--accent)"
                          >
                            {gc.label}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-(--hairline) pt-4">
                    <Link
                      href={`/${lang}/category/${g.root.slug}`}
                      className={`text-[12px] font-medium text-(--accent) transition-colors hover:underline underline-offset-4 ${lang === "ar" ? "" : "uppercase tracking-[0.08em]"}`}
                    >
                      {lang === "ar" ? `كل ${g.root.name.ar} ←` : `All ${g.root.name.en} →`}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Link href={`/${lang}/offers`} className={`rounded-(--radius-pill) px-4 py-2 text-[13px] ${lang === "ar" ? "" : "uppercase tracking-[0.08em]"} text-accent transition-colors hover:bg-(--accent-soft)`}>
            {dict.nav.offers}
          </Link>
        </div>
      </nav>

      {/* Mobile drawer backdrop */}
      <div
        className={`fixed inset-0 z-90 bg-black/40 transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 z-100 flex w-[min(320px,92vw)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${lang === "ar" ? "right-0" : "left-0"} ${mobileOpen ? "translate-x-0" : lang === "ar" ? "translate-x-full" : "-translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-(--hairline) px-5 py-4">
          <span className={lang === "ar" ? "text-[22px] font-(--font-ar) font-bold text-ink" : "text-[24px] italic font-(--font-display) text-ink"}>{dict.brand}</span>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink hover:bg-(--warm-soft)"
            onClick={() => setMobileOpen(false)}
            aria-label="Close"
          >
            <Icon.Close />
          </button>
        </div>

        <div className="flex flex-col gap-0 overflow-y-auto px-5 pb-8 pt-3">
          <form onSubmit={(e) => { onSearch(e); setMobileOpen(false); }} className="mb-4 flex h-12 items-center gap-2.5 rounded-(--radius-pill) border border-(--hairline) bg-white px-5">
            <Icon.Search />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-ink outline-none placeholder:text-(--ink-3)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={dict.nav.search}
              aria-label={dict.nav.search}
            />
          </form>

          <Link onClick={() => setMobileOpen(false)} href={`/${lang}/shop`} className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)">
            <span>{dict.nav.products}</span>
            <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
          </Link>
          <Link onClick={() => setMobileOpen(false)} href={`/${lang}/products`} className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)">
            <span>{dict.nav.allCategories}</span>
            <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
          </Link>
          <Link onClick={() => setMobileOpen(false)} href={`/${lang}/offers`} className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-accent transition-colors hover:bg-(--accent-soft)">
            <span>{dict.nav.offers}</span>
            <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
          </Link>
          {user && (
            <Link onClick={() => setMobileOpen(false)} href={`/${lang}/orders`} className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)">
              <span>{dict.nav.orders}</span>
              <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
            </Link>
          )}

          <div className="px-2 pb-2 pt-6 text-[10px] uppercase tracking-[0.22em] text-(--ink-3)">
            {dict.nav.categories}
          </div>
          {navGroups.slice(2).map((g) => (
            <Link
              key={g.root.id}
              onClick={() => setMobileOpen(false)}
              href={`/${lang}/category/${g.root.slug}`}
              className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink"
            >
              <span>{lang === "ar" ? g.root.name.ar : g.root.name.en}</span>
              <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

