import type { Category, Language, Offer, Product } from "@capella/shared";

export interface AskCapellaOverlayProps {
  lang: Language;
  onClose: () => void;
}

export interface AskCapellaResults {
  products: Product[];
  categories: Category[];
  offers: Offer[];
}

export type AskCapellaMessage =
  | { role: "user"; text: string }
  | { role: "capella"; results: AskCapellaResults; query: string; error?: boolean; errorMessage?: string };
