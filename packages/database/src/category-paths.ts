import { categoryPaths, categories } from "../drizzle/schema.js";
import { db } from "./db.js";

type CategoryRow = {
  id: number;
  parentId: number | null;
};

export async function rebuildCategoryPaths() {
  const rows = await db
    .select({
      id: categories.id,
      parentId: categories.parentId
    })
    .from(categories);

  const pathRows = buildCategoryPaths(rows);

  await db.transaction(async (tx) => {
    await tx.delete(categoryPaths);
    if (pathRows.length > 0) {
      await tx.insert(categoryPaths).values(pathRows);
    }
  });
}

export function buildCategoryPaths(rows: CategoryRow[]) {
  const byParent = new Map<number | null, CategoryRow[]>();
  for (const row of rows) {
    const siblings = byParent.get(row.parentId) ?? [];
    siblings.push(row);
    byParent.set(row.parentId, siblings);
  }

  const pathRows: Array<{
    ancestorId: number;
    descendantId: number;
    depth: number;
  }> = [];

  const visit = (
    node: CategoryRow,
    ancestors: Array<{ id: number; depth: number }>
  ) => {
    pathRows.push({ ancestorId: node.id, descendantId: node.id, depth: 0 });
    for (const ancestor of ancestors) {
      pathRows.push({
        ancestorId: ancestor.id,
        descendantId: node.id,
        depth: ancestor.depth + 1
      });
    }

    for (const child of byParent.get(node.id) ?? []) {
      visit(child, [{ id: node.id, depth: 0 }, ...ancestors.map((ancestor) => ({ id: ancestor.id, depth: ancestor.depth + 1 }))]);
    }
  };

  for (const root of byParent.get(null) ?? []) {
    visit(root, []);
  }

  return pathRows;
}
