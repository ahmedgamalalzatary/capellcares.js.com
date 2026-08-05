import type { Language } from "@minikoshk/shared";
import type { StorefrontBundle } from "@/lib/bundles";
import type { StorefrontCategory } from "@/lib/categories";
import type { StorefrontProduct } from "@/lib/products";

export interface AskMinikoshkProps {
  lang: Language;
  onClose: () => void;
}

export interface AskMinikoshkResults {
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
  offers: StorefrontBundle[];
  collections: StorefrontBundle[];
}

export type AskMinikoshkMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; query: string; results: AskMinikoshkResults; error?: boolean };
