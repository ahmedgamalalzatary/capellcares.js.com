import type { NextFunction, Request, Response } from "express";
import {
  hasActiveChildrenCategoriesRepo,
  hasLinkedProductsInCategoryRepo,
  listCategoriesRepo,
  reorderRootCategoriesRepo,
  restoreCategoryRepo,
  softDeleteCategoryRepo,
  upsertCategoryRepo
} from "../../../repositories/category.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { isDuplicateEntryError } from "../shared/db-errors.js";

export async function adminListCategories(_req: Request, res: Response) {
  res.json({ items: await listCategoriesRepo(true) });
}

export async function adminUpsertCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
    await upsertCategoryRepo({
      id: incoming.id,
      parentId: incoming.parentId,
      slug: toSlug(incoming.slug || incoming.name?.en || incoming.enName || incoming.name?.ar || incoming.arName),
      arName: incoming.name?.ar ?? incoming.arName ?? "",
      enName: incoming.name?.en ?? incoming.enName ?? "",
      isLeaf: Boolean(incoming.isLeaf)
    });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "CATEGORY_SLUG_CONFLICT") {
      return res.status(409).json({ ok: false, reason: "slug-conflict" });
    }
    if (error?.code === "CATEGORY_NAME_CONFLICT") {
      return res.status(409).json({ ok: false, reason: "category-name-conflict" });
    }
    if (isDuplicateEntryError(error)) {
      return res.status(409).json({ ok: false, reason: "slug-conflict" });
    }
    next(error);
  }
}

export async function adminSoftDeleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const hasLinked = await hasLinkedProductsInCategoryRepo(id);
    if (hasLinked) return res.status(409).json({ ok: false, reason: "has-products" });
    const hasActiveChildren = await hasActiveChildrenCategoriesRepo(id);
    if (hasActiveChildren) return res.status(409).json({ ok: false, reason: "has-active-children" });
    await softDeleteCategoryRepo(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function adminRestoreCategory(req: Request, res: Response, next: NextFunction) {
  try {
    await restoreCategoryRepo(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function adminReorderRootCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((value: unknown): number => Number(value))
      : [];

    if (ids.length === 0 || ids.some((id: number) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({ ok: false, reason: "invalid-root-order" });
    }

    await reorderRootCategoriesRepo(ids);
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "INVALID_ROOT_ORDER") {
      return res.status(400).json({ ok: false, reason: "invalid-root-order" });
    }
    next(error);
  }
}
