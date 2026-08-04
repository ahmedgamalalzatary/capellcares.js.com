"use client";

import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canRestoreErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { Modal } from "@/components/ui/modal";
import { DeletedList } from "../../components/trash/deleted-list";
import { useTrashPage } from "../../hooks/use-trash-page";

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
    restoreReview
  } = useTrashPage({ reviewsReadable });

  if (!trashReadable) {
    return (
      <AdminShell title="المحذوفات" crumbs={[{ label: "المحذوفات" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى المحذوفات." />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="المحذوفات" crumbs={[{ label: "المحذوفات" }]}>
      <div className="card">
        <div className="card__head trash-tabs__head">
          <div className="trash-tabs">
            {tabs.map((tabConfig) => {
              const active = tab === tabConfig.id;
              return (
                <button
                  key={tabConfig.id}
                  onClick={() => setTab(tabConfig.id)}
                  className="trash-tab"
                  data-active={active}
                >
                  {tabConfig.label}
                  <span className="tag trash-tab__count">{tabConfig.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {tab === "products" && (
          <DeletedList
            empty="لا توجد منتجات محذوفة."
            rows={deletedProducts}
            onRestore={canRestoreErpModule(user, "products") ? restoreProduct : undefined}
            onHardDelete={hasErpPermission(user, "products.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "products", id, title }) : undefined}
          />
        )}
        {tab === "categories" && (
          <DeletedList
            empty="لا توجد أقسام محذوفة."
            rows={deletedCategories}
            onRestore={canRestoreErpModule(user, "categories") ? restoreCategory : undefined}
            onHardDelete={hasErpPermission(user, "categories.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "categories", id, title }) : undefined}
          />
        )}
        {tab === "offers" && (
          <DeletedList
            empty="لا توجد عروض محذوفة."
            rows={deletedOffers}
            onRestore={canRestoreErpModule(user, "offers") ? restoreOffer : undefined}
            onHardDelete={hasErpPermission(user, "offers.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "offers", id, title }) : undefined}
          />
        )}
        {tab === "reviews" && (
          reviewsLoading ? (
            <p role="status" className="muted state-note">جارٍ التحميل…</p>
          ) : reviewsError ? (
            <p role="alert" className="state-note state-note--danger">{reviewsError}</p>
          ) : (
            <DeletedList
              empty="لا توجد تقييمات محذوفة."
              rows={deletedReviews}
              onRestore={hasErpPermission(user, "reviews.restore") ? restoreReview : undefined}
              onHardDelete={hasErpPermission(user, "reviews.permanent_delete") ? (id, title) => setPendingHardDelete({ kind: "reviews", id, title }) : undefined}
            />
          )
        )}
      </div>

      <Modal
        open={pendingHardDelete != null}
        title="تأكيد الحذف النهائي"
        onClose={closeHardDeleteModal}
        footer={
          <>
            <button className="btn btn--ghost btn--sm" disabled={isDeleting} onClick={closeHardDeleteModal}>إلغاء</button>
            <button
              className="btn btn--danger btn--sm"
              disabled={isDeleting}
              onClick={confirmHardDelete}
            >
              {isDeleting ? "جارٍ الحذف..." : "حذف نهائي"}
            </button>
          </>
        }
      >
        <p className="modal-note">
          سيتم حذف "{pendingHardDelete?.title}" نهائياً مع كل بياناته. لا يمكن التراجع عن هذا الإجراء.
        </p>
        {deleteError ? <p className="modal-note modal-note--error">{deleteError}</p> : null}
      </Modal>
    </AdminShell>
  );
}
