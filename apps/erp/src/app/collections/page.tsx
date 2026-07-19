"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPrice, type Collection } from "@minikoshk/shared";
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

export default function CollectionsListPage() {
  const { user } = useAdminAuth();

  if (!user || !canReadErpModule(user, "collections")) {
    return (
      <AdminShell title="المجموعات" crumbs={[{ label: "المجموعات" }]}>
        <ErpForbiddenState message="لا تملك صلاحية الوصول إلى المجموعات." />
      </AdminShell>
    );
  }

  return <CollectionsListPageContent user={user} />;
}

function CollectionsListPageContent({ user }: { user: NonNullable<ReturnType<typeof useAdminAuth>["user"]> }) {
  const collections = useStore((s) => s.collections);
  const categories = useStore((s) => s.categories);
  const [search, setSearch] = useState("");
  const [pendingToggle, setPendingToggle] = useState<Collection | null>(null);

  const visibleCollections = useMemo(
    () => collections.filter((collection) => !collection.deletedAt),
    [collections]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return visibleCollections;
    const q = search.trim().toLowerCase();
    return visibleCollections.filter((collection) =>
      collection.name.ar.toLowerCase().includes(q) ||
      collection.name.en.toLowerCase().includes(q) ||
      collection.slug.toLowerCase().includes(q)
    );
  }, [search, visibleCollections]);

  return (
    <AdminShell
      title="المجموعات"
      crumbs={[{ label: "المجموعات" }]}
      actions={
        canCreateErpModule(user, "collections") ? (
          <Link href="/collections/new" className="btn btn--primary btn--sm">
            <Icon.Plus /> مجموعة جديدة
          </Link>
        ) : undefined
      }
    >
      <AdminListToolbar
        searchPlaceholder="ابحثي عن مجموعة…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={`${filtered.length} مجموعة`}
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
              {filtered.map((collection) => {
                const category = categories.find((item) => item.id === collection.categoryId);
                return (
                  <tr key={collection.id}>
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
            showErrorToast(error, "تعذر تحديث حالة المجموعة. حاول مرة أخرى.");
          }
        }}
      >
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذه المجموعة ولن تظهر في المتجر. هل تريد المتابعة؟"
            : "سيتم تفعيل هذه المجموعة لتظهر في المتجر. هل تريد المتابعة؟"}
        </p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
