import type { Language } from "@capella/shared";
import type { StorefrontSearchResults } from "../lib/storefront-search";

export interface AskCapellaOverlayProps {
  lang: Language;
  onClose: () => void;
}

export type AskCapellaResults = StorefrontSearchResults;

export type AskCapellaMessage =
  | { role: "user"; text: string }
  | { role: "capella"; results: AskCapellaResults; query: string; error?: boolean; errorMessage?: string };
