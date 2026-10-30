"use client";

import Link from "next/link";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { tableSortSelect } from "@/components/admin/admin-list-header";
import { AdminShell } from "@/components/shell/admin-shell";
import { Baby, Check, CircleDot, Factory, FolderTree, Percent, Plus, Sparkles, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canCreateErpModule, canReadErpModule, canSoftDeleteErpModule, canToggleErpModule, canUpdateErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { PRODUCT_SORT_COLUMNS, ProductsTable } from "@/features/products/components/products-table";
import { SmartPagination } from "@/components/admin/smart-pagination";
import { useProductsPage } from "@/features/products/hooks/use-products-page";
import { useStore } from "@/lib/store";

export default function ProductsListPage() {
  const { user } = useAdminAuth();
  const brands = useStore((state) => state.brands);
  const characters = useStore((state) => state.characters);
  const ageGroups = useStore((state) => state.ageGroups);
  const suppliers = useStore((state) => state.suppliers);
  const {
    loaded,
    categories,
    list,
    statusFilter,
    categoryFilter,
    brandFilter,
    supplierFilter,
    ageFilter,
    characterFilter,
    categoryOptions,
    totalProducts,
    pageProducts,
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
      <ForbiddenPage title="المنتجات" crumbs={[{ label: "المنتجات" }]} message="لا تملكين صلاحية الوصول إلى المنتجات." />
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
        searchValue={list.searchInput}
        onSearchChange={list.setSearch}
        countLabel={loaded ? `${totalProducts} منتج` : "جارٍ التحميل…"}
        sort={tableSortSelect(PRODUCT_SORT_COLUMNS, list.state.sort, list.setSort)}
        filters={[
          {
            key: "status",
            label: "الحالة",
            icon: CircleDot,
            value: statusFilter,
            onChange: (value) => list.setFilter("status", value),
            options: ACTIVE_STATUS_FILTER_OPTIONS
          },
          {
            key: "category",
            label: "القسم",
            icon: FolderTree,
            testId: "products-category-filter",
            value: String(categoryFilter),
            onChange: (value) => list.setFilter("category", value),
            options: [
              { value: "", label: "كل الأقسام" },
              ...categoryOptions.map((option) => ({
                value: String(option.id),
                label: `${"— ".repeat(option.depth)}${option.label}`
              }))
            ]
          },
          {
            key: "brand",
            label: "الماركة",
            icon: Tag,
            value: brandFilter,
            onChange: (value) => list.setFilter("brand", value),
            options: [
              { value: "", label: "كل الماركات" },
              ...brands.map((brand) => ({ value: String(brand.id), label: brand.name.ar }))
            ]
          },
          {
            key: "age",
            label: "العمر",
            icon: Baby,
            value: ageFilter,
            onChange: (value) => list.setFilter("age", value),
            options: [
              { value: "", label: "كل الأعمار" },
              ...ageGroups.map((age) => ({ value: String(age.id), label: age.name.ar }))
            ]
          },
          {
            key: "character",
            label: "الشخصية",
            icon: Sparkles,
            value: characterFilter,
            onChange: (value) => list.setFilter("character", value),
            options: [
              { value: "", label: "كل الشخصيات" },
              ...characters.map((character) => ({ value: String(character.id), label: character.name.ar }))
            ]
          },
          {
            key: "supplier",
            label: "المورد",
            icon: Factory,
            value: supplierFilter,
            onChange: (value) => list.setFilter("supplier", value),
            options: [
              { value: "", label: "كل الموردين" },
              ...suppliers.map((supplier) => ({ value: String(supplier.id), label: supplier.name }))
            ]
          }
        ]}
      />

      <ProductsTable
        loading={!loaded}
        products={pageProducts}
        sort={list.state.sort}
        onSort={list.toggleSort}
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

      <SmartPagination {...list.paginationProps(totalProducts, !loaded)} />

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
