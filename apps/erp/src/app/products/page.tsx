"use client";

import Link from "next/link";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { AdminShell } from "@/components/shell/admin-shell";
import { Icon } from "@/components/ui/icons";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canToggleErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { ProductsTable } from "../../components/products-table";
import { useProductsPage } from "../../hooks/use-products-page";

export default function ProductsListPage() {
  const { user } = useAdminAuth();
  const {
    categories,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    categoryOptions,
    filteredProducts,
    reorderEnabled,
    isOrderDirty,
    savingOrder,
    moveProduct,
    saveOrder,
    pendingDelete,
    setPendingDelete,
    pendingToggle,
    setPendingToggle,
    isToggling,
    toggleError,
    closeToggleModal,
    confirmToggle,
    confirmDelete
  } = useProductsPage();

  if (!canReadErpModule(user, "products")) {
    return (
      <AdminShell title="المنتجات" crumbs={[{ label: "المنتجات" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى المنتجات." />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="المنتجات"
      crumbs={[{ label: "المنتجات" }]}
      actions={
        <>
          {isOrderDirty && canUpdateErpModule(user, "products") && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                void saveOrder();
              }}
              disabled={savingOrder}
            >
              <Icon.Check /> حفظ ترتيب المنتجات
            </button>
          )}
          {canCreateErpModule(user, "products") ? (
            <Link href="/products/new" className="btn btn--primary btn--sm">
              <Icon.Plus /> منتج جديد
            </Link>
          ) : undefined}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي بالاسم أو SKU…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={`${filteredProducts.length} منتج`}
        filters={[
          {
            key: "status",
            label: "حالة المنتج",
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as "all" | "active" | "inactive"),
            options: ACTIVE_STATUS_FILTER_OPTIONS
          },
          {
            key: "category",
            label: "قسم المنتج",
            testId: "products-category-filter",
            value: String(categoryFilter),
            onChange: (value) => setCategoryFilter(value ? Number(value) : ""),
            options: [
              { value: "", label: "كل الأقسام" },
              ...categoryOptions.map((option) => ({
                value: String(option.id),
                label: `${"— ".repeat(option.depth)}${option.label}`
              }))
            ]
          }
        ]}
      />

      <ProductsTable
        products={filteredProducts}
        categories={categories}
        user={user}
        canToggle={canToggleErpModule(user, "products")}
        canEdit={canUpdateErpModule(user, "products")}
        canDelete={canSoftDeleteErpModule(user, "products")}
        canReorder={reorderEnabled && canUpdateErpModule(user, "products")}
        onMove={moveProduct}
        onToggle={(product) => {
          setPendingToggle(product);
        }}
        onDelete={setPendingDelete}
      />

      <AdminConfirmModal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={closeToggleModal}
        confirmLabel={isToggling ? "جارٍ التحديث..." : "تأكيد"}
        disableCancel={isToggling}
        disableConfirm={isToggling}
        onConfirm={confirmToggle}
      >
        <p className="modal-note">
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذا المنتج ولن يظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذا المنتج ليظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p className="modal-note modal-note--error">{toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف المنتج"
        confirmClassName="btn btn--danger btn--sm"
        onConfirm={confirmDelete}
      >
        <p className="modal-note">سيتم نقل المنتج إلى المحذوفات. يمكنك استعادته لاحقًا من قسم المحذوفات.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
