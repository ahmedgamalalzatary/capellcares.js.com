import type { Language, ProductAttribute } from "@capella/shared";
import type { HeaderMenuEntry } from "@/lib/header-menu";

export interface HeaderProps {
  lang: Language;
  dict: any;
  menuEntries: HeaderMenuEntry[];
  brands?: ProductAttribute[];
  genders?: ProductAttribute[];
  announcements?: string[] | null;
}
