"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HeaderMenuEntry } from "@/lib/header-menu";
import { compareHeaderCategoryEntries } from "@/lib/header-menu";
import { buildCategoryHref } from "@/lib/category-links";
import { Icon } from "@/components/ui/icons";
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
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const chevron = `shrink-0 text-(--ink-3) ${isAr ? "rotate-180" : ""}`;
  // Main categories only; each one goes straight to its page.
  const categories = menuEntries
    .filter((entry): entry is Extract<HeaderMenuEntry, { type: "category" }> => entry.type === "category")
    .slice()
    .sort(compareHeaderCategoryEntries);

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

          {categories.length > 0 && (
            <div>
              <button
                type="button"
                aria-expanded={categoriesOpen}
                onClick={() => setCategoriesOpen((open) => !open)}
                className={`${ROW} ${categoriesOpen ? "text-(--violet)" : ""}`}
              >
                <span>{dict.nav.categories}</span>
                {categoriesOpen ? <Icon.Minus size={20} className="shrink-0" /> : <Icon.Plus size={20} className="shrink-0 text-(--ink-3)" />}
              </button>
              {categoriesOpen && (
                <div className="border-b border-(--hairline) bg-(--surface-2) py-1.5">
                  {categories.map((category) => (
                    <Link
                      key={category.key}
                      href={buildCategoryHref(lang, { id: category.id, slug: category.slug })}
                      onClick={onClose}
                      className="flex min-h-11 items-center px-5 py-1 font-semibold text-(--ink-2) transition-colors hover:bg-(--warm-soft)"
                    >
                      <span className="min-w-0 truncate">{category.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link href={`/${lang}/new`} onClick={onClose} className={ROW}>
            <span>{dict.nav.new}</span>
            <Icon.Chevron className={chevron} />
          </Link>
          <Link href={`/${lang}/bestsellers`} onClick={onClose} className={ROW}>
            <span>{dict.nav.bestsellers}</span>
            <Icon.Chevron className={chevron} />
          </Link>

          <Link href={accountHref} onClick={onClose} className={ROW}>
            <span>{user ? dict.nav.orders : dict.nav.account}</span>
            <Icon.User size={22} className="shrink-0 text-(--ink-3)" />
          </Link>
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
