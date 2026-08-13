import type { NextFunction, Request, Response } from "express";
import {
  hardDeleteCategoryRepo,
  hasActiveChildrenCategoriesRepo,
  hasLinkedProductsInCategoryRepo,
  listCategoriesRepo,
  reorderCategoriesRepo,
  restoreCategoryRepo,
  softDeleteCategoryRepo
} from "../../../repositories/category.repository.js";
import { upsertCategory } from "../../../services/category.service.js";
import { toSlug } from "../../../services/slug.service.js";
import { isDuplicateEntryError } from "../shared/db-errors.js";

export async function adminListCategories(_req: Request, res: Response) {
  res.json({ items: await listCategoriesRepo(true, "erp") });
}

export async function adminUpsertCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
    await upsertCategory({
      id: incoming.id,
      parentId: incoming.parentId,
      slug: toSlug(incoming.slug || incoming.name?.en || incoming.enName || incoming.name?.ar || incoming.arName),
      arName: incoming.name?.ar ?? incoming.arName ?? "",
      enName: incoming.name?.en ?? incoming.enName ?? "",
      imagePath: typeof incoming.imagePath === "string" && incoming.imagePath.trim() ? incoming.imagePath.trim() : null,
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
    if (error?.code === "CATEGORY_INVALID_PARENT") {
      return res.status(400).json({ ok: false, reason: "invalid-parent" });
    }
    if (error?.code === "CATEGORY_INVALID_IMAGE_DEPTH") {
      return res.status(400).json({ ok: false, reason: "invalid-image-depth" });
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

export async function adminHardDeleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await hardDeleteCategoryRepo(Number(req.params.id));
    if (!deleted) {
      return res.status(404).json({ ok: false, reason: "not-in-trash" });
    }
    res.status(204).end();
  } catch (error) {
    if ((error as { code?: string })?.code === "CATEGORY_LINKED_ENTITIES") {
      return res.status(409).json({ ok: false, reason: "linked-entities" });
    }
    next(error);
  }
}

export async function adminReorderCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((value: unknown): number => Number(value))
      : [];
    const parentIdRaw = req.body?.parentId;
    const parentId = parentIdRaw == null || parentIdRaw === ""
      ? null
      : Number(parentIdRaw);

    if (
      ids.length === 0 ||
      ids.some((id: number) => !Number.isInteger(id) || id <= 0) ||
      (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0))
    ) {
      return res.status(400).json({ ok: false, reason: "invalid-root-order" });
    }

    await reorderCategoriesRepo({ parentId, ids });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "INVALID_ROOT_ORDER") {
      return res.status(400).json({ ok: false, reason: "invalid-root-order" });
    }
    next(error);
  }
}
