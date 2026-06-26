"use client";

import Link from "next/link";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore } from "@/lib/store";
import { formatPrice } from "@minikoshk/shared";
import { Icon } from "@/components/ui/icons";

export default function DashboardPage() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);

  const activeProducts = products.filter((p) => !p.deletedAt && p.status === "active");
  const totalVariants = products.reduce((acc, p) => acc + (p.deletedAt ? 0 : p.variants.length), 0);
  const lowStock = products.flatMap((p) => p.deletedAt ? [] : p.variants.filter((v) => v.stock > 0 && v.stock <= 5).map((v) => ({ p, v })));
  const outOfStock = products.flatMap((p) => p.deletedAt ? [] : p.variants.filter((v) => v.stock === 0).map((v) => ({ p, v })));

  return (
    <AdminShell title="لوحة التحكم" crumbs={[{ label: "نظرة عامة" }]}>
      <div className="stats-grid">
        <Stat label="المنتجات النشطة" value={activeProducts.length} hint={`من إجمالي ${products.length}`} accent="var(--accent)" />
        <Stat label="المتغيرات" value={totalVariants} hint="مقاسات وأحجام" accent="var(--ink)" />
        <Stat label="العروض النشطة" value={offers.filter((o) => !o.deletedAt).length} hint={`من إجمالي ${offers.length}`} accent="var(--warm)" />
        <Stat label="الأقسام" value={categories.filter((c) => !c.deletedAt).length} hint="تشمل الأقسام الفرعية" accent="var(--ink-2)" />
      </div>

      <div className="split-grid">
        <section className="card">
          <div className="card__head">
            <h3 className="card__title">إجراءات سريعة</h3>
          </div>
          <div className="card__body action-grid">
            <Action href="/products/new" icon={<Icon.Plus />} title="منتج جديد" desc="ابدئي بإنشاء منتج جديد." />
            <Action href="/offers/new" icon={<Icon.Tag />} title="عرض جديد" desc="جمّعي منتجات في باقة." />
            <Action href="/categories/new" icon={<Icon.Folder />} title="قسم جديد" desc="أضيفي قسمًا فرعيًا." />
            <Action href="/products" icon={<Icon.Box />} title="إدارة المنتجات" desc="تحديث المخزون والحالة." />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h3 className="card__title">تنبيهات المخزون</h3>
            <span className="muted" style={{ fontSize: 12 }}>{lowStock.length + outOfStock.length} عنصر</span>
          </div>
          <div className="panel-scroll">
            <table className="table">
              <tbody>
                {outOfStock.slice(0, 5).map(({ p, v }) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/products/${p.id}/edit`} className="table-title">{p.name.ar}</Link>
                      <div className="table-subtitle">{v.size}</div>
                    </td>
                    <td style={{ textAlign: "end" }}><span className="status status--deleted">نفد</span></td>
                  </tr>
                ))}
                {lowStock.slice(0, 6).map(({ p, v }) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/products/${p.id}/edit`} className="table-title">{p.name.ar}</Link>
                      <div className="table-subtitle">{v.size}</div>
                    </td>
                    <td style={{ textAlign: "end" }}><span className="status status--draft">{v.stock}</span></td>
                  </tr>
                ))}
                {lowStock.length === 0 && outOfStock.length === 0 && (
                  <tr><td className="muted" style={{ padding: 20, textAlign: "center" }}>كل المخزون بحالة جيدة.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card__head">
          <h3 className="card__title">آخر المنتجات</h3>
          <Link href="/products" className="btn btn--ghost btn--sm">عرض الكل</Link>
        </div>
        <div className="table-outer">
        <table className="table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكود</th>
              <th>القسم</th>
              <th>المتغيرات</th>
              <th>السعر</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 5).map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              const prices = p.variants.map((v) => v.price);
              const min = Math.min(...prices); const max = Math.max(...prices);
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/products/${p.id}/edit`} className="table-title">{p.name.ar}</Link>
                    <div className="table-subtitle">{p.name.en}</div>
                  </td>
                  <td><code className="mono">{p.sku}</code></td>
                  <td>{cat?.name.ar ?? "—"}</td>
                  <td>{p.variants.length}</td>
                  <td>{min === max ? formatPrice(min, "ar") : `${formatPrice(min, "ar")} – ${formatPrice(max, "ar")}`}</td>
                  <td>
                    {p.deletedAt
                      ? <span className="status status--deleted">محذوف</span>
                      : p.status === "active"
                        ? <span className="status status--active">نشط</span>
                        : <span className="status status--inactive">غير نشط</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>
    </AdminShell>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: number; hint: string; accent: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value" style={{ color: accent }}>{value}</div>
      <div className="stat__meta">{hint}</div>
    </div>
  );
}

function Action({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="action-card">
      <div className="action-card__icon">{icon}</div>
      <div>
        <div className="action-card__title">{title}</div>
        <div className="action-card__desc">{desc}</div>
      </div>
    </Link>
  );
}
