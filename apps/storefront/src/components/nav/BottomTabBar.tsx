"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BagIcon, CartIcon, HeartIcon, PercentIcon } from "../icons";
import { useLocale } from "../i18n/LocaleProvider";
import { useWishlist } from "@/hooks/useWishlist";
import { CART_KEY, CART_UPDATED_EVENT, cartCount, readCart } from "@/lib/cart";

function Tab({
  href,
  label,
  icon,
  count
}: {
  href: string;
  label: string;
  icon: ReactNode;
  /** Rendered as a badge when present — including at zero, as the design shows. */
  count?: number;
}) {
  return (
    <a href={href} className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-navy">
      <span className="relative flex h-6 items-center justify-center">
        {icon}
        {count !== undefined && (
          <span className="absolute -end-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </span>
      <span className="text-[11px] font-semibold">{label}</span>
    </a>
  );
}

/**
 * Fixed mobile tab bar (Shop / Sale / Wishlist / Cart) with live wishlist and
 * cart counts. Hidden from `lg` up, where the same actions live in the header.
 * `body` reserves its height in globals.css so it never covers the footer.
 */
export function BottomTabBar() {
  const { lang, dict } = useLocale();
  const { ids } = useWishlist();
  const [cartLines, setCartLines] = useState(0);

  useEffect(() => {
    const updateCart = () => setCartLines(cartCount(readCart()));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CART_KEY) updateCart();
    };
    updateCart();
    window.addEventListener(CART_UPDATED_EVENT, updateCart);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, updateCart);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const href = (path: string) => `/${lang}${path}`;

  return (
    <nav
      aria-label={dict.header.quickLinks}
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] lg:hidden"
    >
      <Tab href={href("/shop")} label={dict.header.shop} icon={<BagIcon className="h-6 w-6" />} />
      <Tab
        href={href("/offers")}
        label={dict.header.sale}
        icon={
          <span className="flex h-6 w-6 items-center justify-center rounded border border-brand-red text-brand-red">
            <PercentIcon className="h-4 w-4" />
          </span>
        }
      />
      <Tab
        href={href("/wishlist")}
        label={dict.header.wishlist}
        icon={<HeartIcon className="h-6 w-6" fill={ids.length > 0 ? "currentColor" : "none"} />}
        count={ids.length}
      />
      <Tab href={href("/cart")} label={dict.header.cart} icon={<CartIcon className="h-6 w-6" />} count={cartLines} />
    </nav>
  );
}
