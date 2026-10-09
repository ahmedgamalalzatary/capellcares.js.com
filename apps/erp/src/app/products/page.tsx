"use client";

import Link from "next/link";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { AdminShell } from "@/components/shell/admin-shell";
import { Check, CircleDot, FolderTree, Percent, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canToggleErpModule, canUpdateErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { PRODUCT_SORT_COLUMNS, productSortAccessors, ProductsTable, type ProductSortKey } from "@/features/products/components/products-table";
import { useTableSort } from "@/hooks/use-table-sort";
import { useProductsPage } from "@/features/products/hooks/use-products-page";

export default function ProductsListPage() {
  const { user } = useAdminAuth();
  const {
    loaded,
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
  const { sort, setSort, toggleSort, sortedRows } = useTableSort(filteredProducts, productSortAccessors(categories));

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
      description="كل منتجات المتجر بمقاساتها وأسعارها ومخزونها."
      actions={
        <>
          {hasErpPermission(user, "discounts.manage") && (
            <Button asChild variant="secondary">
              <Link href="/discounts"><Percent /> إدارة الخصومات</Link>
            </Button>
          )}
          {isOrderDirty && canUpdateErpModule(user, "products") && (
            <Button variant="secondary" onClick={() => { void saveOrder(); }} disabled={savingOrder}>
              <Check /> حفظ ترتيب المنتجات
            </Button>
          )}
          {canCreateErpModule(user, "products") ? (
            <Button asChild variant="primary">
              <Link href="/products/new"><Plus /> منتج جديد</Link>
            </Button>
          ) : undefined}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي باسم المنتج…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={loaded ? `${filteredProducts.length} منتج` : "جارٍ التحميل…"}
        sort={{
          value: sort ? `${sort.key}:${sort.direction}` : "",
          onChange: (value) => {
            const [key, direction] = value.split(":");
            setSort(key ? { key: key as ProductSortKey, direction: direction as "asc" | "desc" } : null);
          },
          options: [
            { value: "", label: "ترتيب المتجر" },
            ...PRODUCT_SORT_COLUMNS.flatMap((column) => [
              { value: `${column.key}:asc`, label: `${column.label} — تصاعدي` },
              { value: `${column.key}:desc`, label: `${column.label} — تنازلي` }
            ])
          ]
        }}
        filters={[
          {
            key: "status",
            label: "الحالة",
            icon: CircleDot,
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as "all" | "active" | "inactive"),
            options: ACTIVE_STATUS_FILTER_OPTIONS
          },
          {
            key: "category",
            label: "القسم",
            icon: FolderTree,
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
        loading={!loaded}
        products={sortedRows}
        sort={sort}
        onSort={toggleSort}
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
        <p>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذا المنتج ولن يظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذا المنتج ليظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف المنتج"
        tone="danger"
        onConfirm={confirmDelete}
      >
        <p>سيتم نقل المنتج إلى المحذوفات. يمكنك استعادته لاحقًا من قسم المحذوفات.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
