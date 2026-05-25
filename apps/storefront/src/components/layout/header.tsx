"use client";

import Image from "next/image";
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
        "sticky top-0 z-30 border-b border-black transition-[background,box-shadow] duration-200",
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
            className="hidden min-[880px]:flex h-11 w-full max-w-[380px] items-center gap-2.5 rounded-full border border-black bg-white px-4.5 py-2 text-(--ink-2) transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent)_18%,transparent)]"
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
        <Link href={`/${lang}`} className="group inline-flex min-w-0 items-center justify-self-center gap-2" aria-label={dict.brand}>
          <Image
            src="/capella-care.png"
            alt={dict.brand}
            width={300}
            height={80}
            className="h-[38px] w-auto object-contain transition-opacity group-hover:opacity-80 sm:h-[46px]"
            priority
          />
          <Image
            src="/logogold.jpeg"
            alt={dict.brand}
            width={160}
            height={52}
            className="h-[38px] w-auto object-contain transition-opacity group-hover:opacity-80 sm:h-[46px]"
            priority
          />
          
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

      <nav className="relative border-t border-black bg-(--canvas) py-2.5 max-[880px]:hidden" aria-label="Primary">
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
              <div className="w-max max-w-[min(960px,92vw)] overflow-hidden rounded-(--radius-lg) border border-black bg-(--surface) shadow-[0_4px_6px_oklch(0.42_0.05_45_/_0.04),0_24px_48px_oklch(0.42_0.05_45_/_0.13)]">

                {/* top accent hairline */}
                <div className="h-px bg-gradient-to-r from-transparent via-(--warm) to-transparent" />

                {/* header row */}
                <div className="flex items-center justify-between border-b border-black px-7 py-3.5">
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
                <div className="border-t border-black bg-gradient-to-r from-(--warm-soft) via-(--canvas) to-(--warm-soft) px-7 py-3">
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
                <div className="min-w-[520px] max-w-[820px] rounded-(--radius-lg) border border-black bg-(--canvas) p-6 shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
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
                  <div className="mt-5 border-t border-black pt-4">
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
        className={`fixed inset-y-0 z-100 flex w-[min(320px,92vw)] flex-col bg-(--canvas) shadow-2xl transition-transform duration-300 ease-out ${lang === "ar" ? "right-0" : "left-0"} ${mobileOpen ? "translate-x-0" : lang === "ar" ? "translate-x-full" : "-translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black px-5 py-4">
          <Image src="/logogold.jpeg" alt={dict.brand} width={130} height={42} className="h-[34px] w-auto object-contain" />
          <button
            className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink hover:bg-(--warm-soft)"
            onClick={() => setMobileOpen(false)}
            aria-label="Close"
          >
            <Icon.Close />
          </button>
        </div>

        <div className="flex flex-col gap-0 overflow-y-auto px-5 pb-8 pt-3">
          <form onSubmit={(e) => { onSearch(e); setMobileOpen(false); }} className="mb-4 flex h-12 items-center gap-2.5 rounded-(--radius-pill) border border-black bg-(--canvas) px-5">
            <Icon.Search />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-ink outline-none placeholder:text-(--ink-3)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={dict.nav.search}
              aria-label={dict.nav.search}
            />
          </form>

          <Link onClick={() => setMobileOpen(false)} href={`/${lang}/shop`} className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)">
            <span>{dict.nav.products}</span>
            <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
          </Link>
          <Link onClick={() => setMobileOpen(false)} href={`/${lang}/products`} className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)">
            <span>{dict.nav.allCategories}</span>
            <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
          </Link>
          <Link onClick={() => setMobileOpen(false)} href={`/${lang}/offers`} className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-accent transition-colors hover:bg-(--accent-soft)">
            <span>{dict.nav.offers}</span>
            <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
          </Link>
          {user && (
            <Link onClick={() => setMobileOpen(false)} href={`/${lang}/orders`} className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)">
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
              className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink"
            >
              <span>{lang === "ar" ? g.root.name.ar : g.root.name.en}</span>
              <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
            </Link>
          ))}

          {/* Socials */}
          <div className="mt-8 border-t border-black pt-6 px-2">
            <p className="mb-4 text-[10px] uppercase tracking-[0.22em] text-(--ink-3)">
              {isAr ? "تابعينا" : "Follow us"}
            </p>
            <div className="flex items-center gap-3">
              {[
                {
                  label: "Facebook",
                  href: "https://facebook.com/capellacare",
                  path: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
                  stroke: true,
                },
                {
                  label: "WhatsApp",
                  href: "https://wa.me/201000000000",
                  path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.428a.5.5 0 0 0 .611.61l5.649-1.479A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z",
                  stroke: false,
                },
                {
                  label: "Instagram",
                  href: "https://instagram.com/capellacare",
                  path: "M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10A5 5 0 0 1 12 7Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.25-2.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
                  stroke: false,
                },
                {
                  label: "TikTok",
                  href: "https://tiktok.com/@capellacare",
                  path: "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07Z",
                  stroke: false,
                },
                {
                  label: "YouTube",
                  href: "https://youtube.com/@capellacare",
                  path: "M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z",
                  stroke: false,
                },
              ].map(({ label, href, path, stroke }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-black text-(--ink-3) transition-colors hover:border-(--accent) hover:text-(--accent)"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden fill={stroke ? "none" : "currentColor"} stroke={stroke ? "currentColor" : "none"} strokeWidth={stroke ? 2 : 0} strokeLinecap="round" strokeLinejoin="round">
                    <path d={path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

