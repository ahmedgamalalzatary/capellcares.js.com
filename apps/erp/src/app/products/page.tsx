"use client";

import Link from "next/link";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
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
    rootCategories,
    filteredProducts,
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
        canCreateErpModule(user, "products") ? (
          <Link href="/products/new" className="btn btn--primary btn--sm">
            <Icon.Plus /> منتج جديد
          </Link>
        ) : undefined
      }
    >
      <AdminListToolbar
        stacked
        searchPlaceholder="ابحثي بالاسم أو SKU…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={`${filteredProducts.length} منتج`}
        extraControls={(
          <>
            <div className="toolbar__filter1">
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">كل الحالات</option>
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </div>
            <div className="toolbar__filter2">
              <select className="select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : "")}>
                <option value="">كل الأقسام</option>
                {rootCategories.map((category) => <option key={category.id} value={category.id}>{category.name.ar}</option>)}
              </select>
            </div>
          </>
        )}
      />

      <ProductsTable
        products={filteredProducts}
        categories={categories}
        canToggle={canToggleErpModule(user, "products")}
        canEdit={canUpdateErpModule(user, "products")}
        canDelete={canSoftDeleteErpModule(user, "products")}
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
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذا المنتج ولن يظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذا المنتج ليظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p style={{ margin: "12px 0 0", color: "var(--danger)" }}>{toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف المنتج"
        confirmClassName="btn btn--danger btn--sm"
        onConfirm={confirmDelete}
      >
        <p style={{ margin: 0 }}>سيتم نقل المنتج إلى المحذوفات. يمكنك استعادته لاحقًا من قسم المحذوفات.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
