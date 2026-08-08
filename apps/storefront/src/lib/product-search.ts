import type { Product } from "@capella/shared";

/**
 * The one definition of "does this product match what the shopper typed".
 *
 * Both the header overlay and the /products?q= grid go through this, so the
 * dropdown can never preview a match the results page then fails to find.
 * Matching spans *both* names plus the keywords: a product is routinely named
 * in one language and searched for in the other, and its keywords carry terms
 * ("lotion") that appear in neither name.
 *
 * An empty term means "no constraint" and matches everything; callers decide
 * whether an empty search should list all products or none.
 */
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
