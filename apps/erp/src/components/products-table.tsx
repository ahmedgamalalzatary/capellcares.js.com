"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, PackageOpen, Pencil, Percent, Power, PowerOff, Trash2 } from "lucide-react";
import type { Product } from "@capella/shared";
import { Badge, Swatch } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu, RowMenuItem, RowMenuLink, RowMenuSeparator } from "@/components/ui/row-menu";
import { SortableTH, Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { SortState } from "@/hooks/use-table-sort";
import { Skeleton } from "@/components/ui/skeleton";
import { Thumb } from "@/components/ui/thumb";
import type { AdminAuthUser } from "@/lib/api/client";
import { hasErpPermission } from "@/lib/erp-permissions";
import { formatMoney, formatMoneyRange, formatNumber } from "@/lib/format";
import { LOW_STOCK_LIMIT } from "@/lib/stock";

export type ProductSortKey = "name" | "category" | "price" | "stock" | "status";
export const PRODUCT_SORT_COLUMNS: Array<{ key: ProductSortKey; label: string }> = [
  { key: "name", label: "المنتج" },
  { key: "category", label: "القسم" },
  { key: "price", label: "السعر" },
  { key: "stock", label: "المخزون" },
  { key: "status", label: "الحالة" },
];

const stockOf = (product: Product) => product.variants.reduce((sum, variant) => sum + variant.stock, 0);

/** What each sortable column sorts by. */
export function productSortAccessors(categories: Array<{ id: number; name: { ar: string } }>) {
  return {
    name: (product: Product) => product.name.ar,
    category: (product: Product) => categories.find((candidate) => candidate.id === product.categoryId)?.name.ar,
    price: (product: Product) => (product.variants.length ? Math.min(...product.variants.map((variant) => variant.price)) : null),
    stock: stockOf,
    status: (product: Product) => (product.status === "active" ? 0 : 1),
  } satisfies Record<ProductSortKey, (product: Product) => string | number | null | undefined>;
}

function StockCell({ stock }: { stock: number }) {
  if (stock === 0) {
    return <span className="inline-flex items-center gap-2 text-danger"><Swatch tone="danger" />نفد المخزون</span>;
  }
  if (stock <= LOW_STOCK_LIMIT) {
    return (
      <span className="inline-flex items-center gap-2 text-warning">
        <Swatch tone="warning" /><span className="num">{formatNumber(stock)}</span> · منخفض
      </span>
    );
  }
  return <span className="inline-flex items-center gap-2 text-text"><Swatch tone="success" /><span className="num">{formatNumber(stock)}</span></span>;
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, index) => (
    <TR key={index} aria-hidden>
      <TD data-cell="lead">
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-11 rounded-thumb" />
          <div className="grid gap-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div>
        </div>
      </TD>
      <TD><Skeleton className="h-3.5 w-20" /></TD>
      <TD><Skeleton className="h-3.5 w-16" /></TD>
      <TD><Skeleton className="h-3.5 w-12" /></TD>
      <TD><Skeleton className="h-6 w-14 rounded-full" /></TD>
      <TD data-cell="actions" />
    </TR>
  ));
}

export function ProductsTable({
  loading = false,
  products,
  sort,
  onSort,
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
  loading?: boolean;
  /** Rows already filtered and sorted by the page. */
  products: Product[];
  sort: SortState<ProductSortKey> | null;
  onSort: (key: ProductSortKey) => void;
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
  const canManageDiscount = hasErpPermission(user, "products.discount");
  const hasMenu = canToggle || canEdit || canDelete || canManageDiscount;
  const categoryName = (product: Product) => categories.find((candidate) => candidate.id === product.categoryId)?.name.ar;
  // Manual reordering only makes sense in the store's own order.
  const showReorder = canReorder && Boolean(onMove) && products.length > 1 && !sort;

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            {PRODUCT_SORT_COLUMNS.map((column) => (
              <SortableTH key={column.key} direction={sort?.key === column.key ? sort.direction : null} onSort={() => onSort(column.key)}>
                {column.label}
              </SortableTH>
            ))}
            <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
          </tr>
        </THead>
        <TBody aria-busy={loading}>
          {loading ? <SkeletonRows /> : null}
          {!loading && products.map((product, index) => {
            const prices = product.variants.map((variant) => variant.price);
            const stock = stockOf(product);
            const initial = product.name.en?.trim().charAt(0) || product.name.ar?.trim().charAt(0) || "?";
            const inOffer = (product.offerIds?.length ?? 0) > 0;
            const active = product.status === "active";

            return (
              <TR key={product.id} data-testid={`product-row-${product.id}`}>
                <TD data-cell="lead">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <Thumb src={product.imagePath} fallback={initial} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/products/${product.id}/edit`}
                          className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline"
                        >
                          {product.name.ar}
                        </Link>
                        {inOffer ? <Badge tone="nude">ضمن عرض</Badge> : null}
                      </div>
                      {product.name.en ? <p dir="ltr" className="mt-0.5 truncate text-end text-sm text-text-muted">{product.name.en}</p> : null}
                    </div>
                  </div>
                </TD>
                <TD data-label="القسم" className="text-text-2">{categoryName(product) ?? "—"}</TD>
                <TD data-label="السعر" className="whitespace-nowrap">
                  <span className="num text-text-strong">
                    {prices.length > 1
                      ? formatMoneyRange(Math.min(...prices), Math.max(...prices))
                      : formatMoney(prices[0] ?? 0)}
                  </span>
                </TD>
                <TD data-label="المخزون" className="whitespace-nowrap"><StockCell stock={stock} /></TD>
                <TD data-label="الحالة">
                  <Badge tone={active ? "success" : "neutral"}>{active ? "نشط" : "غير نشط"}</Badge>
                </TD>
                <TD data-cell="actions">
                  <div className="flex items-center justify-end gap-0.5">
                    {showReorder ? (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label="تحريك لأعلى" title="تحريك لأعلى" disabled={index === 0} onClick={() => onMove?.(product.id, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="تحريك لأسفل" title="تحريك لأسفل" disabled={index === products.length - 1} onClick={() => onMove?.(product.id, 1)}>
                          <ArrowDown />
                        </Button>
                      </>
                    ) : null}
                    {hasMenu ? (
                      <RowMenu label={`إجراءات ${product.name.ar}`}>
                        {canEdit ? (
                          <RowMenuLink href={`/products/${product.id}/edit`} aria-label={`تعديل ${product.name.ar}`}>
                            <Pencil /> تعديل
                          </RowMenuLink>
                        ) : null}
                        {canManageDiscount ? (
                          <RowMenuLink href={`/products/${product.id}/discount`} aria-label={`خصم ${product.name.ar}`}>
                            <Percent /> خصم
                          </RowMenuLink>
                        ) : null}
                        {canToggle ? (
                          <RowMenuItem onClick={() => onToggle(product)}>
                            {active ? <><PowerOff /> إيقاف</> : <><Power /> تفعيل</>}
                          </RowMenuItem>
                        ) : null}
                        {canDelete ? (
                          <>
                            <RowMenuSeparator />
                            <RowMenuItem danger onClick={() => onDelete(product.id)} aria-label={`حذف ${product.name.ar}`}>
                              <Trash2 /> حذف
                            </RowMenuItem>
                          </>
                        ) : null}
                      </RowMenu>
                    ) : null}
                  </div>
                </TD>
              </TR>
            );
          })}
          {!loading && products.length === 0 ? (
            <TableState colSpan={6}>
              <EmptyState
                icon={<PackageOpen />}
                title="لا توجد منتجات تطابق البحث"
                description="جرّبي كلمة أخرى أو غيّري فلتر الحالة أو القسم."
              />
            </TableState>
          ) : null}
        </TBody>
      </Table>
    </Card>
  );
}
