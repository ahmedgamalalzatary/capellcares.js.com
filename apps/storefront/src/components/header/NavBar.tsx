"use client";

import { useState } from "react";
import { ChevronDown, CloseIcon, HeartIcon, MenuIcon } from "../icons";
import { useLocale } from "../i18n/LocaleProvider";
import { LangSwitcher } from "./LangSwitcher";

type NavItem = { label: string; hasDropdown?: boolean };

/**
 * White navigation row: primary menu on the left, secondary links plus the
 * language switch, wishlist, and cart pill on the right. Collapses into a
 * hamburger-toggled panel below the `lg` breakpoint.
 */
export function NavBar() {
  const { dict } = useLocale();
  const [open, setOpen] = useState(false);

  const menu = dict.header.menu;
  const navItems: NavItem[] = [
    { label: menu.home },
    { label: menu.newArrivals },
    { label: menu.women, hasDropdown: true },
    { label: menu.men, hasDropdown: true },
    { label: menu.kids, hasDropdown: true },
    { label: menu.collection, hasDropdown: true },
    { label: menu.sale }
  ];
  const secondaryLinks = [dict.header.secondary.aboutUs, dict.header.secondary.contact];
  const mobileItems: NavItem[] = [...navItems, ...secondaryLinks.map((label) => ({ label }))];

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
              <a href="#" className="flex items-center gap-1 hover:text-brand-red">
                {item.label}
                {item.hasDropdown && <ChevronDown className="h-3 w-3" />}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4 xl:gap-7">
          {secondaryLinks.map((link) => (
            <a key={link} href="#" className="hidden hover:text-brand-red lg:inline">
              {link}
            </a>
          ))}

          <LangSwitcher />

          <a href="#" className="flex items-center gap-1.5 hover:text-brand-red" aria-label={dict.header.wishlist}>
            <HeartIcon className="h-5 w-5" />
            <span>0</span>
          </a>

          <a
            href="#"
            className="relative flex items-center rounded-full bg-navy px-4 py-2 text-white sm:px-6 sm:py-2.5"
            aria-label={dict.header.cart}
          >
            <span className="whitespace-nowrap">2,000 EGP</span>
            <span className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-navy">
              1
            </span>
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
                  href="#"
                  className="flex items-center justify-between border-b border-gray-50 py-3 hover:text-brand-red"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  {item.hasDropdown && <ChevronDown className="h-3.5 w-3.5" />}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
