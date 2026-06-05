"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { HEADER_SOCIAL_LINKS } from "../../../constants/socials";
import type { HeaderProps } from "../../../types/header.types";

type HeaderMobileDrawerProps = Pick<HeaderProps, "lang" | "dict" | "navGroups"> & {
  isAr: boolean;
  mobileOpen: boolean;
  drawerView: "main" | "categories";
  user: { id: number; name: string; email: string } | null;
  onClose: () => void;
  onSwitchLang: () => void;
  onOpenCategories: () => void;
  onBackToMain: () => void;
  onOpenSearch: () => void;
};

export function HeaderMobileDrawer({
  lang,
  dict,
  navGroups,
  isAr,
  mobileOpen,
  drawerView,
  user,
  onClose,
  onSwitchLang,
  onOpenCategories,
  onBackToMain,
  onOpenSearch
}: HeaderMobileDrawerProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-90 bg-black/40 transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 z-100 flex w-[min(320px,92vw)] flex-col bg-canvas shadow-2xl transition-transform duration-300 ease-out ${isAr ? "right-0" : "left-0"} ${mobileOpen ? "translate-x-0" : isAr ? "translate-x-full" : "-translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black px-2 py-2">
          <Image src="/capella logo.png" alt={dict.brand} width={130} height={42} className="h-16 w-auto object-contain" />
          <button
            className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink hover:bg-(--warm-soft)"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon.Close />
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex h-full w-[200%] transition-transform duration-300 ease-out"
            style={{
              transform:
                drawerView === "categories"
                  ? isAr
                    ? "translateX(50%)"
                    : "translateX(-50%)"
                  : "translateX(0)"
            }}
          >
            <div className="flex h-full w-1/2 shrink-0 flex-col gap-0 overflow-y-auto px-5 pb-8 pt-3">
              <button
                type="button"
                onClick={onOpenSearch}
                className="mb-4 flex h-12 w-full items-center gap-2.5 rounded-(--radius-pill) border border-black bg-canvas px-5 text-start text-(--ink-3) transition-colors hover:bg-(--warm-soft)"
              >
                <Icon.Search />
                <span className="min-w-0 flex-1 truncate">{dict.nav.search}</span>
              </button>

              <Link onClick={onClose} href={`/${lang}/shop`} className="flex items-center justify-between border-b border-black px-2 py-4 text-base text-ink transition-colors hover:bg-(--warm-soft)">
                <span>{dict.nav.products}</span>
                <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
              </Link>
              <button
                type="button"
                onClick={onOpenCategories}
                className="flex items-center justify-between border-b border-black bg-transparent px-2 py-4 text-base text-ink transition-colors hover:bg-(--warm-soft)"
              >
                <span>{dict.nav.allCategories}</span>
                <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
              </button>
              <Link onClick={onClose} href={`/${lang}/offers`} className="flex items-center justify-between border-b border-black px-2 py-4 text-base text-accent transition-colors hover:bg-(--accent-soft)">
                <span>{dict.nav.offers}</span>
                <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
              </Link>
              {user && (
                <Link onClick={onClose} href={`/${lang}/orders`} className="flex items-center justify-between border-b border-black px-2 py-4 text-base text-ink transition-colors hover:bg-(--warm-soft)">
                  <span>{dict.nav.orders}</span>
                  <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
                </Link>
              )}

              <div className="mt-8  px-2 pt-6">
                <p className="mb-4 text-xs uppercase tracking-[0.22em] text-(--ink-3)">
                  {dict.nav.followUs}
                </p>
                <div className="flex items-center gap-3">
                  {HEADER_SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
                    <a
                      key={label}
                      href={href}
                      aria-label={label}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-black text-(--ink-3) transition-colors hover:border-accent hover:text-accent"
                    >
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden fill={stroke ? "none" : "currentColor"} stroke={stroke ? "currentColor" : "none"} strokeWidth={stroke ? 2 : 0} strokeLinecap="round" strokeLinejoin="round">
                        <path d={path} />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-8 px-2 pt-6">
                <div className="grid grid-cols-2 gap-2">
                  {(["ar", "en"] as const).map((code) => {
                    const isActive = lang === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={isActive ? undefined : onSwitchLang}
                        aria-pressed={isActive}
                        className={`h-11 rounded-(--radius-pill) border text-base font-semibold transition-colors ${
                          isActive
                            ? "border-accent bg-accent text-canvas"
                            : "border-black text-ink hover:bg-(--warm-soft)"
                        }`}
                      >
                        {code === "ar" ? dict.langSwitch.ar : dict.langSwitch.en}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex h-full w-1/2 shrink-0 flex-col gap-0 overflow-y-auto px-5 pb-8 pt-3">
              <button
                type="button"
                onClick={onBackToMain}
                className="mb-2 flex items-center gap-2 border-b border-black bg-transparent px-2 py-4 text-base text-ink transition-colors hover:bg-(--warm-soft)"
              >
                <Icon.Chevron className={`text-(--ink-3) ${isAr ? "" : "rotate-180"}`} />
                <span>{dict.common.back}</span>
              </button>

              <div className="px-2 pb-2 pt-2 text-xs uppercase tracking-[0.22em] text-(--ink-3)">
                {dict.nav.allCategories}
              </div>

              {navGroups.map((g) => (
                <Link
                  key={g.root.id}
                  onClick={onClose}
                  href={`/${lang}/category/${g.root.slug}`}
                  className="flex items-center justify-between border-b border-black px-2 py-4 text-base text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink"
                >
                  <span>{isAr ? g.root.name.ar : g.root.name.en}</span>
                  <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
