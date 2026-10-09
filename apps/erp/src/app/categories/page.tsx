"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, ChevronDown, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { compareByScopedOrdering, type Category } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { RowMenu, RowMenuItem, RowMenuLink, RowMenuSeparator } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Thumb } from "@/components/ui/thumb";
import { useCollapsedCategories } from "@/hooks/use-collapsed-categories";
import { showErrorToast } from "@/lib/errors";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { getStore, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type LevelFilter = "all" | "root" | "child";

const LEVEL_FILTER_OPTIONS = [
  { value: "all", label: "كل الأقسام" },
  { value: "root", label: "أقسام رئيسية" },
  { value: "child", label: "أقسام فرعية" }
];

function categoryParentKey(parentId: number | null) {
  return parentId == null ? "root" : `parent:${parentId}`;
}

function buildPersistedCategoryOrders(categories: Category[]) {
  const grouped = new Map<string, number[]>();
  const byParent = new Map<number | null, Category[]>();
  for (const category of categories) {
    const siblings = byParent.get(category.parentId) ?? [];
    siblings.push(category);
    byParent.set(category.parentId, siblings);
  }
  for (const [parentId, siblings] of byParent.entries()) {
    grouped.set(
      categoryParentKey(parentId),
      siblings
        .slice()
        .sort(compareByScopedOrdering.bind(null, "erp"))
        .map((category) => category.id)
    );
  }
  return grouped;
}

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
      <AdminShell title="الأقسام" crumbs={[{ label: "الأقسام" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى الأقسام." />
      </AdminShell>
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

function CountPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "nude" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs",
        tone === "nude" ? "bg-nude-soft text-nude-strong" : "bg-sunken text-text-2"
      )}
    >
      {children}
    </span>
  );
}

function TreeSkeleton() {
  return (
    <div aria-hidden className="grid">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-line py-3 pe-3 last:border-b-0"
          style={{ paddingInlineStart: `${(index % 3) * 24 + 12}px` }}
        >
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-9 rounded-thumb" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function Tree({
  children,
  depth,
  tree,
  productCount,
  canEdit,
  canDelete,
  reorderEnabled,
  filtering,
  onDelete,
  onMoveCategory,
  collapsed,
  onToggleCollapsed
}: {
  children: Category[];
  depth: number;
  tree: Map<number | null, Category[]>;
  productCount: Map<number, number>;
  canEdit: boolean;
  canDelete: boolean;
  reorderEnabled: boolean;
  filtering: boolean;
  onDelete: (id: number) => void;
  onMoveCategory: (parentId: number | null, id: number, direction: -1 | 1) => void;
  collapsed: Set<number>;
  onToggleCollapsed: (id: number) => void;
}) {
  return (
    <ul className="grid">
      {children.map((category) => {
        const kids = tree.get(category.id) ?? [];
        const count = productCount.get(category.id) ?? 0;
        const isRoot = depth === 0;
        const siblingIds = children.map((item) => item.id);
        const siblingIndex = siblingIds.indexOf(category.id);
        const hasKids = kids.length > 0;
        // While filtering, ancestors stay open so every match is visible.
        const isCollapsed = !filtering && collapsed.has(category.id);
        const initial = category.name.en?.trim().charAt(0) || category.name.ar?.trim().charAt(0) || "?";

        return (
          <li key={category.id} className="border-b border-line last:border-b-0">
            <div
              data-root={isRoot ? "true" : "false"}
              data-testid={`category-row-${category.id}`}
              className="group flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pe-2 transition-colors hover:bg-sunken sm:flex-nowrap sm:pe-3"
              style={{ "--depth": depth, paddingInlineStart: `calc(${depth} * 1.5rem + 0.75rem)` } as CSSProperties}
            >
              {hasKids ? (
                <button
                  type="button"
                  className="grid size-8 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus pointer-coarse:size-11"
                  onClick={() => onToggleCollapsed(category.id)}
                  aria-label={isCollapsed ? "توسيع" : "طي"}
                  aria-expanded={!isCollapsed}
                  data-testid={`category-toggle-${category.id}`}
                >
                  <ChevronDown className={cn("size-4 transition-transform duration-200", isCollapsed && "rotate-180")} />
                </button>
              ) : (
                <span aria-hidden className="size-8 shrink-0 pointer-coarse:size-11" />
              )}

              <Thumb src={category.imagePath} fallback={initial} size="sm" />

              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link
                  href={`/categories/${category.id}/edit`}
                  className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline"
                >
                  {category.name.ar}
                </Link>
                {category.name.en ? (
                  <span dir="ltr" className="truncate text-sm text-text-muted">{category.name.en}</span>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {count > 0 ? (
                  <CountPill>
                    <span className="num">{formatNumber(count)}</span> منتج
                  </CountPill>
                ) : null}
                {kids.length > 0 ? (
                  <CountPill tone="nude">
                    <span className="num">{formatNumber(kids.length)}</span> فرعي
                  </CountPill>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {reorderEnabled && siblingIds.length > 1 ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="تحريك لأعلى"
                      title="تحريك لأعلى"
                      disabled={siblingIndex <= 0}
                      onClick={() => onMoveCategory(category.parentId, category.id, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="تحريك لأسفل"
                      title="تحريك لأسفل"
                      disabled={siblingIndex === -1 || siblingIndex >= siblingIds.length - 1}
                      onClick={() => onMoveCategory(category.parentId, category.id, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </>
                ) : null}
                {canEdit || canDelete ? (
                  <RowMenu label={`إجراءات ${category.name.ar}`}>
                    {canEdit ? (
                      <RowMenuLink href={`/categories/${category.id}/edit`}>
                        <Pencil /> تعديل
                      </RowMenuLink>
                    ) : null}
                    {canDelete ? (
                      <>
                        <RowMenuSeparator />
                        <RowMenuItem danger onClick={() => onDelete(category.id)}>
                          <Trash2 /> حذف
                        </RowMenuItem>
                      </>
                    ) : null}
                  </RowMenu>
                ) : null}
              </div>
            </div>

            {hasKids ? (
              <div
                data-collapsed={isCollapsed ? "true" : "false"}
                data-testid={`category-subtree-${category.id}`}
                aria-hidden={isCollapsed || undefined}
                className="grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-200 ease-out data-[collapsed=true]:grid-rows-[0fr] data-[collapsed=true]:opacity-0 motion-reduce:transition-none"
              >
                <div className="min-h-0 overflow-hidden" inert={isCollapsed || undefined}>
                  <Tree
                    children={kids}
                    depth={depth + 1}
                    tree={tree}
                    productCount={productCount}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    reorderEnabled={reorderEnabled}
                    filtering={filtering}
                    onDelete={onDelete}
                    onMoveCategory={onMoveCategory}
                    collapsed={collapsed}
                    onToggleCollapsed={onToggleCollapsed}
                  />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
