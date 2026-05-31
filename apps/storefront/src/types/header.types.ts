import type { Language } from "@capella/shared";
import type { NavGroup } from "@/lib/nav";

export interface HeaderProps {
  lang: Language;
  dict: any;
  navGroups: NavGroup[];
}

export type HeaderSearchHandlers = {
  q: string;
  onSearchInput: (value: string) => void;
  onSearch: (e: React.FormEvent) => void;
};
