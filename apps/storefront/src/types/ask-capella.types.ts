import type { Category, Collection, Language, Offer, Product } from "@capella/shared";

export interface AskCapellaOverlayProps {
  lang: Language;
  onClose: () => void;
}

export interface AskCapellaResults {
  products: Product[];
  categories: Category[];
  offers: Offer[];
  collections: Collection[];
}

export type AskCapellaMessage =
  | { role: "user"; text: string }
  | { role: "capella"; results: AskCapellaResults; query: string; error?: boolean; errorMessage?: string };
