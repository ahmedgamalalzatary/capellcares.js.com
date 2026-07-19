"use client";

import { toast } from "sonner";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore, getStore } from "@/lib/store";
import { useCollapsedCategories } from "@/hooks/use-collapsed-categories";
import { Icon } from "@/components/ui/icons";
import { RowMenu } from "@/components/ui/row-menu";
import { Modal } from "@/components/ui/modal";
import { showErrorToast } from "@/lib/errors";
import type { Category } from "@minikoshk/shared";

function categoryParentKey(parentId: number | null) {
  return parentId == null ? "root" : `parent:${parentId}`;
}

export default function CategoriesPage() {
  const { user } = useAdminAuth();
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; blocked: boolean } | null>(null);
  const [draftOrders, setDraftOrders] = useState<Record<string, number[]>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const { collapsed, toggle: toggleCollapsed } = useCollapsedCategories();

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.deletedAt),
    [categories]
  );
  const persistedOrders = useMemo(() => {
    const grouped = new Map<string, number[]>();
    const byParent = new Map<number | null, Category[]>();
    for (const category of activeCategories) {
      const siblings = byParent.get(category.parentId) ?? [];
      siblings.push(category);
      byParent.set(category.parentId, siblings);
    }
    for (const [parentId, siblings] of byParent.entries()) {
      grouped.set(
        categoryParentKey(parentId),
        siblings
          .slice()
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
          .map((category) => category.id)
      );
    }
    return grouped;
  }, [activeCategories]);
  useEffect(() => {
    const nextDrafts = Object.fromEntries(persistedOrders.entries());
    setDraftOrders(nextDrafts);
  }, [persistedOrders]);

  const tree = useMemo(() => {
    const children = new Map<number | null, Category[]>();
    for (const c of activeCategories) {
      const list = children.get(c.parentId) ?? [];
      list.push(c);
      children.set(c.parentId, list);
    }
    for (const [parentId, list] of children.entries()) {
      const orderedIds = draftOrders[categoryParentKey(parentId)];
      if (orderedIds?.length) {
        const orderedItems = orderedIds
          .map((id) => list.find((item) => item.id === id))
          .filter((item): item is Category => Boolean(item));
        children.set(parentId, orderedItems);
        continue;
      }
      list.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.id - right.id);
    }
    return children;
  }, [activeCategories, draftOrders]);

  const productCount = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of products) {
      if (p.deletedAt) continue;
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const onAskDelete = (id: number) => {
    const linked = products.some((p) => !p.deletedAt && p.categoryId === id);
    setPendingDelete({ id, blocked: linked });
  };

  const doDelete = () => {
    if (pendingDelete == null || pendingDelete.blocked) return;
    getStore().softDeleteCategory(pendingDelete.id);
    setPendingDelete(null);
  };

  const dirtyGroups = useMemo(() => {
    return Object.entries(draftOrders).filter(([groupKey, ids]) => {
      const persisted = persistedOrders.get(groupKey) ?? [];
      return ids.length > 0 && (ids.length !== persisted.length || ids.some((id, index) => id !== persisted[index]));
    });
  }, [draftOrders, persistedOrders]);
  const isDirty = dirtyGroups.length > 0;

  const moveCategory = (parentId: number | null, id: number, direction: -1 | 1) => {
    const groupKey = categoryParentKey(parentId);
    setDraftOrders((current) => {
      const source = current[groupKey] ?? persistedOrders.get(groupKey) ?? [];
      const index = source.indexOf(id);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= source.length) {
        return current;
      }

      const next = source.slice();
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return { ...current, [groupKey]: next };
    });
  };

  const saveRootOrder = async () => {
    if (!isDirty || savingOrder) {
      return;
    }

    setSavingOrder(true);
    try {
      for (const [groupKey, ids] of dirtyGroups) {
        const parentId = groupKey === categoryParentKey(null)
          ? null
          : Number(groupKey.replace("parent:", ""));
        await getStore().reorderCategories({ parentId, ids });
      }
      toast.success("تم حفظ ترتيب الأقسام.");
    } catch (error) {
      showErrorToast(error, "تعذر حفظ ترتيب الأقسام. حاول مرة أخرى.");
    } finally {
      setSavingOrder(false);
    }
  };

  if (!canReadErpModule(user, "categories")) {
    return (
      <AdminShell title="الأقسام" crumbs={[{ label: "الأقسام" }]}>
        <ErpForbiddenState message="لا تملك صلاحية الوصول إلى الأقسام." />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="الأقسام"
      crumbs={[{ label: "الأقسام" }]}
      actions={
        <>
          {isDirty && canUpdateErpModule(user, "categories") && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                void saveRootOrder();
              }}
              disabled={savingOrder}
            >
              <Icon.Check /> حفظ ترتيب الأقسام
            </button>
          )}
          {canCreateErpModule(user, "categories") ? <Link href="/categories/new" className="btn btn--primary btn--sm"><Icon.Plus /> قسم جديد</Link> : undefined}
        </>
      }
    >
      <div className="card">
        <div className="card__head">
          <h3 className="card__title">شجرة الأقسام</h3>
          <span className="muted" style={{ fontSize: 12 }}>{categories.filter((c) => !c.deletedAt).length} قسم</span>
        </div>
        <div style={{ padding: 16 }}>
          <Tree
            children={tree.get(null) ?? []}
            depth={0}
            tree={tree}
            productCount={productCount}
            canEdit={canUpdateErpModule(user, "categories")}
            canDelete={canSoftDeleteErpModule(user, "categories")}
            onDelete={onAskDelete}
            onMoveCategory={moveCategory}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        </div>
      </div>

      <Modal
        open={pendingDelete != null}
        title={pendingDelete?.blocked ? "لا يمكن حذف القسم" : "تأكيد الحذف"}
        onClose={() => setPendingDelete(null)}
        footer={
          pendingDelete?.blocked
            ? <button className="btn btn--ghost btn--sm" onClick={() => setPendingDelete(null)}>تم</button>
            : <>
                <button className="btn btn--ghost btn--sm" onClick={() => setPendingDelete(null)}>إلغاء</button>
                <button className="btn btn--danger btn--sm" onClick={doDelete}>حذف القسم</button>
              </>
        }
      >
        {pendingDelete?.blocked ? (
          <p style={{ margin: 0 }}>هذا القسم يحتوي على منتجات مرتبطة. الرجاء نقل المنتجات إلى قسم آخر أولًا ثم أعد المحاولة.</p>
        ) : (
          <p style={{ margin: 0 }}>سيتم نقل القسم إلى المحذوفات. يمكنك استعادته لاحقًا.</p>
        )}
      </Modal>
    </AdminShell>
  );
}

function Tree({
  children, depth, tree, productCount, canEdit, canDelete, onDelete, onMoveCategory, collapsed, onToggleCollapsed
}: {
  children: Category[];
  depth: number;
  tree: Map<number | null, Category[]>;
  productCount: Map<number, number>;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (id: number) => void;
  onMoveCategory: (parentId: number | null, id: number, direction: -1 | 1) => void;
  collapsed: Set<number>;
  onToggleCollapsed: (id: number) => void;
}) {
  return (
    <ul className="tree">
      {children.map((c) => {
        const kids = tree.get(c.id) ?? [];
        const count = productCount.get(c.id) ?? 0;
        const isRoot = depth === 0;
        const siblingIds = children.map((item) => item.id);
        const siblingIndex = siblingIds.indexOf(c.id);
        const hasKids = kids.length > 0;
        const isCollapsed = collapsed.has(c.id);
        return (
          <li key={c.id} className="tree__item">
            <div
              className="tree__row"
              data-root={isRoot ? "true" : "false"}
              data-testid={`category-row-${c.id}`}
              style={{ paddingInlineStart: 12 + depth * 20 }}
            >
              {hasKids ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm tree__fold"
                  onClick={() => onToggleCollapsed(c.id)}
                  aria-label={isCollapsed ? "توسيع" : "طي"}
                  aria-expanded={!isCollapsed}
                  data-testid={`category-toggle-${c.id}`}
                >
                  <Icon.Chevron size={14} className={isCollapsed ? "rotate-180" : undefined} />
                </button>
              ) : (
                <span style={{ display: "inline-block", width: 28 }} />
              )}
              <Icon.Folder size={16} />
              <Link href={`/categories/${c.id}/edit`} className="tree__title">
                {c.name.ar} <span className="tree__meta">· {c.name.en}</span>
              </Link>
              {count > 0 && <span className="tag">{count} منتج</span>}
              {kids.length > 0 && <span className="tag" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{kids.length} فرعي</span>}
              <div className="row" style={{ gap: 4 }}>
                {canEdit && siblingIds.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onMoveCategory(c.parentId, c.id, -1)}
                      aria-label="تحريك لأعلى"
                      disabled={siblingIndex <= 0}
                    >
                      <Icon.Chevron size={14} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onMoveCategory(c.parentId, c.id, 1)}
                      aria-label="تحريك لأسفل"
                      disabled={siblingIndex === -1 || siblingIndex >= siblingIds.length - 1}
                    >
                      <Icon.Chevron size={14} />
                    </button>
                  </>
                )}
                {(canEdit || canDelete) && (
                  <RowMenu>
                    {canEdit && (
                      <Link href={`/categories/${c.id}/edit`} className="row-menu__item">
                        <Icon.Edit /> تعديل
                      </Link>
                    )}
                    {canDelete && (
                      <button type="button" className="row-menu__item row-menu__item--danger" onClick={() => onDelete(c.id)}>
                        <Icon.Trash /> حذف
                      </button>
                    )}
                  </RowMenu>
                )}
              </div>
            </div>
            {hasKids && (
              <div
                className="tree__subtree"
                data-collapsed={isCollapsed ? "true" : "false"}
                data-testid={`category-subtree-${c.id}`}
                aria-hidden={isCollapsed ? "true" : undefined}
              >
                <div className="tree__subtree-inner" inert={isCollapsed || undefined}>
                  <Tree
                    children={kids}
                    depth={depth + 1}
                    tree={tree}
                    productCount={productCount}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onDelete={onDelete}
                    onMoveCategory={onMoveCategory}
                    collapsed={collapsed}
                    onToggleCollapsed={onToggleCollapsed}
                  />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
