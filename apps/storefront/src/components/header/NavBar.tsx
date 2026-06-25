import { ChevronDown, HeartIcon } from "./icons";

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

/**
 * White navigation row: primary menu on the left, secondary links plus the
 * wishlist and cart pill on the right.
 */
export function NavBar() {
  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="container flex items-center justify-between py-3 text-[13px] font-semibold tracking-wide text-navy">
        <ul className="flex items-center gap-7">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <a href="#" className="flex items-center gap-1 hover:text-brand-red">
                {item.label}
                {item.hasDropdown && <ChevronDown className="h-3 w-3" />}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-7">
          <a href="#" className="hover:text-brand-red">ABOUT US</a>
          <a href="#" className="hover:text-brand-red">CONTACT</a>

          <a href="#" className="flex items-center gap-1.5 hover:text-brand-red" aria-label="Wishlist">
            <HeartIcon className="h-5 w-5" />
            <span>0</span>
          </a>

          <a
            href="#"
            className="relative flex items-center rounded-full bg-navy px-6 py-2.5 text-white"
            aria-label="Cart"
          >
            <span>2,000 EGP</span>
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-navy">
              1
            </span>
          </a>
        </div>
      </div>
    </nav>
  );
}
