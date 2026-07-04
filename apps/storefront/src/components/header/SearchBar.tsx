"use client";

import { Logo } from "../Logo";
import { SearchIcon, UserIcon } from "../icons";
import { useLocale } from "../i18n/LocaleProvider";

/**
 * Light search row: a large rounded search field with a navy circular submit
 * button, the hotline number, and the account icon on the right. Spacing uses
 * logical properties so it mirrors correctly in RTL.
 */
export function SearchBar() {
  const { dict } = useLocale();

  return (
    <div className="bg-search-bg">
      <div className="container flex items-center gap-3 py-3 sm:gap-6">
        <Logo size={56} className="hidden shrink-0 sm:block" />
        <Logo size={44} className="shrink-0 sm:hidden" />
        <form className="relative min-w-0 flex-1" role="search">
          <input
            type="search"
            placeholder={dict.header.searchPlaceholder}
            aria-label={dict.header.search}
            className="h-11 w-full rounded-full border-none bg-white ps-5 pe-14 text-sm text-navy outline-none placeholder:text-gray-400 sm:h-12 sm:ps-6 sm:pe-16"
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
          <button aria-label={dict.header.account} className="cursor-pointer text-navy">
            <UserIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
