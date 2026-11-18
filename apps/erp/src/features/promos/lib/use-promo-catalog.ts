"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { buildPromoCatalog } from "./promo-catalog";

export function usePromoCatalog() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);
  const collections = useStore((s) => s.collections);
  return useMemo(() => buildPromoCatalog({ products, categories, offers, collections }), [products, categories, offers, collections]);
}
