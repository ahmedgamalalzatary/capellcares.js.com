"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Layers, Plus } from "lucide-react";
import { compareByScopedOrdering, type Category } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { showErrorToast } from "@/lib/errors";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { getStore, useStore } from "@/lib/store";
import { Tree, TreeSkeleton } from "@/features/categories/components/category-tree";
import { useCollapsedCategories } from "@/features/categories/hooks/use-collapsed-categories";
import { buildPersistedCategoryOrders, categoryParentKey } from "@/features/categories/lib/category-order";

type LevelFilter = "all" | "root" | "child";

const LEVEL_FILTER_OPTIONS = [
  { value: "all", label: "كل الأقسام" },
  { value: "root", label: "أقسام رئيسية" },
  { value: "child", label: "أقسام فرعية" }
];

export default function CategoriesPage() {
  const { user } = useAdminAuth();
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const loaded = useStore((s) => s.loaded);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<{ id: number; blocked: boolean } | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const { collapsed, toggle: toggleCollapsed } = useCollapsedCategories();
  const [draftOrders, setDraftOrders] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(buildPersistedCategoryOrders(categories.filter((category) => !category.deletedAt)).entries())
  );

  const activeCategories = useMemo(() => categories.filter((category) => !category.deletedAt), [categories]);
  const persistedOrders = useMemo(() => buildPersistedCategoryOrders(activeCategories), [activeCategories]);

  useEffect(() => {
    setDraftOrders(Object.fromEntries(buildPersistedCategoryOrders(categories.filter((category) => !category.deletedAt)).entries()));
  }, [categories]);

  const filtering = search.trim().length > 0 || level !== "all";

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeCategories.filter((category) => {
      if (level === "root" && category.parentId != null) return false;
      if (level === "child" && category.parentId == null) return false;
      if (!query) return true;
      return category.name.ar.toLowerCase().includes(query) || category.name.en.toLowerCase().includes(query);
    });
  }, [activeCategories, level, search]);

  // Every match keeps its whole ancestor chain, so the tree shows where it lives.
  const visibleIds = useMemo(() => {
    const ids = new Set<number>();
    const byId = new Map(activeCategories.map((category) => [category.id, category]));
    for (const category of matches) {
      ids.add(category.id);
      let parentId = category.parentId;
      const guard = new Set<number>();
      while (parentId != null && !guard.has(parentId)) {
        guard.add(parentId);
        ids.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    }
    return ids;
  }, [activeCategories, matches]);

  const tree = useMemo(() => {
    const children = new Map<number | null, Category[]>();
    for (const category of activeCategories) {
      if (filtering && !visibleIds.has(category.id)) continue;
      const list = children.get(category.parentId) ?? [];
      list.push(category);
      children.set(category.parentId, list);
    }
    for (const [parentId, list] of children.entries()) {
      const orderedIds = draftOrders[categoryParentKey(parentId)];
      if (orderedIds?.length) {
        const ordered = orderedIds
          .map((id) => list.find((item) => item.id === id))
          .filter((item): item is Category => Boolean(item));
        const seen = new Set(ordered.map((item) => item.id));
        children.set(parentId, [...ordered, ...list.filter((item) => !seen.has(item.id))]);
        continue;
      }
      list.sort(compareByScopedOrdering.bind(null, "erp"));
    }
    return children;
  }, [activeCategories, draftOrders, filtering, visibleIds]);

  const productCount = useMemo(() => {
    const map = new Map<number, number>();
    for (const product of products) {
      if (product.deletedAt) continue;
      map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

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
        const parentId = groupKey === categoryParentKey(null) ? null : Number(groupKey.replace("parent:", ""));
        await getStore().reorderCategories({ parentId, ids });
      }
      toast.success("تم حفظ ترتيب الأقسام.");
    } catch (error) {
      showErrorToast(error, "تعذر حفظ ترتيب الأقسام. حاولي مرة أخرى.");
    } finally {
      setSavingOrder(false);
    }
  };

  const onAskDelete = (id: number) => {
    const linked = products.some((product) => !product.deletedAt && product.categoryId === id);
    setPendingDelete({ id, blocked: linked });
  };

  const doDelete = async () => {
    if (!pendingDelete || pendingDelete.blocked) {
      return;
    }
    const { id } = pendingDelete;
    try {
      const result = await getStore().softDeleteCategory(id);
      if (!result.ok) {
        setPendingDelete({ id, blocked: true });
        return;
      }
      setPendingDelete(null);
    } catch (error) {
      showErrorToast(error, "تعذر حذف القسم. حاولي مرة أخرى.");
    }
  };

  if (!canReadErpModule(user, "categories")) {
    return (
      <ForbiddenPage title="الأقسام" crumbs={[{ label: "الأقسام" }]} message="لا تملكين صلاحية الوصول إلى الأقسام." />
    );
  }

  const canEdit = canUpdateErpModule(user, "categories");
  const canDelete = canSoftDeleteErpModule(user, "categories");
  const reorderEnabled = canEdit && !filtering;
  const roots = tree.get(null) ?? [];

  return (
    <AdminShell
      title="الأقسام"
      crumbs={[{ label: "الأقسام" }]}
      description="تنظيم شجرة الأقسام الرئيسية والفرعية وترتيب ظهورها في المتجر."
      actions={
        <>
          {isDirty && canEdit ? (
            <Button variant="secondary" onClick={() => { void saveRootOrder(); }} disabled={savingOrder}>
              <Check /> حفظ ترتيب الأقسام
            </Button>
          ) : null}
          {canCreateErpModule(user, "categories") ? (
            <Button asChild variant="primary">
              <Link href="/categories/new"><Plus /> قسم جديد</Link>
            </Button>
          ) : undefined}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي باسم القسم…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={loaded ? `${formatNumber(matches.length)} قسم` : "جارٍ التحميل…"}
        filters={[
          {
            key: "level",
            label: "المستوى",
            icon: Layers,
            value: level,
            onChange: (value) => setLevel(value as LevelFilter),
            options: LEVEL_FILTER_OPTIONS
          }
        ]}
      />

      <Card className="overflow-hidden">
        {!loaded ? (
          <TreeSkeleton />
        ) : roots.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title={filtering ? "لا توجد أقسام تطابق البحث" : "لا توجد أقسام بعد"}
            description={filtering ? "جرّبي كلمة أخرى أو غيّري فلتر المستوى." : "ابدئي بإنشاء قسم رئيسي، ثم أضيفي الأقسام الفرعية بداخله."}
            action={
              !filtering && canCreateErpModule(user, "categories") ? (
                <Button asChild variant="primary">
                  <Link href="/categories/new"><Plus /> قسم جديد</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Tree
            children={roots}
            depth={0}
            tree={tree}
            productCount={productCount}
            canEdit={canEdit}
            canDelete={canDelete}
            reorderEnabled={reorderEnabled}
            filtering={filtering}
            onDelete={onAskDelete}
            onMoveCategory={moveCategory}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        )}
      </Card>

      {pendingDelete?.blocked ? (
        <Modal
          open
          title="لا يمكن حذف القسم"
          onClose={() => setPendingDelete(null)}
          footer={<Button variant="ghost" onClick={() => setPendingDelete(null)}>تم</Button>}
        >
          <p>هذا القسم يحتوي على منتجات مرتبطة. انقلي المنتجات إلى قسم آخر أولًا ثم أعيدي المحاولة.</p>
        </Modal>
      ) : (
        <AdminConfirmModal
          open={pendingDelete != null}
          title="تأكيد الحذف"
          confirmLabel="حذف القسم"
          tone="danger"
          onClose={() => setPendingDelete(null)}
          onConfirm={doDelete}
        >
          <p>سيُنقل القسم إلى المحذوفات. يمكنك استعادته لاحقًا من قسم المحذوفات.</p>
        </AdminConfirmModal>
      )}
    </AdminShell>
  );
}
