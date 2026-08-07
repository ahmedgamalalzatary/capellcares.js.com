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

/** A root category plus its direct children, as the mobile drawer renders it. */
export interface CategoryMenuEntry {
  id: number;
  slug: string;
  name: { ar: string; en: string };
}

export interface CategoryMenuNode extends CategoryMenuEntry {
  children: CategoryMenuEntry[];
}

const byDisplayOrder = (a: StorefrontCategory, b: StorefrontCategory) =>
  (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id);

const toMenuEntry = ({ id, slug, name }: StorefrontCategory): CategoryMenuEntry => ({ id, slug, name });

/**
 * Mobile drawer navigation: every live root category, each carrying its live
 * direct children so the drawer can expand it in place. Unlike
 * `selectShopByCategories` this ignores `imagePath` — a category without an
 * image still belongs in the menu.
 */
export function selectMenuCategories(categories: StorefrontCategory[]): CategoryMenuNode[] {
  const live = categories.filter(isLive);

  return live
    .filter((category) => category.parentId == null)
    .sort(byDisplayOrder)
    .map((root) => ({
      ...toMenuEntry(root),
      children: live
        .filter((category) => category.parentId === root.id)
        .sort(byDisplayOrder)
        .map(toMenuEntry)
    }));
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
