"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore, getStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import type { Category } from "@capella/shared";

export default function CategoriesPage() {
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; blocked: boolean } | null>(null);

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
      actions={<Link href="/categories/new" className="btn btn--primary btn--sm"><Icon.Plus /> قسم جديد</Link>}
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
  onDelete: (id: number) => void;
}) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {children.map((c) => {
        const kids = tree.get(c.id) ?? [];
        const count = productCount.get(c.id) ?? 0;
        return (
          <li key={c.id} style={{ marginBottom: 4 }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px",
                paddingInlineStart: 10 + depth * 20,
                borderRadius: 6,
                background: depth === 0 ? "var(--bg-tint)" : "transparent",
                fontWeight: depth === 0 ? 700 : 400
              }}
            >
              <Icon.Folder size={16} />
              <Link href={`/categories/${c.id}/edit`} style={{ flex: 1 }}>
                {c.name.ar} <span className="faint" style={{ fontSize: 12 }}>· {c.name.en}</span>
              </Link>
              {count > 0 && <span className="tag">{count} منتج</span>}
              {kids.length > 0 && <span className="tag" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{kids.length} فرعي</span>}
              <div className="row" style={{ gap: 4 }}>
                <Link href={`/categories/${c.id}/edit`} className="btn btn--ghost btn--sm"><Icon.Edit /></Link>
                <button className="btn btn--ghost btn--sm" onClick={() => onDelete(c.id)} style={{ color: "var(--danger)" }}><Icon.Trash /></button>
              </div>
            </div>
            {kids.length > 0 && <Tree children={kids} depth={depth + 1} tree={tree} productCount={productCount} onDelete={onDelete} />}
          </li>
        );
      })}
    </ul>
  );
}
