"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "../Logo";
import { ChevronDown, ChevronRight, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "../icons";
import { useLocale } from "../i18n/LocaleProvider";
import { LangOptions } from "./LangSwitcher";
import { AUTH_KEY, AUTH_UPDATED_EVENT, logout, readAuth, type AuthState } from "@/lib/auth";
import type { CategoryMenuNode } from "@/lib/categories";

const rowClass = "flex items-center gap-3 px-6 py-4 text-start hover:text-brand-red";

/**
 * Compact mobile header row: menu toggle, centred brand mark, and the search
 * and account shortcuts. The search field itself lives in the drawer, so this
 * row stays a single line on narrow screens. Hidden from `lg` up, where
 * `SearchBar` + `NavBar` take over.
 */
export function MobileHeader({ menuCategories }: { menuCategories: CategoryMenuNode[] }) {
  const { lang, dict } = useLocale();
  const [open, setOpen] = useState(false);
  const [focusSearch, setFocusSearch] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Return focus to whichever control opened the drawer, matching the pattern
  // the Ask Minikoshk overlay already uses.
  useEffect(() => {
    if (wasOpen.current && !open) {
      toggleRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const openDrawer = (withSearch: boolean) => {
    setFocusSearch(withSearch);
    setOpen(true);
  };

  return (
    <div className="bg-white lg:hidden">
      {/* Equal thirds so the logo is optically centred regardless of how many
          icons sit on either side. */}
      <div className="grid grid-cols-3 items-center px-4 py-3">
        <button
          ref={toggleRef}
          type="button"
          aria-label={dict.header.menuTitle}
          aria-expanded={open}
          onClick={() => openDrawer(false)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center justify-self-start rounded-md text-navy"
        >
          <MenuIcon className="h-7 w-7" />
        </button>

        <Logo size={34} className="justify-self-center" />

        <div className="flex items-center gap-4 justify-self-end">
          <button
            type="button"
            aria-label={dict.header.search}
            onClick={() => openDrawer(true)}
            className="cursor-pointer text-navy"
          >
            <SearchIcon className="h-6 w-6" />
          </button>
          <a href={`/${lang}/login`} aria-label={dict.header.account} className="cursor-pointer text-navy">
            <UserIcon className="h-6 w-6" />
          </a>
        </div>
      </div>

      {open && (
        <MobileDrawer
          menuCategories={menuCategories}
          autoFocusSearch={focusSearch}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function MobileDrawer({
  menuCategories,
  autoFocusSearch,
  onClose
}: {
  menuCategories: CategoryMenuNode[];
  autoFocusSearch: boolean;
  onClose: () => void;
}) {
  const { lang, dict } = useLocale();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateAuth = () => setAuth(readAuth());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === AUTH_KEY) updateAuth();
    };
    updateAuth();
    window.addEventListener(AUTH_UPDATED_EVENT, updateAuth);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AUTH_UPDATED_EVENT, updateAuth);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (autoFocusSearch) {
      searchRef.current?.focus();
      return;
    }
    panelRef.current?.focus();
  }, [autoFocusSearch]);

  // The drawer covers the viewport, so the page behind it must not scroll.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const href = (path: string) => `/${lang}${path}`;
  const categoryHref = (slug: string) => href(`/shop?category=${slug}`);

  const onLogout = async () => {
    await logout();
    onClose();
  };

  return (
    // `inset-0` covers the whole viewport; the panel is the leading slice and
    // the remainder is the dismiss scrim.
    <div className="fixed inset-0 z-50 flex">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={dict.header.menuTitle}
        className="animate-drawer-in flex h-full w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-xl outline-none"
      >
        <form
          role="search"
          action={href("/products")}
          className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-6 py-5"
        >
          <input
            ref={searchRef}
            type="search"
            name="q"
            placeholder={dict.header.searchPlaceholder}
            aria-label={dict.header.search}
            className="min-w-0 flex-1 border-none bg-transparent text-base text-navy outline-none placeholder:text-gray-400"
          />
          <button type="submit" aria-label={dict.header.search} className="cursor-pointer text-navy">
            <SearchIcon className="h-6 w-6" />
          </button>
        </form>

        <nav aria-label={dict.header.menuTitle}>
          <ul className="text-sm font-bold uppercase tracking-wide text-navy">
            <li className="border-b border-gray-200">
              <a href={`/${lang}`} className={rowClass} onClick={onClose}>
                {dict.header.menu.home}
              </a>
            </li>
            <li className="border-b border-gray-200">
              <a href={href("/newarrivals")} className={rowClass} onClick={onClose}>
                {dict.header.menu.newArrivals}
              </a>
            </li>

            {menuCategories.map((category) => {
              const expanded = expandedId === category.id;
              return (
                <li key={category.id} className="border-b border-gray-200">
                  <div className="flex items-stretch">
                    <a href={categoryHref(category.slug)} className={`flex-1 ${rowClass}`} onClick={onClose}>
                      {category.name[lang]}
                    </a>
                    {category.children.length > 0 && (
                      <button
                        type="button"
                        aria-label={category.name[lang]}
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : category.id)}
                        className="flex w-14 shrink-0 cursor-pointer items-center justify-center border-s border-gray-200 text-gray-500"
                      >
                        {expanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                        )}
                      </button>
                    )}
                  </div>

                  {expanded && (
                    <ul className="bg-search-bg text-xs font-semibold normal-case">
                      {category.children.map((child) => (
                        <li key={child.id}>
                          <a
                            href={categoryHref(child.slug)}
                            className="block px-10 py-3 hover:text-brand-red"
                            onClick={onClose}
                          >
                            {child.name[lang]}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}

            <li className="border-b border-gray-200">
              <a href={href("/collections")} className={rowClass} onClick={onClose}>
                {dict.header.menu.collection}
              </a>
            </li>
            <li className="border-b border-gray-200">
              <a href={href("/offers")} className={`${rowClass} text-brand-red`} onClick={onClose}>
                {dict.header.menu.sale}
              </a>
            </li>
          </ul>

          <ul className="text-sm font-medium normal-case text-navy">
            <li className="border-b border-gray-200">
              <a href={href("/wishlist")} className={rowClass} onClick={onClose}>
                <HeartIcon className="h-5 w-5" />
                {dict.header.wishlist}
              </a>
            </li>
            <li className="border-b border-gray-200">
              {auth ? (
                <button type="button" onClick={onLogout} className={`w-full cursor-pointer ${rowClass}`}>
                  <UserIcon className="h-5 w-5" />
                  {dict.auth.logout} ({auth.user.name})
                </button>
              ) : (
                <a href={href("/login")} className={rowClass} onClick={onClose}>
                  <UserIcon className="h-5 w-5" />
                  {dict.header.loginRegister}
                </a>
              )}
            </li>
          </ul>

          <div className="px-6 py-5">
            <LangOptions />
          </div>
        </nav>
      </div>

      {/* The uncovered remainder doubles as the dismiss target. */}
      <button
        type="button"
        aria-label={dict.header.closeMenu}
        onClick={onClose}
        className="animate-scrim-in h-full flex-1 cursor-pointer bg-black/50"
      />
    </div>
  );
}
