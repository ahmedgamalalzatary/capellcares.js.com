import { products } from "../../../data/store.js";
import type { Language } from "../../../types/domain.js";

function isVisibleProduct(p: (typeof products)[number]) {
  return p.status === "active" && p.deletedAt === null;
}

export function listStorefrontProducts(args: { lang: Language; q?: string; category?: string }) {
  const q = args.q?.trim().toLowerCase();
  return products
    .filter(isVisibleProduct)
    .filter((p) => (args.category ? p.categorySlug === args.category : true))
    .filter((p) => {
      if (!q) return true;
      const name = args.lang === "en" ? p.enName : p.arName;
      return name.toLowerCase().includes(q);
    });
}

export function getStorefrontProductBySlug(slug: string) {
  return products.find((p) => p.slug === slug && isVisibleProduct(p)) ?? null;
}
