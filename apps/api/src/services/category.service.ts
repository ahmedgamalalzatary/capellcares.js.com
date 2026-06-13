// Category business rules. The repository handles raw persistence; this layer
// enforces the invariants (no parent cycles, unique sibling slugs, unique
// grandchild names) and throws the coded errors the controller maps to HTTP
// responses.
import { buildLineage, collectDescendantIds } from "../repositories/category-tree.js";
import {
  findSameParentGrandchildNameConflictRepo,
  findSiblingSlugConflictRepo,
  getCategoryByIdRepo,
  loadCategoryNodesRepo,
  writeCategoryRepo,
  type CategoryWriteInput
} from "../repositories/category.repository.js";

function throwCoded(code: string, message: string): never {
  const error = new Error(message);
  (error as Error & { code?: string }).code = code;
  throw error;
}

// A category may not be parented to itself or to any of its descendants.
// collectDescendantIds(categoryId) is self-inclusive, so it covers both.
function wouldCreateCategoryCycle(
  categoryId: number,
  nextParentId: number | null,
  rows: Array<{ id: number; parentId: number | null }>
) {
  if (nextParentId == null) {
    return false;
  }
  return collectDescendantIds(categoryId, rows).includes(nextParentId);
}

export async function upsertCategory(input: CategoryWriteInput) {
  const previous = input.id ? await getCategoryByIdRepo(input.id) : null;
  const allCategories = await loadCategoryNodesRepo();

  if (input.id && wouldCreateCategoryCycle(input.id, input.parentId, allCategories)) {
    throwCoded(
      "CATEGORY_INVALID_PARENT",
      "Category parent cannot be the category itself or one of its descendants"
    );
  }

  const slugConflict = await findSiblingSlugConflictRepo({
    id: input.id,
    parentId: input.parentId,
    slug: input.slug
  });
  if (slugConflict) {
    throwCoded("CATEGORY_SLUG_CONFLICT", "Category slug already exists under this parent");
  }

  const isGrandchildCategory = buildLineage(input.parentId, allCategories).length === 2;
  if (isGrandchildCategory) {
    const nameConflict = await findSameParentGrandchildNameConflictRepo({
      id: input.id,
      parentId: input.parentId,
      arName: input.arName,
      enName: input.enName
    });
    if (nameConflict) {
      throwCoded("CATEGORY_NAME_CONFLICT", "Category name already exists under this parent");
    }
  }

  return writeCategoryRepo(input, previous?.parentId ?? null);
}
