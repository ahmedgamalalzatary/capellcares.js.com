import type { Product } from "@capella/shared";

export interface ProductListRowData {
  product: Product;
  categoryName: string;
  prices: number[];
  stockSum: number;
}

export interface ProductFiltersState {
  search: string;
  statusFilter: "all" | "active" | "inactive";
  categoryFilter: number | "";
}
