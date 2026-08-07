"use client";

import { Logo } from "../Logo";
import { SearchIcon, UserIcon } from "../icons";
import { useLocale } from "../i18n/LocaleProvider";
import { WishlistLink } from "./WishlistLink";

/**
 * Light search row: a large rounded search field with a navy circular submit
 * button, the hotline number, and the account icon on the right. Spacing uses
 * logical properties so it mirrors correctly in RTL. Desktop only — below `lg`
 * the search field lives in the mobile drawer (see `MobileHeader`).
 */
export function SearchBar() {
  const { lang, dict } = useLocale();

  return (
    <div className="hidden bg-search-bg lg:block">
      <div className="container flex items-center gap-6 py-3">
        <Logo size={56} className="shrink-0" />
        <form className="relative min-w-0 flex-1" role="search" action={`/${lang}/products`}>
          <input
            type="search"
            name="q"
            placeholder={dict.header.searchPlaceholder}
            aria-label={dict.header.search}
            className="h-12 w-full rounded-full border-none bg-white ps-6 pe-16 text-sm text-navy outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            aria-label={dict.header.search}
            className="absolute end-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-navy text-white"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-4">
          <WishlistLink />
          <a href={`/${lang}/login`} aria-label={dict.header.account} className="cursor-pointer text-navy">
            <UserIcon className="h-6 w-6" />
          </a>
        </div>
      </div>
    </div>
  );
}
