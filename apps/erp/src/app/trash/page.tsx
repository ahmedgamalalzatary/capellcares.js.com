"use client";

import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canRestoreErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { DeletedList } from "@/features/trash/components/deleted-list";
import { useTrashPage } from "@/features/trash/hooks/use-trash-page";

export default function TrashPage() {
  const { user } = useAdminAuth();
  const trashReadable = hasErpPermission(user, "trash.read");
  const reviewsReadable = trashReadable && hasErpPermission(user, "reviews.read");
  const {
    tab,
    setTab,
    tabs,
    deletedProducts,
    deletedCategories,
    deletedOffers,
    deletedCollections,
    deletedReviews,
    reviewsLoading,
    reviewsError,
    pendingHardDelete,
    setPendingHardDelete,
    isDeleting,
    deleteError,
    closeHardDeleteModal,
    confirmHardDelete,
    restoreProduct,
    restoreCategory,
    restoreOffer,
    restoreCollection,
    restoreReview
  } = useTrashPage({ reviewsReadable });

  if (!trashReadable) {
    return (
      <ForbiddenPage title="المحذوفات" crumbs={[{ label: "المحذوفات" }]} message="لا تملكين صلاحية الوصول إلى المحذوفات." />
    );
  }

  return (
    <AdminShell title="المحذوفات" crumbs={[{ label: "المحذوفات" }]} description="عناصر محذوفة يمكن استعادتها أو حذفها نهائيًا.">
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="أقسام المحذوفات">
          {tabs.map((tabConfig) => (
            <Button
              key={tabConfig.id}
              variant={tab === tabConfig.id ? "primary" : "ghost"}
              size="sm"
              role="tab"
              aria-selected={tab === tabConfig.id}
              onClick={() => setTab(tabConfig.id)}
            >
              {tabConfig.label}
              <span className="num rounded-full bg-current/10 px-1.5 text-xs">{formatNumber(tabConfig.count)}</span>
            </Button>
          ))}
        </div>

        <Card className="overflow-hidden">
          {tab === "products" ? (
            <DeletedList
              empty="لا توجد منتجات محذوفة."
              rows={deletedProducts}
              onRestore={canRestoreErpModule(user, "products") ? restoreProduct : undefined}
              onHardDelete={hasErpPermission(user, "products.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "products", id, title }) : undefined}
            />
          ) : null}
          {tab === "categories" ? (
            <DeletedList
              empty="لا توجد أقسام محذوفة."
              rows={deletedCategories}
              onRestore={canRestoreErpModule(user, "categories") ? restoreCategory : undefined}
              onHardDelete={hasErpPermission(user, "categories.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "categories", id, title }) : undefined}
            />
          ) : null}
          {tab === "offers" ? (
            <DeletedList
              empty="لا توجد عروض محذوفة."
              rows={deletedOffers}
              onRestore={canRestoreErpModule(user, "offers") ? restoreOffer : undefined}
              onHardDelete={hasErpPermission(user, "offers.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "offers", id, title }) : undefined}
            />
          ) : null}
          {tab === "collections" ? (
            <DeletedList
              empty="لا توجد مجموعات محذوفة."
              rows={deletedCollections}
              onRestore={canRestoreErpModule(user, "collections") ? restoreCollection : undefined}
              onHardDelete={hasErpPermission(user, "collections.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "collections", id, title }) : undefined}
            />
          ) : null}
          {tab === "reviews" ? (
            reviewsLoading ? (
              <div role="status" aria-label="جارٍ تحميل التقييمات" className="grid gap-2 p-4">
                {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-11 rounded-control" />)}
              </div>
            ) : reviewsError ? (
              <div className="p-5 sm:p-6"><Alert tone="danger">{reviewsError}</Alert></div>
            ) : (
              <DeletedList
                empty="لا توجد تقييمات محذوفة."
                rows={deletedReviews}
                onRestore={hasErpPermission(user, "reviews.restore") ? restoreReview : undefined}
                onHardDelete={hasErpPermission(user, "reviews.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "reviews", id, title }) : undefined}
              />
            )
          ) : null}
        </Card>
      </div>

      <AdminConfirmModal
        open={pendingHardDelete != null}
        title="تأكيد الحذف النهائي"
        confirmLabel={isDeleting ? "جارٍ الحذف…" : "حذف نهائي"}
        tone="danger"
        onClose={closeHardDeleteModal}
        disableCancel={isDeleting}
        disableConfirm={isDeleting}
        onConfirm={confirmHardDelete}
      >
        <p>سيتم حذف «{pendingHardDelete?.title}» نهائيًا مع كل بياناته. لا يمكن التراجع عن هذا الإجراء.</p>
        {deleteError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{deleteError}</p> : null}
      </AdminConfirmModal>
    </AdminShell>
  );
}
