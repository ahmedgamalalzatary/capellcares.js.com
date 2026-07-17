"use client";

import { useEffect, useState } from "react";
import { CartIcon, CloseIcon, MenuIcon, UserIcon } from "../icons";
import { useLocale } from "../i18n/LocaleProvider";
import { LangSwitcher } from "./LangSwitcher";
import { AUTH_UPDATED_EVENT, logout, readAuth, type AuthState } from "@/lib/auth";
import { CART_UPDATED_EVENT, cartCount, readCart } from "@/lib/cart";

type NavItem = { label: string; href: string };

/**
 * White navigation row: primary menu (catalog routes) on the left, secondary
 * links plus the language switch, account, and live cart pill on the right.
 * Collapses into a hamburger-toggled panel below the `lg` breakpoint.
 */
export function NavBar() {
  const { lang, dict } = useLocale();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    const updateCart = () => setCount(cartCount(readCart()));
    const updateAuth = () => setAuth(readAuth());
    updateCart();
    updateAuth();
    window.addEventListener(CART_UPDATED_EVENT, updateCart);
    window.addEventListener("storage", updateCart);
    window.addEventListener(AUTH_UPDATED_EVENT, updateAuth);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, updateCart);
      window.removeEventListener("storage", updateCart);
      window.removeEventListener(AUTH_UPDATED_EVENT, updateAuth);
    };
  }, []);

  const href = (path: string) => `/${lang}${path}`;
  const navItems: NavItem[] = [
    { label: dict.header.menu.home, href: `/${lang}` },
    { label: dict.pages.products, href: href("/products") },
    { label: dict.header.menu.newArrivals, href: href("/newarrivals") },
    { label: dict.pages.bestSellers, href: href("/bestsellers") },
    { label: dict.pages.offers, href: href("/offers") },
    { label: dict.pages.collections, href: href("/collections") }
  ];
  const mobileItems: NavItem[] = navItems;

  const onLogout = async () => {
    await logout();
    setOpen(false);
  };

  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="container flex items-center justify-between gap-4 py-3 text-[13px] font-semibold tracking-wide text-navy">
        {/* Mobile: hamburger toggle */}
        <button
          type="button"
          aria-label={dict.header.toggleMenu}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-navy lg:hidden"
        >
          {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>

        {/* Desktop: primary menu */}
        <ul className="hidden items-center gap-5 lg:flex xl:gap-7">
          {navItems.map((item) => (
            <li key={item.label}>
              <a href={item.href} className="flex items-center gap-1 uppercase hover:text-brand-red">
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4 xl:gap-7">
          <LangSwitcher />

          {/* Signed-in greeting + logout; signed-out login lives on the account icon in the search row. */}
          {auth && (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="flex items-center gap-1.5">
                <UserIcon className="h-5 w-5" />
                {auth.user.name}
              </span>
              <button type="button" onClick={onLogout} className="cursor-pointer text-gray-400 hover:text-brand-red">
                {dict.auth.logout}
              </button>
            </div>
          )}

          <a
            href={href("/cart")}
            className="relative flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-white sm:px-6 sm:py-2.5"
            aria-label={dict.header.cart}
          >
            <CartIcon className="h-4 w-4" />
            <span className="whitespace-nowrap">{dict.header.cart}</span>
            {count > 0 && (
              <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-navy">
                {count}
              </span>
            )}
          </a>
        </div>
      </div>

      {/* Mobile: collapsible menu panel */}
      {open && (
        <div className="border-t border-gray-100 lg:hidden">
          <ul className="container flex flex-col py-2 text-sm font-semibold tracking-wide text-navy">
            {mobileItems.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="flex items-center justify-between border-b border-gray-50 py-3 uppercase hover:text-brand-red"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              </li>
            ))}
            {auth && (
              <li>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full cursor-pointer border-b border-gray-50 py-3 text-start hover:text-brand-red"
                >
                  {dict.auth.logout} ({auth.user.name})
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </nav>
  );
}
