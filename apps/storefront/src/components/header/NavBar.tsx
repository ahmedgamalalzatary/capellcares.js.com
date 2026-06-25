"use client";

import { useState } from "react";
import { ChevronDown, CloseIcon, HeartIcon, MenuIcon } from "../icons";

type NavItem = { label: string; hasDropdown?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "HOME" },
  { label: "NEW ARRIVALS" },
  { label: "WOMEN", hasDropdown: true },
  { label: "MEN", hasDropdown: true },
  { label: "KIDS", hasDropdown: true },
  { label: "COLLECTION", hasDropdown: true },
  { label: "SALE" },
];

const SECONDARY_LINKS = ["ABOUT US", "CONTACT"];

const MOBILE_ITEMS: NavItem[] = [...NAV_ITEMS, ...SECONDARY_LINKS.map((label) => ({ label }))];

/**
 * White navigation row: primary menu on the left, secondary links plus the
 * wishlist and cart pill on the right. Collapses into a hamburger-toggled
 * panel below the `lg` breakpoint.
 */
export function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="container flex items-center justify-between gap-4 py-3 text-[13px] font-semibold tracking-wide text-navy">
        {/* Mobile: hamburger toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-navy lg:hidden"
        >
          {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>

        {/* Desktop: primary menu */}
        <ul className="hidden items-center gap-5 lg:flex xl:gap-7">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <a href="#" className="flex items-center gap-1 hover:text-brand-red">
                {item.label}
                {item.hasDropdown && <ChevronDown className="h-3 w-3" />}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4 xl:gap-7">
          {SECONDARY_LINKS.map((link) => (
            <a key={link} href="#" className="hidden hover:text-brand-red lg:inline">
              {link}
            </a>
          ))}

          <a href="#" className="flex items-center gap-1.5 hover:text-brand-red" aria-label="Wishlist">
            <HeartIcon className="h-5 w-5" />
            <span>0</span>
          </a>

          <a
            href="#"
            className="relative flex items-center rounded-full bg-navy px-4 py-2 text-white sm:px-6 sm:py-2.5"
            aria-label="Cart"
          >
            <span className="whitespace-nowrap">2,000 EGP</span>
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-navy">
              1
            </span>
          </a>
        </div>
      </div>

      {/* Mobile: collapsible menu panel */}
      {open && (
        <div className="border-t border-gray-100 lg:hidden">
          <ul className="container flex flex-col py-2 text-sm font-semibold tracking-wide text-navy">
            {MOBILE_ITEMS.map((item) => (
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
