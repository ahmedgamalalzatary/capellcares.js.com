"use client";

import { HeartIcon } from "../icons";
import { useLocale } from "../i18n/LocaleProvider";
import { useWishlist } from "@/hooks/useWishlist";

/** Header wishlist heart with a live count badge, linking to the wishlist page. */
export function WishlistLink() {
  const { lang, dict } = useLocale();
  const { ids } = useWishlist();

  return (
    <a href={`/${lang}/wishlist`} aria-label={dict.header.wishlist} className="relative cursor-pointer text-navy">
      <HeartIcon className="h-6 w-6" fill={ids.length > 0 ? "currentColor" : "none"} />
      {ids.length > 0 && (
        <span className="absolute -end-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">
          {ids.length}
        </span>
      )}
    </a>
  );
}
