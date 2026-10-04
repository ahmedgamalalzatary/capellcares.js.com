import type { Product } from "@capella/shared";

/** The one definition of "does this product match what the shopper typed": the client-side half (the /products?q= grid and filter drawer narrow an already-fetched list with it, while global search asks the catalog instead).
 * Matching spans both names plus keywords (a product is often named in one language and searched for in the other, and keywords carry terms in neither name); an empty term matches everything, and callers decide whether an empty search lists all products or none. */
export function matchesProductQuery(
  product: Pick<Product, "name" | "keywords">,
  query: string
): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  const name = `${product.name?.en ?? ""} ${product.name?.ar ?? ""}`.toLowerCase();
  if (name.includes(term)) return true;

  return (product.keywords ?? []).join(" ").toLowerCase().includes(term);
}
