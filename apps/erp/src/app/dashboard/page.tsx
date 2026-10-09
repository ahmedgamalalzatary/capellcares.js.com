"use client";

import Link from "next/link";
import { Boxes, FolderTree, Package, Plus, Tag } from "lucide-react";
import { AdminShell } from "@/components/shell/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import { formatMoney, formatMoneyRange, formatNumber } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function DashboardPage() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);
  const loaded = useStore((s) => s.loaded);

  const activeProducts = products.filter((p) => !p.deletedAt && p.status === "active");
  const totalVariants = products.reduce((acc, p) => acc + (p.deletedAt ? 0 : p.variants.length), 0);
  const lowStock = products.flatMap((p) => p.deletedAt ? [] : p.variants.filter((v) => v.stock > 0 && v.stock <= 5).map((v) => ({ p, v })));
  const outOfStock = products.flatMap((p) => p.deletedAt ? [] : p.variants.filter((v) => v.stock === 0).map((v) => ({ p, v })));
  const activeOffers = offers.filter((o) => !o.deletedAt);
  const activeCategories = categories.filter((c) => !c.deletedAt);

  return (
    <AdminShell title="لوحة التحكم" crumbs={[{ label: "نظرة عامة" }]} description="نظرة سريعة على الكتالوج والمخزون.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loaded ? (
          <>
            <Stat label="المنتجات النشطة" value={formatNumber(activeProducts.length)} hint={`من إجمالي ${formatNumber(products.length)}`} />
            <Stat label="المقاسات" value={formatNumber(totalVariants)} hint="أحجام ومقاسات" />
            <Stat label="العروض النشطة" value={formatNumber(activeOffers.length)} hint={`من إجمالي ${formatNumber(offers.length)}`} />
            <Stat label="الأقسام" value={formatNumber(activeCategories.length)} hint="تشمل الأقسام الفرعية" />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-well" />)
        )}
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="إجراءات سريعة" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Action href="/products/new" icon={<Plus />} title="منتج جديد" desc="ابدئي بإنشاء منتج." />
            <Action href="/offers/new" icon={<Tag />} title="عرض جديد" desc="جمّعي منتجات في باقة." />
            <Action href="/categories/new" icon={<FolderTree />} title="قسم جديد" desc="أضيفي قسمًا فرعيًا." />
            <Action href="/products" icon={<Boxes />} title="إدارة المنتجات" desc="تحديث المخزون والحالة." />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="تنبيهات المخزون" description={`${formatNumber(lowStock.length + outOfStock.length)} عنصر`} />
          <Table>
            <TBody>
              {outOfStock.slice(0, 5).map(({ p, v }) => (
                <TR key={`out-${v.id}`}>
                  <TD data-cell="lead">
                    <Link href={`/products/${p.id}/edit`} className="font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">{p.name.ar}</Link>
                    <span className="block text-sm text-text-muted">{v.size}</span>
                  </TD>
                  <TD data-label="الحالة" className="max-md:items-end"><Badge tone="danger">نفد</Badge></TD>
                </TR>
              ))}
              {lowStock.slice(0, 6).map(({ p, v }) => (
                <TR key={`low-${v.id}`}>
                  <TD data-cell="lead">
                    <Link href={`/products/${p.id}/edit`} className="font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">{p.name.ar}</Link>
                    <span className="block text-sm text-text-muted">{v.size}</span>
                  </TD>
                  <TD data-label="الحالة" className="max-md:items-end"><Badge tone="warning"><span className="num">{formatNumber(v.stock)}</span> متبقٍ</Badge></TD>
                </TR>
              ))}
              {loaded && lowStock.length === 0 && outOfStock.length === 0 ? (
                <TableState colSpan={2}>
                  <EmptyState icon={<Package />} title="كل المخزون بحالة جيدة" className="py-8" />
                </TableState>
              ) : null}
              {!loaded ? <TableState colSpan={2}><Skeleton className="mx-auto h-20 w-full" /></TableState> : null}
            </TBody>
          </Table>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="آخر المنتجات" actions={<Link href="/products" className="text-sm font-medium text-text-2 underline-offset-4 hover:text-text-strong hover:underline">عرض الكل</Link>} />
        <Table>
          <THead>
            <tr>
              <TH>المنتج</TH>
              <TH>القسم</TH>
              <TH>المقاسات</TH>
              <TH>السعر</TH>
              <TH>الحالة</TH>
            </tr>
          </THead>
          <TBody>
            {products.slice(0, 5).map((p) => {
              const category = categories.find((c) => c.id === p.categoryId);
              const prices = p.variants.map((v) => v.price);
              const initial = p.name.en?.trim().charAt(0) || p.name.ar?.trim().charAt(0) || "?";
              return (
                <TR key={p.id}>
                  <TD data-cell="lead">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <Thumb src={p.imagePath} fallback={initial} size="md" />
                      <div className="min-w-0">
                        <Link href={`/products/${p.id}/edit`} className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">{p.name.ar}</Link>
                        {p.name.en ? <p dir="ltr" className="mt-0.5 truncate text-end text-sm text-text-muted">{p.name.en}</p> : null}
                      </div>
                    </div>
                  </TD>
                  <TD data-label="القسم" className="text-text-2">{category?.name.ar ?? "—"}</TD>
                  <TD data-label="المقاسات" className="num whitespace-nowrap text-text-2">{formatNumber(p.variants.length)}</TD>
                  <TD data-label="السعر" className="num whitespace-nowrap text-text-strong">
                    {prices.length === 0 ? "—" : prices.length === 1 || Math.min(...prices) === Math.max(...prices)
                      ? formatMoney(prices[0] ?? 0)
                      : formatMoneyRange(Math.min(...prices), Math.max(...prices))}
                  </TD>
                  <TD data-label="الحالة">
                    {p.deletedAt
                      ? <Badge tone="neutral">محذوف</Badge>
                      : p.status === "active" ? <Badge tone="success">نشط</Badge> : <Badge tone="neutral">غير نشط</Badge>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </AdminShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardBody className="grid gap-1 py-5">
        <span className="text-sm text-text-muted">{label}</span>
        <span className="num text-2xl font-bold text-text-strong">{value}</span>
        <span className="text-xs text-text-muted">{hint}</span>
      </CardBody>
    </Card>
  );
}

function Action({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-well bg-sunken p-3 transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-surface text-text-2 shadow-inset [&_svg]:size-[18px]">{icon}</span>
      <span className="grid min-w-0 gap-0.5">
        <span className="text-base font-medium text-text-strong">{title}</span>
        <span className="text-sm text-text-muted">{desc}</span>
      </span>
    </Link>
  );
}
