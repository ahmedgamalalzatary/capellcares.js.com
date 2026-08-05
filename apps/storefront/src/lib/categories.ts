import { resolveApiBase } from "@minikoshk/shared/api/base";

const API_BASE = resolveApiBase(process.env, { isServer: true });

/**
 * Shape returned by `GET /api/v1/categories` (see catalog.controller `listCategories`).
 * Note the API exposes the bilingual name as a nested object, not `arName`/`enName`.
 */
export interface StorefrontCategory {
  id: number;
  parentId: number | null;
  slug: string;
  sortOrder?: number;
  name: { ar: string; en: string };
  imagePath: string | null;
  isLeaf: boolean;
  deletedAt: string | null;
}

const isLive = (category: StorefrontCategory) => category.deletedAt == null;

/**
 * "Shop by category" shows root and depth-1 categories that an admin has given
 * an image. Roots appear first, with each depth sorted by `sortOrder`.
 */
export function selectShopByCategories(categories: StorefrontCategory[]): StorefrontCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return categories
    .filter((category) => {
      if (!isLive(category) || !category.imagePath) {
        return false;
      }
      if (category.parentId == null) {
        return true;
      }
      const parent = byId.get(category.parentId);
      // Depth-1 means the parent exists, is live, and is itself a root category.
      return parent != null && isLive(parent) && parent.parentId == null;
    })
    .sort((a, b) => {
      const depthDifference = Number(a.parentId != null) - Number(b.parentId != null);
      return depthDifference || (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id);
    });
}

export async function getCategories(): Promise<StorefrontCategory[]> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/categories`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { items?: StorefrontCategory[] };
    return Array.isArray(payload.items) ? payload.items : [];
  } catch {
    return [];
  }
}
