"use client";

import { toast } from "sonner";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore, getStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { showErrorToast } from "@/lib/errors";
import type { Category } from "@capella/shared";

export default function CategoriesPage() {
  const { user } = useAdminAuth();
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; blocked: boolean } | null>(null);
  const [draftRootIds, setDraftRootIds] = useState<number[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.deletedAt),
    [categories]
  );
  const rootCategories = useMemo(
    () => activeCategories
      .filter((category) => category.parentId === null)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id),
    [activeCategories]
  );
  const persistedRootIds = useMemo(
    () => rootCategories.map((category) => category.id),
    [rootCategories]
  );

  useEffect(() => {
    setDraftRootIds(persistedRootIds);
  }, [persistedRootIds]);

  const tree = useMemo(() => {
    const children = new Map<number | null, Category[]>();
    for (const c of activeCategories) {
      const list = children.get(c.parentId) ?? [];
      list.push(c);
      children.set(c.parentId, list);
    }
    for (const [parentId, list] of children.entries()) {
      if (parentId === null) {
        const orderedRoots = draftRootIds
          .map((id) => list.find((item) => item.id === id))
          .filter((item): item is Category => Boolean(item));
        children.set(parentId, orderedRoots);
        continue;
      }

      list.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.id - right.id);
    }
    return children;
  }, [activeCategories, draftRootIds]);

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

  const isDirty = draftRootIds.length > 0 && draftRootIds.some((id, index) => id !== persistedRootIds[index]);

  const moveRoot = (id: number, direction: -1 | 1) => {
    setDraftRootIds((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = current.slice();
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  };

  const saveRootOrder = async () => {
    if (!isDirty || savingOrder) {
      return;
    }

    setSavingOrder(true);
    try {
      await getStore().reorderRootCategories(draftRootIds);
      toast.success("تم حفظ ترتيب الأقسام.");
    } catch (error) {
      showErrorToast(error, "تعذر حفظ ترتيب الأقسام. حاولي مرة أخرى.");
    } finally {
      setSavingOrder(false);
    }
  };

  if (!canReadErpModule(user, "categories")) {
    return (
      <AdminShell title="الأقسام" crumbs={[{ label: "الأقسام" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى الأقسام." />
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
            rootOrder={draftRootIds}
            onMoveRoot={moveRoot}
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
          <p style={{ margin: 0 }}>هذا القسم يحتوي على منتجات مرتبطة. الرجاء نقل المنتجات إلى قسم آخر أولًا ثم أعيدي المحاولة.</p>
        ) : (
          <p style={{ margin: 0 }}>سيتم نقل القسم إلى المحذوفات. يمكنك استعادته لاحقًا.</p>
        )}
      </Modal>
    </AdminShell>
  );
}

function Tree({
  children, depth, tree, productCount, canEdit, canDelete, onDelete, rootOrder, onMoveRoot
}: {
  children: Category[];
  depth: number;
  tree: Map<number | null, Category[]>;
  productCount: Map<number, number>;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (id: number) => void;
  rootOrder: number[];
  onMoveRoot: (id: number, direction: -1 | 1) => void;
}) {
  return (
    <ul className="tree">
      {children.map((c) => {
        const kids = tree.get(c.id) ?? [];
        const count = productCount.get(c.id) ?? 0;
        const isRoot = depth === 0;
        const rootIndex = rootOrder.indexOf(c.id);
        return (
          <li key={c.id} className="tree__item">
            <div
              className="tree__row"
              data-root={isRoot ? "true" : "false"}
              data-testid={`category-row-${c.id}`}
              style={{ paddingInlineStart: 12 + depth * 20 }}
            >
              <Icon.Folder size={16} />
              <Link href={`/categories/${c.id}/edit`} className="tree__title">
                {c.name.ar} <span className="tree__meta">· {c.name.en}</span>
              </Link>
              {count > 0 && <span className="tag">{count} منتج</span>}
              {kids.length > 0 && <span className="tag" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{kids.length} فرعي</span>}
              <div className="row" style={{ gap: 4 }}>
                {canEdit && isRoot && (
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onMoveRoot(c.id, -1)}
                      aria-label="تحريك لأعلى"
                      disabled={rootIndex <= 0}
                    >
                      <Icon.Chevron size={14} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onMoveRoot(c.id, 1)}
                      aria-label="تحريك لأسفل"
                      disabled={rootIndex === -1 || rootIndex >= rootOrder.length - 1}
                    >
                      <Icon.Chevron size={14} />
                    </button>
                  </>
                )}
                {canEdit && <Link href={`/categories/${c.id}/edit`} className="btn btn--ghost btn--sm"><Icon.Edit /></Link>}
                {canDelete && <button className="btn btn--ghost btn--sm" onClick={() => onDelete(c.id)} style={{ color: "var(--danger)" }}><Icon.Trash /></button>}
              </div>
            </div>
            {kids.length > 0 && (
              <Tree
                children={kids}
                depth={depth + 1}
                tree={tree}
                productCount={productCount}
                canEdit={canEdit}
                canDelete={canDelete}
                onDelete={onDelete}
                rootOrder={rootOrder}
                onMoveRoot={onMoveRoot}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
