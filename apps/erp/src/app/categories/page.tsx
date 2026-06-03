"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useStore, getStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import type { Category } from "@capella/shared";

export default function CategoriesPage() {
  const { user } = useAdminAuth();
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; blocked: boolean } | null>(null);

  if (!canReadErpModule(user, "categories")) {
    return (
      <AdminShell title="الأقسام" crumbs={[{ label: "الأقسام" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى الأقسام." />
      </AdminShell>
    );
  }

  const tree = useMemo(() => {
    const children = new Map<number | null, Category[]>();
    for (const c of categories) {
      if (c.deletedAt) continue;
      const list = children.get(c.parentId) ?? [];
      list.push(c);
      children.set(c.parentId, list);
    }
    return children;
  }, [categories]);

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

  return (
    <AdminShell
      title="الأقسام"
      crumbs={[{ label: "الأقسام" }]}
      actions={canCreateErpModule(user, "categories") ? <Link href="/categories/new" className="btn btn--primary btn--sm"><Icon.Plus /> قسم جديد</Link> : undefined}
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
  children, depth, tree, productCount, onDelete
}: {
  children: Category[];
  depth: number;
  tree: Map<number | null, Category[]>;
  productCount: Map<number, number>;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <ul className="tree">
      {children.map((c) => {
        const kids = tree.get(c.id) ?? [];
        const count = productCount.get(c.id) ?? 0;
        return (
          <li key={c.id} className="tree__item">
            <div className="tree__row" data-root={depth === 0 ? "true" : "false"} style={{ paddingInlineStart: 12 + depth * 20 }}>
              <Icon.Folder size={16} />
              <Link href={`/categories/${c.id}/edit`} className="tree__title">
                {c.name.ar} <span className="tree__meta">· {c.name.en}</span>
              </Link>
              {count > 0 && <span className="tag">{count} منتج</span>}
              {kids.length > 0 && <span className="tag" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{kids.length} فرعي</span>}
              <div className="row" style={{ gap: 4 }}>
                {canEdit && <Link href={`/categories/${c.id}/edit`} className="btn btn--ghost btn--sm"><Icon.Edit /></Link>}
                {canDelete && <button className="btn btn--ghost btn--sm" onClick={() => onDelete(c.id)} style={{ color: "var(--danger)" }}><Icon.Trash /></button>}
              </div>
            </div>
            {kids.length > 0 && <Tree children={kids} depth={depth + 1} tree={tree} productCount={productCount} canEdit={canEdit} canDelete={canDelete} onDelete={onDelete} />}
          </li>
        );
      })}
    </ul>
  );
}
