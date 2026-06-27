"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { compareByScopedOrdering, formatPrice, type Category, type Collection } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { EntityAvatar } from "@/components/admin/entity-avatar";
import { RowMenu } from "@/components/ui/row-menu";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import {
  canCreateErpModule,
  canReadErpModule,
  canToggleErpModule,
  canUpdateErpModule
} from "@/lib/erp-permissions";
import { getStore, useStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import { Icon } from "@/components/ui/icons";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";

type CollectionStatusFilter = "all" | "active" | "inactive";

function buildCategoryOptions(categories: Category[]) {
  const active = categories
    .filter((category) => !category.deletedAt)
    .slice()
    .sort(compareByScopedOrdering.bind(null, "erp"));
  const childrenByParent = new Map<number | null, Category[]>();
  for (const category of active) {
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const options: Array<{ id: number; label: string; depth: number }> = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const category of childrenByParent.get(parentId) ?? []) {
      options.push({ id: category.id, label: category.name.ar, depth });
      visit(category.id, depth + 1);
    }
  };
  visit(null, 0);
  return options;
}

function isInCategoryTree(categories: Category[], categoryId: number, selectedCategoryId: number) {
  let current = categories.find((category) => category.id === categoryId);
  const visited = new Set<number>();
  while (current) {
    if (visited.has(current.id)) return false;
    if (current.id === selectedCategoryId) return true;
    visited.add(current.id);
    current = current.parentId != null
      ? categories.find((category) => category.id === current?.parentId)
      : undefined;
  }
  return false;
}

export default function CollectionsListPage() {
  const { user } = useAdminAuth();

  if (!user || !canReadErpModule(user, "collections")) {
    return (
      <AdminShell title="المجموعات" crumbs={[{ label: "المجموعات" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى المجموعات." />
      </AdminShell>
    );
  }

  return <CollectionsListPageContent user={user} />;
}

function CollectionsListPageContent({ user }: { user: NonNullable<ReturnType<typeof useAdminAuth>["user"]> }) {
  const collections = useStore((s) => s.collections);
  const categories = useStore((s) => s.categories);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CollectionStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [pendingToggle, setPendingToggle] = useState<Collection | null>(null);

  const visibleCollections = useMemo(
    () => collections.filter((collection) => !collection.deletedAt),
    [collections]
  );
  const reorder = useListReorder({
    persistedIds: useMemo(() => visibleCollections.map((collection) => collection.id), [visibleCollections]),
    save: (ids) => getStore().reorderCollections({ ids }),
    successMessage: "تم حفظ ترتيب المجموعات.",
    errorMessage: "تعذر حفظ ترتيب المجموعات. حاولي مرة أخرى."
  });
  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);
  // Reordering saves one global collection order, so it is hidden whenever the visible list is partial.
  const canReorder = !search.trim() && statusFilter === "all" && categoryFilter === "" && canUpdateErpModule(user, "collections");

  const filtered = useMemo(() => {
    const ordered = sortByIdOrder(visibleCollections, reorder.orderedIds);
    const q = search.trim().toLowerCase();
    return ordered.filter((collection) =>
      (statusFilter === "all" || collection.status === statusFilter) &&
      (categoryFilter === "" || isInCategoryTree(categories, collection.categoryId, categoryFilter)) &&
      (!q ||
        collection.name.ar.toLowerCase().includes(q) ||
        collection.name.en.toLowerCase().includes(q) ||
        collection.slug.toLowerCase().includes(q))
    );
  }, [categories, categoryFilter, search, statusFilter, visibleCollections, reorder.orderedIds]);

  return (
    <AdminShell
      title="المجموعات"
      crumbs={[{ label: "المجموعات" }]}
      actions={
        <>
          {reorder.isDirty && canUpdateErpModule(user, "collections") && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                void reorder.saveOrder();
              }}
              disabled={reorder.saving}
            >
              <Icon.Check /> حفظ ترتيب المجموعات
            </button>
          )}
          {canCreateErpModule(user, "collections") ? (
            <Link href="/collections/new" className="btn btn--primary btn--sm">
              <Icon.Plus /> مجموعة جديدة
            </Link>
          ) : undefined}
        </>
      }
    >
      <AdminListToolbar
        stacked
        searchPlaceholder="ابحثي عن مجموعة…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={`${filtered.length} مجموعة`}
        extraControls={(
          <>
            <div className="toolbar__filter1">
              <select
                aria-label="حالة المجموعة"
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CollectionStatusFilter)}
              >
                <option value="all">كل الحالات</option>
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </div>
            <div className="toolbar__filter2">
              <select
                aria-label="قسم المجموعة"
                className="select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">كل الأقسام</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {`${"— ".repeat(option.depth)}${option.label}`}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      />

      <div className="card">
        <div className="table-outer">
          <table className="table">
            <thead>
              <tr>
                <th>الصورة</th>
                <th>الاسم</th>
                <th>القسم</th>
                <th>عدد العناصر</th>
                <th>السعر</th>
                <th>السعر الأصلي</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((collection, index) => {
                const category = categories.find((item) => item.id === collection.categoryId);
                return (
                  <tr key={collection.id} data-testid={`collection-row-${collection.id}`}>
                    <td>
                      <EntityAvatar
                        src={collection.imagePath}
                        fallback={collection.name.en?.trim().charAt(0) || collection.name.ar?.trim().charAt(0) || "?"}
                      />
                    </td>
                    <td>
                      {canUpdateErpModule(user, "collections") ? (
                        <Link href={`/collections/${collection.id}/edit`} className="table-title">
                          {collection.name.ar}
                        </Link>
                      ) : (
                        <span className="table-title">{collection.name.ar}</span>
                      )}
                      <div className="table-subtitle">{collection.name.en}</div>
                    </td>
                    <td>{category?.name.ar ?? "—"}</td>
                    <td>{collection.items.reduce((sum, item) => sum + item.qty, 0)} عنصر</td>
                    <td>{formatPrice(collection.price, "ar")}</td>
                    <td className="faint" style={{ textDecoration: "line-through" }}>
                      {formatPrice(collection.originalTotal, "ar")}
                    </td>
                    <td>
                      <AdminStatusBadge
                        active={collection.status === "active"}
                        activeLabel="نشط"
                        inactiveLabel="غير نشط"
                      />
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                      {canReorder && filtered.length > 1 && (
                        <>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => reorder.moveItem(collection.id, -1)}
                            aria-label="تحريك لأعلى"
                            disabled={index === 0}
                          >
                            <Icon.Chevron size={14} className="rotate-180" />
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => reorder.moveItem(collection.id, 1)}
                            aria-label="تحريك لأسفل"
                            disabled={index === filtered.length - 1}
                          >
                            <Icon.Chevron size={14} />
                          </button>
                        </>
                      )}
                      {(canToggleErpModule(user, "collections") || canUpdateErpModule(user, "collections")) && (
                        <RowMenu>
                          {canToggleErpModule(user, "collections") && (
                            <button
                              type="button"
                              className="row-menu__item"
                              onClick={() => setPendingToggle(collection)}
                              aria-label={collection.status === "active" ? "إيقاف" : "تفعيل"}
                              title={collection.status === "active" ? "إيقاف" : "تفعيل"}
                            >
                              {collection.status === "active" ? <><Icon.X /> إيقاف</> : <><Icon.Check /> تفعيل</>}
                            </button>
                          )}
                          {canUpdateErpModule(user, "collections") && (
                            <Link href={`/collections/${collection.id}/edit`} className="row-menu__item">
                              <Icon.Edit /> تعديل
                            </Link>
                          )}
                        </RowMenu>
                      )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>
                    لا توجد مجموعات بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminConfirmModal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={() => setPendingToggle(null)}
        confirmLabel="تأكيد"
        onConfirm={async () => {
          if (!pendingToggle) return;
          try {
            await getStore().toggleCollectionStatus(pendingToggle.id);
            setPendingToggle(null);
          } catch (error) {
            showErrorToast(error, "تعذر تحديث حالة المجموعة. حاولي مرة أخرى.");
          }
        }}
      >
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذه المجموعة ولن تظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذه المجموعة لتظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
