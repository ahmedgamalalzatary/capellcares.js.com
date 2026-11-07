import type { Language, Product } from "@capella/shared";
import type { HeaderMenuEntry } from "@/lib/header-menu";

export interface HeaderProps {
  lang: Language;
  dict: any;
  menuEntries: HeaderMenuEntry[];
  announcements?: string[] | null;
  /** Up to 10 best sellers for the search screen's suggestions. */
  bestsellers?: Product[];
}
