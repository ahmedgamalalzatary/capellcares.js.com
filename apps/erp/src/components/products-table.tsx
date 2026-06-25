"use client";

import Link from "next/link";
import { formatPrice, formatPriceRange, type Product } from "@capella/shared";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { EntityAvatar } from "@/components/admin/entity-avatar";
import { Icon } from "@/components/ui/icons";
import { RowMenu } from "@/components/ui/row-menu";
import type { AdminAuthUser } from "@/lib/api/client";
import { hasErpPermission } from "@/lib/erp-permissions";

export function ProductsTable({
  products,
  categories,
  user,
  canToggle,
  canEdit,
  canDelete,
  canReorder = false,
  onToggle,
  onDelete,
  onMove
}: {
  products: Product[];
  categories: Array<{ id: number; name: { ar: string; en: string } }>;
  user: AdminAuthUser | null;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReorder?: boolean;
  onToggle: (product: Product) => void;
  onDelete: (id: number) => void;
  onMove?: (id: number, direction: -1 | 1) => void;
}) {
  const canManageDiscount = (user: AdminAuthUser | null) => hasErpPermission(user, "products.discount");
  return (
    <div className="card">
      <div className="table-outer">
        <table className="table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>الاسم</th>
              <th>SKU</th>
              <th>القسم</th>
              <th>السعر</th>
              <th>المخزون</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const category = categories.find((candidate) => candidate.id === product.categoryId);
              const prices = product.variants.map((variant) => variant.price);
              const stockSum = product.variants.reduce((accumulator, variant) => accumulator + variant.stock, 0);
              const avatarInitial = product.name.en?.trim().charAt(0) || product.name.ar?.trim().charAt(0) || "?";
              return (
                <tr key={product.id} data-testid={`product-row-${product.id}`}>
                  <td>
                    <EntityAvatar src={product.imagePath} fallback={avatarInitial} />
                  </td>
                  <td>
                    <Link href={`/products/${product.id}/edit`} className="table-title">{product.name.ar}</Link>
                    <div className="table-subtitle">{product.name.en}</div>
                    {(product.offerIds?.length ?? 0) > 0 ? (
                      <div style={{ marginTop: 6 }}>
                        <span className="status status--active">ضمن عرض</span>
                      </div>
                    ) : null}
                  </td>
                  <td><code className="mono">{product.sku}</code></td>
                  <td>{category?.name.ar ?? "—"}</td>
                  <td>{prices.length > 1 ? formatPriceRange(Math.min(...prices), Math.max(...prices), "ar") : formatPrice(prices[0] ?? 0, "ar")}</td>
                  <td>
                    {stockSum === 0 ? <span className="status status--deleted">نفد</span>
                      : stockSum < 10 ? <span className="status status--draft">{stockSum}</span>
                      : <span className="status status--active">{stockSum}</span>}
                  </td>
                  <td><AdminStatusBadge active={product.status === "active"} activeLabel="نشط" inactiveLabel="غير نشط" /></td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    {canReorder && onMove && products.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => onMove(product.id, -1)}
                          aria-label="تحريك لأعلى"
                          disabled={index === 0}
                        >
                          <Icon.Chevron size={14} className="rotate-180" />
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => onMove(product.id, 1)}
                          aria-label="تحريك لأسفل"
                          disabled={index === products.length - 1}
                        >
                          <Icon.Chevron size={14} />
                        </button>
                      </>
                    )}
                    {(canToggle || canEdit || canDelete || canManageDiscount(user)) && (
                      <RowMenu>
                        {canToggle && (
                          <button
                            type="button"
                            className="row-menu__item"
                            onClick={() => onToggle(product)}
                            title={product.status === "active" ? "إيقاف" : "تفعيل"}
                          >
                            {product.status === "active" ? <><Icon.X /> إيقاف</> : <><Icon.Check /> تفعيل</>}
                          </button>
                        )}
                        {canManageDiscount(user) && (
                          <Link href={`/products/${product.id}/discount`} className="row-menu__item" aria-label={`خصم ${product.name.ar}`}>
                            <Icon.Tag /> خصم
                          </Link>
                        )}
                        {canEdit && (
                          <Link href={`/products/${product.id}/edit`} className="row-menu__item" aria-label={`تعديل ${product.name.ar}`}>
                            <Icon.Edit /> تعديل
                          </Link>
                        )}
                        {canDelete && (
                          <button type="button" className="row-menu__item row-menu__item--danger" onClick={() => onDelete(product.id)} aria-label={`حذف ${product.name.ar}`}>
                            <Icon.Trash /> حذف
                          </button>
                        )}
                      </RowMenu>
                    )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>لا توجد منتجات تطابق الفلتر.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
