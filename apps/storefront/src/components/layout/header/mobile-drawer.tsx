"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HeaderMenuEntry } from "@/lib/header-menu";
import { compareHeaderCategoryEntries } from "@/lib/header-menu";
import { buildCategoryHref } from "@/lib/category-links";
import { Icon } from "@/components/ui/icons";
import { SOCIAL_LINKS } from "../../../constants/socials";
import { DESKTOP_BREAKPOINT } from "@/constants/ui";
import type { HeaderProps } from "../../../types/header.types";

type HeaderMobileDrawerProps = Pick<HeaderProps, "lang" | "dict" | "menuEntries"> & {
  isAr: boolean;
  mobileOpen: boolean;
  user: { id: number; name: string; email: string } | null;
  accountHref: string;
  onClose: () => void;
  onSwitchLang: () => void;
};

type DrawerSection = { key: string; label: string; href: string; items: { key: string | number; label: string; href: string; imagePath?: string | null }[] };

// Section order: Offers, Sets, then the category roots. New/Bestsellers are plain links above the sections.
function buildSections(entries: HeaderMenuEntry[], lang: HeaderProps["lang"]): DrawerSection[] {
  const sections: DrawerSection[] = [];
  for (const entry of entries) {
    if (entry.type === "offers") {
      sections.push({
        key: entry.key,
        label: entry.label,
        href: `/${lang}/${entry.slug}`,
        items: entry.offers.map((item) => ({ key: item.id, label: item.label, href: `/${lang}/${entry.slug}/${item.slug}`, imagePath: item.imagePath || null }))
      });
    }
  }
  for (const entry of entries) {
    if (entry.type === "collections") {
      sections.push({
        key: entry.key,
        label: entry.label,
        href: `/${lang}/${entry.slug}`,
        items: entry.collections.map((item) => ({ key: item.id, label: item.label, href: `/${lang}/${entry.slug}/${item.slug}`, imagePath: item.imagePath || null }))
      });
    }
  }
  const categories = entries
    .filter((entry): entry is Extract<HeaderMenuEntry, { type: "category" }> => entry.type === "category")
    .slice()
    .sort(compareHeaderCategoryEntries);
  for (const entry of categories) {
    sections.push({
      key: entry.key,
      label: entry.label,
      href: buildCategoryHref(lang, { id: entry.id, slug: entry.slug }),
      items: entry.children.map((child) => ({ key: child.id, label: child.label, href: buildCategoryHref(lang, child), imagePath: child.imagePath ?? null }))
    });
  }
  return sections;
}

const ROW = "flex min-h-13 w-full items-center justify-between gap-3 border-b border-(--hairline) px-5 text-start text-lg font-bold text-ink transition-colors hover:bg-(--warm-soft)";

export function HeaderMobileDrawer({
  lang,
  dict,
  menuEntries,
  isAr,
  mobileOpen,
  user,
  accountHref,
  onClose,
  onSwitchLang
}: HeaderMobileDrawerProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sections = buildSections(menuEntries, lang);
  const chevron = `shrink-0 text-(--ink-3) ${isAr ? "rotate-180" : ""}`;

  useEffect(() => {
    if (mobileOpen) closeRef.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  // Auto-close once the desktop mega menu takes over (matches its CSS min-[880px]).
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
        <div className="flex shrink-0 items-center justify-between border-b border-(--hairline) px-5 py-2">
          <Image src="/logo-header.png" alt={dict.brand} width={429} height={604} className="h-12 w-auto" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={dict.media.close}
            className="-me-2 grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-(--warm-soft)"
          >
            <Icon.Close size={22} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Link href={`/${lang}/shop`} onClick={onClose} className={ROW}>
            <span>{dict.nav.products}</span>
            <Icon.Chevron className={chevron} />
          </Link>
          <Link href={`/${lang}/new`} onClick={onClose} className={ROW}>
            <span>{dict.nav.new}</span>
            <Icon.Chevron className={chevron} />
          </Link>
          <Link href={`/${lang}/bestsellers`} onClick={onClose} className={ROW}>
            <span>{dict.nav.bestsellers}</span>
            <Icon.Chevron className={chevron} />
          </Link>

          {sections.map((section) => {
            if (section.items.length === 0 && section.key.startsWith("category")) {
              return (
                <Link key={section.key} href={section.href} onClick={onClose} className={ROW}>
                  <span>{section.label}</span>
                  <Icon.Chevron className={chevron} />
                </Link>
              );
            }
            const expanded = openSection === section.key;
            return (
              <div key={section.key}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenSection(expanded ? null : section.key)}
                  className={`${ROW} ${expanded ? "text-(--violet)" : ""}`}
                >
                  <span>{section.label}</span>
                  {expanded ? <Icon.Minus size={20} className="shrink-0" /> : <Icon.Plus size={20} className="shrink-0 text-(--ink-3)" />}
                </button>
                {expanded && (
                  <div className="border-b border-(--hairline) bg-(--surface-2) py-1.5">
                    <Link
                      href={section.href}
                      onClick={onClose}
                      className="flex min-h-11 items-center px-5 font-bold text-(--violet) transition-colors hover:bg-(--warm-soft)"
                    >
                      {dict.nav.viewAllCategory.replace("{name}", section.label)}
                    </Link>
                    {section.items.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        aria-label={item.label}
                        onClick={onClose}
                        className="flex min-h-11 items-center gap-3 px-5 py-1 font-semibold text-(--ink-2) transition-colors hover:bg-(--warm-soft)"
                      >
                        {item.imagePath && (
                          <img src={item.imagePath} alt="" className="h-9 w-9 shrink-0 rounded-(--radius-sm) object-cover" />
                        )}
                        <span className="min-w-0 truncate">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <Link href={accountHref} onClick={onClose} className={ROW}>
            <span>{user ? dict.nav.orders : dict.nav.account}</span>
            <Icon.User size={22} className="shrink-0 text-(--ink-3)" />
          </Link>

          {SOCIAL_LINKS.length > 0 && (
            <div className="px-5 py-5">
              <p className="mb-3 mt-0 font-bold text-ink">{dict.nav.followUs}</p>
              <div className="flex items-center gap-3">
                {SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-(--hairline) text-(--ink-3) transition-colors hover:border-accent hover:text-accent"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden fill={stroke ? "none" : "currentColor"} stroke={stroke ? "currentColor" : "none"} strokeWidth={stroke ? 2 : 0} strokeLinecap="round" strokeLinejoin="round">
                      <path d={path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}
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
