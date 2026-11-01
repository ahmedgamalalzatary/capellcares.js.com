"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

type HeaderMobileDrawerProps = Pick<HeaderProps, "lang" | "dict" | "menuEntries" | "brands" | "genders"> & {
  onOpenSearch: () => void;
  isAr: boolean;
  mobileOpen: boolean;
  user: { id: number; name: string; email: string } | null;
  accountHref: string;
  onClose: () => void;
  onSwitchLang: () => void;
};

type Section = "genders" | "categories" | "brands";
type SectionItem = { key: string; href: string; label: string; imagePath?: string | null };

const SUB_ROW = "flex min-h-12 items-center gap-3 px-5 py-1 font-semibold text-(--ink-2) transition-colors hover:bg-(--warm-soft)";
const ROW = "flex min-h-13 w-full items-center justify-between gap-3 border-b border-(--hairline) px-5 text-start text-lg font-bold text-ink transition-colors hover:bg-(--warm-soft)";

export function HeaderMobileDrawer({
  lang,
  dict,
  menuEntries,
  brands = [],
  genders = [],
  onOpenSearch,
  isAr,
  mobileOpen,
  user,
  accountHref,
  onClose,
  onSwitchLang
}: HeaderMobileDrawerProps) {
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const chevron = `shrink-0 text-(--ink-3) ${isAr ? "rotate-180" : ""}`;
  // Main categories only; each one goes straight to its page.
  const categories = menuEntries
    .filter((entry): entry is Extract<HeaderMenuEntry, { type: "category" }> => entry.type === "category")
    .slice()
    .sort(compareHeaderCategoryEntries);

  /** A row that opens a list in place; picking from the list goes to that item's page. */
  const section = (id: Section, label: string, items: SectionItem[], all?: { href: string; label: string }, withPictures = false) => {
    if (items.length === 0) return null;
    const open = openSection === id;
    return (
      <div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpenSection(open ? null : id)}
          className={`${ROW} ${open ? "text-(--violet)" : ""}`}
        >
          <span>{label}</span>
          {open ? <Icon.Minus size={20} className="shrink-0" /> : <Icon.Plus size={20} className="shrink-0 text-(--ink-3)" />}
        </button>
        {open && (
          <div className="border-b border-(--hairline) bg-(--surface-2) py-1.5">
            {all && (
              <Link href={all.href} onClick={onClose} className={`${SUB_ROW} text-(--violet)`}>
                <span className="min-w-0 truncate">{all.label}</span>
              </Link>
            )}
            {items.map((item) => (
              <Link key={item.key} href={item.href} onClick={onClose} className={SUB_ROW}>
                {withPictures && (
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface">
                    {item.imagePath ? <Image src={item.imagePath} alt="" fill sizes="36px" className="object-contain" /> : null}
                  </span>
                )}
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (mobileOpen) closeRef.current?.focus();
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

  const closedOffset = isAr ? "translate-x-full" : "-translate-x-full";

  return (
    <>
      <div
        className={`fixed inset-0 bg-ink/50 transition-opacity duration-300 motion-reduce:transition-none min-[880px]:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* `invisible` while closed keeps the off-screen links out of the keyboard's tab order. */}
      <div
        dir={isAr ? "rtl" : "ltr"}
        role="dialog"
        aria-modal="true"
        aria-label={dict.brand}
        className={`fixed inset-y-0 start-0 flex h-dvh w-[min(86vw,380px)] flex-col bg-surface shadow-(--shadow-2) transition-[translate,visibility] duration-300 ease-(--ease-out-quart) motion-reduce:transition-none min-[880px]:hidden ${
          mobileOpen ? "visible translate-x-0" : `invisible ${closedOffset}`
        }`}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-(--hairline) px-5 py-2">
          <Image src="/logo-header.png" alt={dict.brand} width={429} height={604} className="h-12 w-auto shrink-0" />
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-(--radius-pill) border border-(--hairline) bg-surface px-3 text-start text-(--ink-3) transition-colors hover:border-warm"
          >
            <Icon.Search size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{dict.nav.search}</span>
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={dict.media.close}
            className="-me-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-(--warm-soft)"
          >
            <Icon.Close size={22} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Link href={`/${lang}/shop`} onClick={onClose} className={ROW}>
            <span>{dict.nav.products}</span>
            <Icon.Chevron className={chevron} />
          </Link>

          {section(
            "genders",
            dict.nav.genders,
            genders.map((gender) => ({ key: `gender-${gender.id}`, href: `/${lang}/genders/${gender.slug}`, label: pickLang(gender.name, lang) }))
          )}
          {section(
            "categories",
            dict.nav.categories,
            categories.map((category) => ({
              key: category.key,
              href: buildCategoryHref(lang, { id: category.id, slug: category.slug }),
              label: category.label,
              imagePath: category.imagePath
            })),
            { href: `/${lang}/shop#categories`, label: dict.nav.allCategories },
            true
          )}
          {section(
            "brands",
            dict.nav.brands,
            // Same rule as the shop page: nothing here should lead to an empty page.
            brands
              .filter((brand) => brand.hasProducts !== false)
              .map((brand) => ({
                key: `brand-${brand.id}`,
                href: `/${lang}/brands/${brand.slug}`,
                label: pickLang(brand.name, lang),
                imagePath: brand.imagePath ? resolveMediaUrl(brand.imagePath) : null
              })),
            { href: `/${lang}/shop#brands`, label: dict.nav.allBrands },
            true
          )}

          <Link href={`/${lang}/new`} onClick={onClose} className={ROW}>
            <span>{dict.nav.new}</span>
            <Icon.Chevron className={chevron} />
          </Link>
          <Link href={`/${lang}/bestsellers`} onClick={onClose} className={ROW}>
            <span>{dict.nav.bestsellers}</span>
            <Icon.Chevron className={chevron} />
          </Link>
          <Link href={`/${lang}/offers`} onClick={onClose} className={ROW}>
            <span>{dict.nav.offers}</span>
            <Icon.Chevron className={chevron} />
          </Link>

          <Link href={accountHref} onClick={onClose} className={ROW}>
            <span>{user ? dict.nav.orders : dict.nav.account}</span>
            <Icon.User size={22} className="shrink-0 text-(--ink-3)" />
          </Link>

          <div className="px-5 py-4">
            <p className="m-0 mb-3 text-lg font-bold text-ink">{dict.nav.followUs}</p>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={dict.footer[label.toLowerCase()]}
                  className="grid h-11 w-11 place-items-center rounded-full bg-(--warm-soft) text-ink transition-colors hover:bg-(--accent-soft)"
                >
                  <SocialIcon path={path} stroke={stroke} className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </nav>

        <div className="flex shrink-0 gap-1 border-t border-(--hairline) p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {(["en", "ar"] as const).map((code) => {
            const active = lang === code;
            return (
              <button
                key={code}
                type="button"
                onClick={active ? undefined : onSwitchLang}
                aria-pressed={active}
                className={`min-h-11 flex-1 rounded-full font-bold transition-colors ${
                  active ? "bg-(--violet) text-white" : "text-(--ink-2) hover:bg-(--warm-soft)"
                }`}
              >
                {dict.langSwitch[code]}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
