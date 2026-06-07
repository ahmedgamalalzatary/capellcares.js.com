"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPrice, type Collection } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
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
  const collections = useStore((s) => s.collections);
  const categories = useStore((s) => s.categories);
  const [search, setSearch] = useState("");
  const [pendingToggle, setPendingToggle] = useState<Collection | null>(null);

  if (!canReadErpModule(user, "collections")) {
    return (
      <AdminShell title="المجموعات" crumbs={[{ label: "المجموعات" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى المجموعات." />
      </AdminShell>
    );
  }

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
                      <div className="row" style={{ gap: 4 }}>
                        {canToggleErpModule(user, "collections") && (
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => setPendingToggle(collection)}
                            aria-label={collection.status === "active" ? "إيقاف" : "تفعيل"}
                            title={collection.status === "active" ? "إيقاف" : "تفعيل"}
                          >
                            {collection.status === "active" ? <Icon.X /> : <Icon.Check />}
                          </button>
                        )}
                        {canUpdateErpModule(user, "collections") && (
                          <Link href={`/collections/${collection.id}/edit`} className="btn btn--ghost btn--sm">
                            <Icon.Edit />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>
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
