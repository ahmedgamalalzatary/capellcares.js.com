"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { pickLang } from "@capella/shared";
import type { HeaderMenuEntry } from "@/lib/header-menu";
import { compareHeaderCategoryEntries } from "@/lib/header-menu";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";
import { buildCategoryHref } from "@/lib/category-links";
import { Icon } from "@/components/ui/icons";
import { DESKTOP_BREAKPOINT } from "@/constants/ui";
import { SocialIcon } from "../social-icon";
import { SOCIAL_LINKS } from "../../../constants/socials";
import type { HeaderProps } from "../../../types/header.types";

/** The menu lists YouTube where Instagram sits in the footer, and Instagram where YouTube sits. */
const MENU_SOCIAL_LINKS = SOCIAL_LINKS.map((link, _index, all) => (
  link.label === "Instagram" ? all.find((item) => item.label === "YouTube") ?? link
    : link.label === "YouTube" ? all.find((item) => item.label === "Instagram") ?? link
      : link
));

type HeaderMobileDrawerProps = Pick<HeaderProps, "lang" | "dict" | "menuEntries" | "brands" | "genders"> & {
  isAr: boolean;
  mobileOpen: boolean;
  user: { id: number; name: string; email: string } | null;
  accountHref: string;
  onClose: () => void;
  onSwitchLang: () => void;
};

type Section = "genders" | "categories" | "brands";
type SectionItem = { key: string; href: string; label: string; imagePath?: string | null };

/** On the footer's dark purple: page links and + rows; a + row opens its entries as white cards, the way Capella's menu shows them. */
const CARD = "flex min-h-14 items-center gap-3 rounded-md bg-surface px-3 py-2 font-semibold text-ink shadow-(--shadow-1) transition-transform duration-200 hover:-translate-y-0.5";
const ROW = "flex min-h-13 w-full items-center justify-between gap-3 border-b border-white/20 px-1 text-start text-lg font-bold text-white transition-colors hover:text-(--sunny)";

export function HeaderMobileDrawer({
  lang,
  dict,
  menuEntries,
  brands = [],
  genders = [],
  isAr,
  mobileOpen,
  user,
  accountHref,
  onClose,
  onSwitchLang
}: HeaderMobileDrawerProps) {
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The menu fills the screen from the header's bottom edge down; measured on open because the announcement bar above may or may not be scrolled away.
  const [panelHeight, setPanelHeight] = useState<number>();
  const chevron = `shrink-0 ${isAr ? "rotate-180" : ""}`;

  /** A + row that opens its list in place as white cards; picking a card goes to that item's page. */
  const section = (id: Section, label: string, items: SectionItem[], all: { href: string; label: string }) => {
    if (items.length === 0) return null;
    const open = openSection === id;
    return (
      <div>
        {/* The parent is a white card too, a little bolder than its children. */}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpenSection(open ? null : id)}
          className={`${CARD} w-full justify-between text-start text-lg font-bold`}
        >
          <span>{label}</span>
          {open ? <Icon.Minus size={20} className="shrink-0 text-(--violet)" /> : <Icon.Plus size={20} className="shrink-0 text-(--ink-3)" />}
        </button>
        {open && (
          <div className="grid gap-2.5 ps-4 pt-2.5 animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none">
            <Link href={all.href} onClick={onClose} className={CARD}>
              <span className="min-w-0 flex-1 truncate">{all.label}</span>
              <Icon.Chevron className={`${chevron} text-(--ink-3)`} />
            </Link>
            {items.map((item) => (
              <Link key={item.key} href={item.href} onClick={onClose} className={CARD}>
                <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-(--warm-soft)">
                  {item.imagePath ? <Image src={item.imagePath} alt="" fill sizes="40px" className="object-contain" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <Icon.Chevron className={`${chevron} text-(--ink-3)`} />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const genderItems: SectionItem[] = genders.map((gender) => {
    // Same picture as the shop's gender banners: the Arabic one on Arabic pages when it exists.
    const picture = lang === "ar" ? gender.arImagePath || gender.imagePath : gender.imagePath;
    return {
      key: `gender-${gender.id}`,
      href: `/${lang}/genders/${gender.slug}`,
      label: pickLang(gender.name, lang),
      imagePath: picture ? resolveMediaUrl(picture) : null
    };
  });
  // Main categories only; each one goes straight to its page.
  const categoryItems: SectionItem[] = menuEntries
    .filter((entry): entry is Extract<HeaderMenuEntry, { type: "category" }> => entry.type === "category")
    .slice()
    .sort(compareHeaderCategoryEntries)
    .map((category) => ({
      key: category.key,
      href: buildCategoryHref(lang, { id: category.id, slug: category.slug }),
      label: category.label,
      imagePath: category.imagePath
    }));
  // Same rule as the shop page: nothing here should lead to an empty page.
  const brandItems: SectionItem[] = brands
    .filter((brand) => brand.hasProducts !== false)
    .map((brand) => ({
      key: `brand-${brand.id}`,
      href: `/${lang}/brands/${brand.slug}`,
      label: pickLang(brand.name, lang),
      imagePath: brand.imagePath ? resolveMediaUrl(brand.imagePath) : null
    }));

  useEffect(() => {
    if (!mobileOpen) return;
    const update = () => {
      const top = panelRef.current?.parentElement?.getBoundingClientRect().bottom ?? 0;
      setPanelHeight(Math.max(0, window.innerHeight - top));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  // Auto-close at desktop width, where this menu does not exist (matches its CSS min-[880px]).
  useEffect(() => {
    if (!mobileOpen) return;
    const onResize = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT) onClose();
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mobileOpen, onClose]);

  // Slides in from the reading side, like The Body Shop's menu: from the left in English, from the right in Arabic.
  const closedOffset = isAr ? "translate-x-full" : "-translate-x-full";

  return (
    // Hangs from the header's bottom edge (the header is its positioned parent), full width, so the logo row and its menu/close button stay in view.
    // `invisible` while closed keeps the off-screen links out of the keyboard's tab order.
    <div
      ref={panelRef}
      dir={isAr ? "rtl" : "ltr"}
      role="dialog"
      aria-label={dict.brand}
      style={{ "--menu-height": panelHeight ? `${panelHeight}px` : "calc(100dvh - 8rem)" } as CSSProperties}
      className={`absolute inset-x-0 top-full flex h-(--menu-height) flex-col bg-ink text-white transition-[translate,visibility] duration-500 ease-(--ease-out-quart) motion-reduce:transition-none min-[880px]:hidden ${
        mobileOpen ? "visible translate-x-0" : `invisible ${closedOffset}`
      }`}
    >
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-1">
        <Link href={`/${lang}/shop`} onClick={onClose} className={ROW}>
          <span>{dict.nav.products}</span>
          <Icon.Chevron className={`${chevron} text-white/60`} />
        </Link>

        <div className="grid gap-2.5 border-b border-white/20 py-3">
          {section("genders", dict.nav.genders, genderItems, { href: `/${lang}/shop#genders`, label: dict.nav.allGenders })}
          {section("categories", dict.nav.categories, categoryItems, { href: `/${lang}/shop#categories`, label: dict.nav.allCategories })}
          {section("brands", dict.nav.brands, brandItems, { href: `/${lang}/shop#brands`, label: dict.nav.allBrands })}
        </div>

        <Link href={`/${lang}/new`} onClick={onClose} className={ROW}>
          <span>{dict.nav.new}</span>
          <Icon.Chevron className={`${chevron} text-white/60`} />
        </Link>
        <Link href={`/${lang}/bestsellers`} onClick={onClose} className={ROW}>
          <span>{dict.nav.bestsellers}</span>
          <Icon.Chevron className={`${chevron} text-white/60`} />
        </Link>
        <Link href={`/${lang}/offers`} onClick={onClose} className={ROW}>
          <span>{dict.nav.offers}</span>
          <Icon.Chevron className={`${chevron} text-white/60`} />
        </Link>
        <Link href={`/${lang}/wishlist`} onClick={onClose} className={ROW}>
          <span>{dict.nav.wishlist}</span>
          <Icon.Heart size={22} className="shrink-0 text-white/60" />
        </Link>
        <Link href={accountHref} onClick={onClose} className={ROW}>
          <span>{user ? dict.nav.orders : dict.nav.account}</span>
          <Icon.User size={22} className="shrink-0 text-white/60" />
        </Link>

        <div className="px-1 pt-6">
          <p className="m-0 mb-3 text-lg font-bold text-white">{dict.nav.followUs}</p>
          <div className="flex flex-wrap gap-2">
            {MENU_SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={dict.footer[label.toLowerCase()]}
                className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-(--accent-soft)"
              >
                <SocialIcon path={path} stroke={stroke} className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="flex shrink-0 gap-1 border-t border-white/20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {(["en", "ar"] as const).map((code) => {
          const active = lang === code;
          return (
            <button
              key={code}
              type="button"
              onClick={active ? undefined : onSwitchLang}
              aria-pressed={active}
              className={`min-h-11 flex-1 rounded-full font-bold transition-colors ${
                active ? "bg-surface text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {dict.langSwitch[code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
