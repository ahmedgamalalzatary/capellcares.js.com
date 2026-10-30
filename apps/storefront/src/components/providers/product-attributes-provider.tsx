"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ProductAttribute } from "@capella/shared";

export interface ProductAttributeLists {
  brands: ProductAttribute[];
  characters: ProductAttribute[];
  ageGroups: ProductAttribute[];
}

const ProductAttributesContext = createContext<ProductAttributeLists>({ brands: [], characters: [], ageGroups: [] });

/** The brand, character and age lists, loaded once by the locale layout for every filter panel and product page. */
export function ProductAttributesProvider({ value, children }: { value: ProductAttributeLists; children: ReactNode }) {
  return <ProductAttributesContext.Provider value={value}>{children}</ProductAttributesContext.Provider>;
}

export function useProductAttributes() {
  return useContext(ProductAttributesContext);
}
