"use client";

import { useEffect, useState } from "react";
import { CartIcon, UserIcon } from "../icons";
import { useLocale } from "../i18n/LocaleProvider";
import { LangSwitcher } from "./LangSwitcher";
import { AUTH_KEY, AUTH_UPDATED_EVENT, logout, readAuth, type AuthState } from "@/lib/auth";
import { CART_KEY, CART_UPDATED_EVENT, cartCount, readCart } from "@/lib/cart";

type NavItem = { label: string; href: string };

/**
 * White navigation row: primary menu (catalog routes) on the left, secondary
 * links plus the language switch, account, and live cart pill on the right.
 * Desktop only — below `lg` these actions live in the mobile drawer
 * (`MobileHeader`) and the bottom tab bar (`BottomTabBar`).
 */
export function NavBar() {
  const { lang, dict } = useLocale();
  const [count, setCount] = useState(0);
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    const updateCart = () => setCount(cartCount(readCart()));
    const updateAuth = () => setAuth(readAuth());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CART_KEY) updateCart();
      if (event.key === null || event.key === AUTH_KEY) updateAuth();
    };
    updateCart();
    updateAuth();
    window.addEventListener(CART_UPDATED_EVENT, updateCart);
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_UPDATED_EVENT, updateAuth);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, updateCart);
      window.removeEventListener("storage", onStorage);
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

  const onLogout = async () => {
    await logout();
  };

  return (
    <nav className="hidden border-b border-gray-100 bg-white lg:block">
      <div className="container flex items-center justify-between gap-4 py-3 text-[13px] font-semibold tracking-wide text-navy">
        <ul className="flex items-center gap-5 xl:gap-7">
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
            <div className="flex items-center gap-2">
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
            className="relative flex items-center gap-2 rounded-full bg-navy px-6 py-2.5 text-white"
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
    </nav>
  );
}
