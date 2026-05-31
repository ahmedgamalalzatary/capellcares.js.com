"use client";

import Link from "next/link";
import { formatPrice, formatPriceRange, type Product } from "@capella/shared";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Icon } from "@/components/ui/icons";

export function ProductsTable({
  products,
  categories,
  onToggle,
  onDelete
}: {
  products: Product[];
  categories: Array<{ id: number; name: { ar: string; en: string } }>;
  onToggle: (product: Product) => void;
  onDelete: (id: number) => void;
}) {
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
            {products.map((product) => {
              const category = categories.find((candidate) => candidate.id === product.categoryId);
              const prices = product.variants.map((variant) => variant.price);
              const stockSum = product.variants.reduce((accumulator, variant) => accumulator + variant.stock, 0);
              return (
                <tr key={product.id}>
                  <td>
                    <div className="avatar-tile">
                      {product.name.en[0]}
                    </div>
                  </td>
                  <td>
                    <Link href={`/products/${product.id}/edit`} className="table-title">{product.name.ar}</Link>
                    <div className="table-subtitle">{product.name.en}</div>
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
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => onToggle(product)}
                        title={product.status === "active" ? "إيقاف" : "تفعيل"}
                      >
                        {product.status === "active" ? <Icon.X /> : <Icon.Check />}
                      </button>
                      <Link href={`/products/${product.id}/edit`} className="btn btn--ghost btn--sm" aria-label={`تعديل ${product.name.ar}`} title="تعديل"><Icon.Edit /></Link>
                      <button className="btn btn--ghost btn--sm" onClick={() => onDelete(product.id)} style={{ color: "var(--danger)" }} aria-label={`حذف ${product.name.ar}`} title="حذف">
                        <Icon.Trash />
                      </button>
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
