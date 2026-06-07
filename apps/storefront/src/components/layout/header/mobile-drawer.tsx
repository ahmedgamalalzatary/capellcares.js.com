"use client";

import Link from "next/link";
import { useState } from "react";
import type { NavNode } from "@/lib/nav";
import { Icon } from "@/components/ui/icons";
import { HEADER_SOCIAL_LINKS } from "../../../constants/socials";
import type { HeaderProps } from "../../../types/header.types";

type HeaderMobileDrawerProps = Pick<HeaderProps, "lang" | "dict" | "navGroups"> & {
  isAr: boolean;
  mobileOpen: boolean;
  user: { id: number; name: string; email: string } | null;
  onClose: () => void;
  onSwitchLang: () => void;
  onOpenSearch: () => void;
};

export function HeaderMobileDrawer({
  lang,
  dict,
  navGroups,
  isAr,
  mobileOpen,
  user,
  onClose,
  onSwitchLang,
  onOpenSearch
}: HeaderMobileDrawerProps) {
  const [activeTab, setActiveTab] = useState(0);
  // The tab currently sliding out, kept mounted until its exit animation ends.
  const [prevTab, setPrevTab] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const activeGroup = navGroups[activeTab];
  const prevGroup = prevTab !== null ? navGroups[prevTab] : null;

  const selectTab = (index: number) => {
    if (index === activeTab) return;
    setDir(index > activeTab ? 1 : -1);
    setPrevTab(activeTab);
    setActiveTab(index);
  };

  // Incoming enters from the trailing side; outgoing exits toward the leading side.
  // Mirror the direction in RTL.
  const fromRight = dir === 1 ? !isAr : isAr;

  const renderCards = (group: NonNullable<typeof activeGroup>) =>
    group.children.length > 0 ? (
      group.children.map((child) => (
        <CategoryCard
          key={child.id}
          lang={lang}
          href={`/${lang}/category/${child.slug}`}
          title={child.label}
          subtitle={
            child.children.length
              ? child.children.map((g) => g.label).join(" · ")
              : (isAr ? group.root.name.ar : group.root.name.en)
          }
          count={child.children.length}
          children={child.children}
          isAr={isAr}
          onClick={onClose}
        />
      ))
    ) : (
      <CategoryCard
        lang={lang}
        href={`/${lang}/category/${group.root.slug}`}
        title={isAr ? group.root.name.ar : group.root.name.en}
        subtitle={dict.nav.viewAll}
        count={0}
        children={[]}
        isAr={isAr}
        onClick={onClose}
      />
    );

  return (
    <>
      {/* Backdrop — invisible click-catcher to close; no dimming so the page shows through */}
      <div
        className={`fixed inset-0 transition-opacity duration-300 ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drop-down wrapper — anchored to the bottom of the header, clips the panel */}
      <div className="pointer-events-none absolute inset-x-0 top-full overflow-hidden mx-4">
        <div
          dir={isAr ? "rtl" : "ltr"}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`pointer-events-auto flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto bg-[#f1f0ed] transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="px-4 sm:px-6 pb-8 pt-4">
            {/* Search */}
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex h-12 w-full items-center gap-2.5 rounded-(--radius-pill) border border-(--hairline) bg-surface px-5 text-start text-(--ink-3) transition-colors hover:border-warm"
            >
              <Icon.Search />
              <span className="min-w-0 flex-1 truncate">{dict.nav.search}</span>
            </button>

            {/* Category tabs */}
            <div className="-mx-4 mt-5 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
              <div className="flex min-w-max gap-7">
                {navGroups.map((group, index) => {
                  const active = index === activeTab;
                  const name = isAr ? group.root.name.ar : group.root.name.en;
                  return (
                    <button
                      key={group.root.id}
                      type="button"
                      onClick={() => selectTab(index)}
                      className={`relative shrink-0 whitespace-nowrap pb-2 text-sm tracking-[0.04em] transition-colors ${
                        isAr ? "" : "uppercase"
                      } ${active ? "font-semibold text-ink" : "text-(--ink-3) hover:text-(--ink-2)"}`}
                    >
                      {name}
                      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="-mx-4 h-px bg-(--hairline)" />

            {/* Cards — subcategories of the active tab. The incoming group lives in
                normal flow (defines height); the outgoing group is overlaid absolutely
                and slides out so both move together like a carousel. */}
            {activeGroup && (
              <div className="relative -mx-4 mt-5 overflow-hidden px-4">
                <div
                  key={activeTab}
                  className={`flex flex-col gap-3 animate-in fade-in duration-300 ${
                    fromRight ? "slide-in-from-right-16" : "slide-in-from-left-16"
                  }`}
                >
                  {renderCards(activeGroup)}
                </div>
                {prevGroup && (
                  <div
                    key={`out-${prevTab}`}
                    onAnimationEnd={() => setPrevTab(null)}
                    className={`absolute inset-x-4 top-0 flex flex-col gap-3 animate-out fade-out duration-300 ${
                      fromRight ? "slide-out-to-left-16" : "slide-out-to-right-16"
                    }`}
                  >
                    {renderCards(prevGroup)}
                  </div>
                )}
              </div>
            )}

            {/* Quick links */}
            <div className="mt-6 flex flex-col">
              <DrawerLink href={`/${lang}/shop`} isAr={isAr} onClick={onClose}>
                {dict.nav.products}
              </DrawerLink>
              <DrawerLink href={`/${lang}/offers`} isAr={isAr} onClick={onClose} accent>
                {dict.nav.offers}
              </DrawerLink>
              {user && (
                <DrawerLink href={`/${lang}/orders`} isAr={isAr} onClick={onClose}>
                  {dict.nav.orders}
                </DrawerLink>
              )}
            </div>

            {/* Social */}
            <div className="mt-8 px-1">
              <p className={`mb-4 text-xs tracking-[0.22em] text-(--ink-3) ${isAr ? "" : "uppercase"}`}>
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
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-(--hairline) text-(--ink-3) transition-colors hover:border-accent hover:text-accent"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden fill={stroke ? "none" : "currentColor"} stroke={stroke ? "currentColor" : "none"} strokeWidth={stroke ? 2 : 0} strokeLinecap="round" strokeLinejoin="round">
                      <path d={path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Language switch */}
            <div className="mt-8 grid grid-cols-2 gap-2">
              {(["ar", "en"] as const).map((code) => {
                const isActive = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={isActive ? undefined : onSwitchLang}
                    aria-pressed={isActive}
                    className={`h-11 rounded-(--radius-pill) border text-base font-semibold transition-colors ${
                      isActive ? "border-accent bg-accent text-canvas" : "border-(--hairline) text-ink hover:bg-(--warm-soft)"
                    }`}
                  >
                    {code === "ar" ? dict.langSwitch.ar : dict.langSwitch.en}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CategoryCard({
  href,
  title,
  isAr,
  onClick
}: {
  lang: string;
  href: string;
  title: string;
  subtitle: string;
  count: number;
  children: NavNode[];
  isAr: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-md bg-surface p-3 shadow-(--shadow-1)">
      <Link
        href={href}
        onClick={onClick}
        className="group relative flex items-center gap-4 transition-transform duration-200 hover:-translate-y-0.5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-ink">{title}</span>
        </span>

        <Icon.Chevron className={`shrink-0 text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
      </Link>
    </div>
  );
}

function DrawerLink({
  href,
  isAr,
  accent,
  onClick,
  children
}: {
  href: string;
  isAr: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between border-b border-(--hairline) px-1 py-4 text-base transition-colors hover:text-accent ${
        accent ? "text-accent" : "text-ink"
      }`}
    >
      <span>{children}</span>
      <Icon.Chevron className={`text-(--ink-3) ${isAr ? "rotate-180" : ""}`} />
    </Link>
  );
}
