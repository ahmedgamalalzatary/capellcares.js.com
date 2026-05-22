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
        "sticky top-0 z-30 border-b border-(--hairline) transition-[background,box-shadow] duration-200",
        scrolled
          ? "bg-[color-mix(in_oklch,var(--canvas)_88%,transparent)] shadow-[var(--shadow-1)] backdrop-blur-md"
          : "bg-(--canvas)"
      ].join(" ")}
    >
      <div className={`bg-(--ink) px-4 py-2 text-center text-[11px] text-(--canvas) sm:text-[12px] ${lang === "ar" ? "tracking-[0.04em]" : "tracking-[0.04em] sm:tracking-[0.12em]"}`}>
        {lang === "ar"
          ? "شحن مجاني داخل القاهرة للطلبات فوق ٦٠٠ جنيه · ادفع عند الاستلام"
          : "Free Cairo delivery on orders over EGP 600 · Cash on delivery"}
      </div>

      <div className="container grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 py-3 sm:gap-4 sm:py-4 max-[880px]:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button
          className="hidden h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-1 text-(--ink) sm:h-10 sm:w-10 max-[880px]:inline-flex"
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
        >
          <Icon.Menu />
        </button>

        <Link href={`/${lang}`} className="group inline-flex min-w-0 items-center gap-2.5 max-[880px]:justify-self-center" aria-label={dict.brand}>
          <span
            className={[
              "text-(--ink) leading-none transition-colors group-hover:text-(--accent) whitespace-nowrap",
              lang === "ar"
                ? "text-[20px] font-bold font-(--font-ar) tracking-normal sm:text-[26px]"
                : "text-[22px] font-(--font-display) italic tracking-[0.005em] sm:text-[28px]"
            ].join(" ")}
          >
            {dict.brand}
          </span>
        </Link>

        <form
          className="flex h-11 w-full max-w-[520px] items-center gap-2.5 justify-self-end rounded-full border border-(--hairline) bg-(--surface) px-[18px] py-2 text-(--ink-2) transition-[border-color,box-shadow] focus-within:border-(--accent) focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent)_18%,transparent)] max-[880px]:hidden"
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

        <div className="inline-flex items-center gap-0.5 sm:gap-1">
          <button
            className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--warm-soft) sm:h-10 sm:w-10"
            onClick={switchLang}
            aria-label="Language"
            title="Language"
          >
            <Icon.Globe />
            <span className="absolute bottom-1 right-1 text-[9px] font-semibold">{dict.langSwitch.short}</span>
          </button>

          {user && (
            <Link href={`/${lang}/orders`} className="relative hidden h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--warm-soft) sm:grid sm:h-10 sm:w-10" aria-label={dict.nav.orders}>
              <Icon.User />
            </Link>
          )}

          <Link href={`/${lang}/wishlist`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--warm-soft) sm:h-10 sm:w-10" aria-label={dict.nav.wishlist}>
            <Icon.Heart />
            {ids.length > 0 && (
              <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-(--ink) px-1 text-[10px] font-semibold leading-none text-(--canvas)">
                {ids.length}
              </span>
            )}
          </Link>

          {!user && (
            <Link href={`/${lang}/login`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--warm-soft) sm:h-10 sm:w-10" aria-label={dict.nav.account}>
              <Icon.User />
            </Link>
          )}

          <Link href={`/${lang}/cart`} className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-(--ink) transition-colors hover:bg-(--warm-soft) sm:h-10 sm:w-10" aria-label={dict.nav.cart}>
            <Icon.Cart />
            {count > 0 && (
              <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-(--accent) px-1 text-[10px] font-semibold leading-none text-(--canvas)">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      <nav className="border-t border-(--hairline) bg-(--canvas) py-2.5 max-[880px]:hidden" aria-label="Primary">
        <div className="container flex flex-wrap items-center justify-center gap-1">
          <Link href={`/${lang}/products`} className={`rounded-(--radius-pill) px-4 py-2 text-[13px] ${lang === "ar" ? "" : "uppercase tracking-[0.08em]"} text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-(--ink)`}>
            {dict.nav.products}
          </Link>
          {navGroups.slice(2, 7).map((g) => (
            <Link
              key={g.root.id}
              href={`/${lang}/category/${g.root.slug}`}
              className={`rounded-(--radius-pill) px-4 py-2 text-[13px] ${lang === "ar" ? "" : "uppercase tracking-[0.08em]"} text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-(--ink)`}
            >
              {lang === "ar" ? g.root.name.ar : g.root.name.en}
            </Link>
          ))}
          <Link href={`/${lang}/offers`} className={`rounded-(--radius-pill) px-4 py-2 text-[13px] ${lang === "ar" ? "" : "uppercase tracking-[0.08em]"} text-(--accent) transition-colors hover:bg-(--accent-soft)`}>
            {dict.nav.offers}
          </Link>
        </div>
      </nav>

      {/* Mobile drawer backdrop */}
      <div
        className={`fixed inset-0 z-[90] bg-black/40 transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 z-[100] flex w-[min(320px,92vw)] flex-col bg-(--canvas) shadow-2xl transition-transform duration-300 ease-out ${lang === "ar" ? "right-0" : "left-0"} ${mobileOpen ? "translate-x-0" : lang === "ar" ? "translate-x-full" : "-translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-(--hairline) px-5 py-4">
          <span className={lang === "ar" ? "text-[22px] font-bold font-(--font-ar) text-(--ink)" : "text-[24px] italic font-(--font-display) text-(--ink)"}>{dict.brand}</span>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink) hover:bg-(--warm-soft)"
            onClick={() => setMobileOpen(false)}
            aria-label="Close"
          >
            <Icon.Close />
          </button>
        </div>

        <div className="flex flex-col gap-0 overflow-y-auto px-5 pb-8 pt-3">
          <form onSubmit={(e) => { onSearch(e); setMobileOpen(false); }} className="mb-4 flex h-12 items-center gap-2.5 rounded-(--radius-pill) border border-(--hairline) bg-(--surface) px-5">
            <Icon.Search />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-(--ink) outline-none placeholder:text-(--ink-3)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={dict.nav.search}
              aria-label={dict.nav.search}
            />
          </form>

          <Link onClick={() => setMobileOpen(false)} href={`/${lang}/products`} className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-(--ink) transition-colors hover:bg-(--warm-soft)">
            <span>{dict.nav.products}</span>
            <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
          </Link>
          <Link onClick={() => setMobileOpen(false)} href={`/${lang}/offers`} className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-(--accent) transition-colors hover:bg-(--accent-soft)">
            <span>{dict.nav.offers}</span>
            <Icon.Chevron className={`text-(--ink-3) ${lang === "ar" ? "rotate-180" : ""}`} />
          </Link>
          {user && (
            <Link onClick={() => setMobileOpen(false)} href={`/${lang}/orders`} className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-(--ink) transition-colors hover:bg-(--warm-soft)">
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
              className="flex items-center justify-between border-b border-(--hairline) px-2 py-4 text-[15px] text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-(--ink)"
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

