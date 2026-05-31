import type { NextFunction, Request, Response } from "express";
import {
  hasActiveChildrenCategoriesRepo,
  hasLinkedProductsInCategoryRepo,
  listCategoriesRepo,
  restoreCategoryRepo,
  softDeleteCategoryRepo,
  upsertCategoryRepo
} from "../../../repositories/category.repository.js";
import { toSlug } from "../../../services/slug.service.js";

function isDuplicateEntryError(error: unknown) {
  const candidate = error as
    | { code?: string; message?: string; cause?: { code?: string; message?: string } }
    | undefined;

  return (
    candidate?.code === "ER_DUP_ENTRY" ||
    candidate?.cause?.code === "ER_DUP_ENTRY" ||
    candidate?.message?.includes("Duplicate entry") ||
    candidate?.cause?.message?.includes("Duplicate entry")
  );
}

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
