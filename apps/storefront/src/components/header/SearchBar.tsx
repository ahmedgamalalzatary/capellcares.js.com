import { Logo } from "../Logo";
import { SearchIcon, UserIcon } from "../icons";

/**
 * Light search row: a large rounded search field with a navy circular submit
 * button, the hotline number, and the account icon on the right.
 */
export function SearchBar() {
  return (
    <div className="bg-search-bg">
      <div className="container flex items-center gap-3 py-3 sm:gap-6">
        <Logo size={56} className="hidden shrink-0 sm:block" />
        <Logo size={44} className="shrink-0 sm:hidden" />
        <form className="relative min-w-0 flex-1" role="search">
          <input
            type="search"
            placeholder="What are you looking for?"
            aria-label="Search"
            className="h-11 w-full rounded-full border-none bg-white pl-5 pr-14 text-sm text-navy outline-none placeholder:text-gray-400 sm:h-12 sm:pl-6 sm:pr-16"
          />
          <button
            type="submit"
            aria-label="Search"
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-navy text-white"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden text-lg font-semibold tracking-wide text-navy md:inline">16772</span>
          <button aria-label="Account" className="cursor-pointer text-navy">
            <UserIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
