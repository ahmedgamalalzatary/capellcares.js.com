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
  const {
    tab,
    setTab,
    tabs,
    deletedProducts,
    deletedCategories,
    deletedOffers,
    pendingHardDelete,
    setPendingHardDelete,
    isDeleting,
    deleteError,
    closeHardDeleteModal,
    confirmHardDelete,
    restoreProduct,
    restoreCategory,
    restoreOffer
  } = useTrashPage();

  if (!hasErpPermission(user, "trash.read")) {
    return (
      <AdminShell title="المحذوفات" crumbs={[{ label: "المحذوفات" }]}>
        <ErpForbiddenState message="لا تملك صلاحية الوصول إلى المحذوفات." />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="المحذوفات" crumbs={[{ label: "المحذوفات" }]}>
      <div className="card">
        <div className="card__head" style={{ padding: 0, borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex" }}>
            {tabs.map((tabConfig) => {
              const active = tab === tabConfig.id;
              return (
                <button
                  key={tabConfig.id}
                  onClick={() => setTab(tabConfig.id)}
                  style={{
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-3)",
                    border: 0,
                    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    padding: "16px 22px",
                    fontWeight: active ? 700 : 600,
                    fontSize: 13.5,
                    transition: "color 140ms, background 140ms",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  {tabConfig.label}
                  <span className="tag" style={{ background: active ? "var(--accent-soft)" : "var(--warm-soft)", color: active ? "var(--accent)" : "var(--ink-3)", fontWeight: 700 }}>{tabConfig.count}</span>
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
            onHardDelete={hasErpPermission(user, "products.permanent_delete") ? (id, title) => setPendingHardDelete({ id, title }) : undefined}
          />
        )}
        {tab === "categories" && (
          <DeletedList
            empty="لا توجد أقسام محذوفة."
            rows={deletedCategories}
            onRestore={canRestoreErpModule(user, "categories") ? restoreCategory : undefined}
          />
        )}
        {tab === "offers" && (
          <DeletedList
            empty="لا توجد عروض محذوفة."
            rows={deletedOffers}
            onRestore={canRestoreErpModule(user, "offers") ? restoreOffer : undefined}
          />
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
        <p style={{ margin: 0 }}>
          سيتم حذف "{pendingHardDelete?.title}" نهائياً مع كل بياناته. لا يمكن التراجع عن هذا الإجراء.
        </p>
        {deleteError ? <p style={{ margin: "12px 0 0", color: "var(--danger)" }}>{deleteError}</p> : null}
      </Modal>
    </AdminShell>
  );
}
