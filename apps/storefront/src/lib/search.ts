import { apiGet } from "./api/client";
import type { AskMinikoshkResults } from "@/types/ask-minikoshk.types";

export async function searchStorefront(query: string): Promise<AskMinikoshkResults> {
  const params = new URLSearchParams({ q: query });
  const results = await apiGet<AskMinikoshkResults>(`/search?${params.toString()}`);
  if (!results) {
    throw new Error("Search endpoint not found");
  }
  return results;
}
