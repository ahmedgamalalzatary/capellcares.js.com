"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { HEADER_SOCIAL_LINKS } from "../socials";
import type { HeaderProps } from "../header.types";

type HeaderMobileDrawerProps = Pick<HeaderProps, "lang" | "dict" | "navGroups"> & {
  isAr: boolean;
  mobileOpen: boolean;
  drawerView: "main" | "categories";
  q: string;
  user: { id: number; name: string; email: string } | null;
  onClose: () => void;
  onOpenCategories: () => void;
  onBackToMain: () => void;
  onSearchInput: (value: string) => void;
  onSearch: (e: React.FormEvent) => void;
};

export function HeaderMobileDrawer({
  lang,
  dict,
  navGroups,
  isAr,
  mobileOpen,
  drawerView,
  q,
  user,
  onClose,
  onOpenCategories,
  onBackToMain,
  onSearchInput,
  onSearch
}: HeaderMobileDrawerProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-90 bg-black/40 transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 z-100 flex w-[min(320px,92vw)] flex-col bg-(--canvas) shadow-2xl transition-transform duration-300 ease-out ${isAr ? "right-0" : "left-0"} ${mobileOpen ? "translate-x-0" : isAr ? "translate-x-full" : "-translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black px-5 py-4">
          <Image src="/logoblack-removebg-preview.png" alt={dict.brand} width={130} height={42} className="h-[34px] w-auto object-contain" />
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
              <form onSubmit={(e) => { onSearch(e); onClose(); }} className="mb-4 flex h-12 items-center gap-2.5 rounded-(--radius-pill) border border-black bg-(--canvas) px-5">
                <Icon.Search />
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-ink outline-none placeholder:text-(--ink-3)"
                  value={q}
                  onChange={(e) => onSearchInput(e.target.value)}
                  placeholder={dict.nav.search}
                  aria-label={dict.nav.search}
                />
              </form>

              <Link onClick={onClose} href={`/${lang}/shop`} className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)">
                <span>{dict.nav.products}</span>
                <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
              </Link>
              <button
                type="button"
                onClick={onOpenCategories}
                className="flex items-center justify-between border-b border-black bg-transparent px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)"
              >
                <span>{dict.nav.allCategories}</span>
                <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
              </button>
              <Link onClick={onClose} href={`/${lang}/offers`} className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-accent transition-colors hover:bg-(--accent-soft)">
                <span>{dict.nav.offers}</span>
                <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
              </Link>
              {user && (
                <Link onClick={onClose} href={`/${lang}/orders`} className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)">
                  <span>{dict.nav.orders}</span>
                  <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
                </Link>
              )}

              <div className="mt-8 border-t border-black px-2 pt-6">
                <p className="mb-4 text-[10px] uppercase tracking-[0.22em] text-(--ink-3)">
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

            <div className="flex h-full w-1/2 shrink-0 flex-col gap-0 overflow-y-auto px-5 pb-8 pt-3">
              <button
                type="button"
                onClick={onBackToMain}
                className="mb-2 flex items-center gap-2 border-b border-black bg-transparent px-2 py-4 text-[15px] text-ink transition-colors hover:bg-(--warm-soft)"
              >
                <Icon.Chevron className={`text-(--ink-3) ${isAr ? "" : "rotate-180"}`} />
                <span>{dict.common.back}</span>
              </button>

              <div className="px-2 pb-2 pt-2 text-[10px] uppercase tracking-[0.22em] text-(--ink-3)">
                {dict.nav.allCategories}
              </div>

              {navGroups.slice(2).map((g) => (
                <Link
                  key={g.root.id}
                  onClick={onClose}
                  href={`/${lang}/category/${g.root.slug}`}
                  className="flex items-center justify-between border-b border-black px-2 py-4 text-[15px] text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink"
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
