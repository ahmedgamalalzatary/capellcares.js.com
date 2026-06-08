import type { Language } from "@capella/shared";
import type { HeaderMenuEntry } from "@/lib/header-menu";

export interface HeaderProps {
  lang: Language;
  dict: any;
  menuEntries: HeaderMenuEntry[];
}
